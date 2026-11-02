import { extensionFor } from "../live/documents";
import { glossaryAnalytes } from "./glossary";
import type { ReportDocument } from "../rag/store";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DiagnosticReport, ExplainResponse, Observation, ReportListItem } from "@core/api/schemas/ai";
import type { LanguageCode } from "@core/i18n/languages";
import type { MockClock } from "./clock";
import { genericMeaning, genericQuestions, genericSummary } from "./genericExplain";

type Localized = Record<LanguageCode, string>;
type Interpretation = Observation["interpretation"];

export type FixtureKey = "diabetes" | "cbc" | "vitd" | "june" | "lipid";

interface FixtureObservation {
  code: string;
  display: string;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
  extractedValue?: number;
  confidence: number;
}

interface Fixture {
  key: FixtureKey;
  labName: string;
  reportType: string;
  daysAgo: number;
  imageFile: string;
  observations: FixtureObservation[];
}

export const fixtures: Record<FixtureKey, Fixture> = {
  diabetes: {
    key: "diabetes",
    labName: "Pune Central Diagnostics",
    reportType: "Diabetes check-up",
    daysAgo: 0,
    imageFile: "diabetes-panel.png",
    observations: [
      { code: "HBA1C", display: "HbA1c", value: 7.1, unit: "%", low: 4.0, high: 5.6, confidence: 0.98 },
      { code: "FBS", display: "Fasting glucose", value: 132, extractedValue: 152, unit: "mg/dL", low: 70, high: 99, confidence: 0.58 },
      { code: "TC", display: "Total cholesterol", value: 214, unit: "mg/dL", low: 0, high: 200, confidence: 0.96 },
      { code: "TG", display: "Triglycerides", value: 148, unit: "mg/dL", low: 0, high: 150, confidence: 0.95 },
    ],
  },
  cbc: {
    key: "cbc",
    labName: "Pune Central Diagnostics",
    reportType: "Complete blood count",
    daysAgo: 0,
    imageFile: "cbc.png",
    observations: [
      { code: "HB", display: "Haemoglobin", value: 12.8, unit: "g/dL", low: 12.0, high: 15.5, confidence: 0.97 },
      { code: "WBC", display: "White blood cells", value: 7.2, unit: "×10³/µL", low: 4.0, high: 11.0, confidence: 0.96 },
      { code: "PLT", display: "Platelets", value: 245, unit: "×10³/µL", low: 150, high: 450, confidence: 0.97 },
      { code: "RBC", display: "Red blood cells", value: 4.5, unit: "×10⁶/µL", low: 3.8, high: 5.2, confidence: 0.95 },
    ],
  },
  vitd: {
    key: "vitd",
    labName: "Pune Central Diagnostics",
    reportType: "Vitamin D",
    daysAgo: 0,
    imageFile: "vitamin-d.png",
    observations: [{ code: "VITD", display: "Vitamin D", value: 18, unit: "ng/mL", low: 30, high: 100, confidence: 0.97 }],
  },
  june: {
    key: "june",
    labName: "Pune Central Diagnostics",
    reportType: "Diabetes check-up",
    daysAgo: 142,
    imageFile: "june-diabetes.png",
    observations: [
      { code: "HBA1C", display: "HbA1c", value: 7.9, unit: "%", low: 4.0, high: 5.6, confidence: 0.98 },
      { code: "FBS", display: "Fasting glucose", value: 148, unit: "mg/dL", low: 70, high: 99, confidence: 0.97 },
    ],
  },
  lipid: {
    key: "lipid",
    labName: "Kothrud Family Lab",
    reportType: "Lipid profile",
    daysAgo: 20,
    imageFile: "lipid.png",
    observations: [
      { code: "TC", display: "Total cholesterol", value: 208, unit: "mg/dL", low: 0, high: 200, confidence: 0.97 },
      { code: "TG", display: "Triglycerides", value: 162, unit: "mg/dL", low: 0, high: 150, confidence: 0.96 },
    ],
  },
};

const uploadCycle: FixtureKey[] = ["diabetes", "cbc", "vitd"];
const duplicateWindowDays = 30;
const criticalFactor = 1.6;

export function interpret(value: number, low: number | null, high: number | null): Interpretation {
  if (high !== null && value > high) return value > high * criticalFactor ? "critical" : "high";
  if (low !== null && value < low) return low > 0 && value < low / criticalFactor ? "critical" : "low";
  return "normal";
}

const diabeticProfileId = "prof_self";
const dayMs = 86_400_000;

export interface StoredFile {
  name: string;
  mime: string;
  path: string;
}

interface ReportRecord {
  id: string;
  profileId: string;
  fixtureKey: FixtureKey | null;
  labName: string;
  reportType: string;
  issuedAtMs: number;
  status: DiagnosticReport["status"];
  observations: Observation[];
  rawText?: string;
  file?: StoredFile;
  failureReason?: string;
}

interface JobRecord {
  id: string;
  reportId: string;
  startedAtMs: number;
  durationMs: number;
  state?: "processing" | "ready_for_review" | "failed";
}

export interface ReportStoreSnapshot {
  reports: ReportRecord[];
  jobs: JobRecord[];
  uploadCount: number;
}

export interface ExtractedReport {
  labName: string;
  reportType: string;
  issuedAtMs: number | null;
  observations: Observation[];
  rawText?: string;
}

export type ReportExtractor = (bytes: Buffer, mime: string, name: string) => Promise<ExtractedReport>;

export interface ReportStoreOptions {
  seedHistory?: boolean;
  uploadDirectory?: string;
}

type BoxMap = Record<string, Record<string, [number, number, number, number]>>;

function loadBoxes(): BoxMap {
  const path = resolve(dirname(fileURLToPath(import.meta.url)), "data", "report-boxes.json");
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as BoxMap;
}

const directionOf = (interpretation: Interpretation): "low" | "normal" | "high" =>
  interpretation === "normal" ? "normal" : interpretation === "low" ? "low" : "high";

const normalMeaning: Localized = {
  en: "This value is within the usual range.",
  hi: "यह मान सामान्य सीमा के भीतर है।",
  mr: "हे मूल्य सामान्य मर्यादेत आहे.",
  hinglish: "Yeh value saamanya range ke andar hai.",
};

const meanings: Record<string, Partial<Record<"high" | "low", Localized>>> = {
  HBA1C: {
    high: {
      en: "HbA1c shows the average blood sugar over about three months. This reading is above the usual range for people without diabetes. A falling trend across reports is a good sign, and your doctor decides your personal target.",
      hi: "HbA1c लगभग तीन महीनों की औसत रक्त शर्करा दिखाता है। यह रीडिंग उन लोगों की सामान्य सीमा से ऊपर है जिन्हें मधुमेह नहीं है। रिपोर्टों में घटता रुझान अच्छा संकेत है, और आपका लक्ष्य आपके डॉक्टर तय करते हैं।",
      mr: "HbA1c सुमारे तीन महिन्यांची सरासरी रक्तातील साखर दाखवतो. हे मोजमाप मधुमेह नसलेल्यांच्या सामान्य मर्यादेपेक्षा जास्त आहे. अहवालांमध्ये कमी होणारा कल हे चांगले लक्षण आहे, आणि तुमचे लक्ष्य तुमचे डॉक्टर ठरवतात.",
      hinglish: "HbA1c lagbhag teen mahine ki average blood sugar dikhata hai. Yeh reading un logon ki saamanya range se upar hai jinhein madhumeh nahi hai. Reports mein ghatta rujhan achha sanket hai, aur aapka target aapke doctor tay karte hain.",
    },
  },
  FBS: {
    high: {
      en: "Fasting glucose is the sugar level after at least eight hours without food. This reading is above the usual fasting range. The previous day's meals and sleep can affect it, so your doctor reads it together with HbA1c.",
      hi: "फास्टिंग ग्लूकोज़ कम से कम आठ घंटे बिना खाए की शुगर होती है। यह रीडिंग सामान्य फास्टिंग सीमा से ऊपर है। पिछले दिन का भोजन और नींद इसे प्रभावित कर सकते हैं, इसलिए डॉक्टर इसे HbA1c के साथ पढ़ते हैं।",
      mr: "उपाशीपोटी ग्लुकोज म्हणजे किमान आठ तास अन्नाशिवाय असलेली साखरेची पातळी. हे मोजमाप सामान्य उपाशीपोटी मर्यादेपेक्षा जास्त आहे. आदल्या दिवशीचे जेवण आणि झोप यांचा परिणाम होऊ शकतो, म्हणून डॉक्टर ते HbA1c सोबत पाहतात.",
      hinglish: "Fasting glucose kam se kam aath ghante bina khaaye ki sugar hoti hai. Yeh reading saamanya fasting range se upar hai. Pichhle din ka bhojan aur neend ise prabhavit kar sakte hain, isliye doctor ise HbA1c ke saath padhte hain.",
    },
  },
  TC: {
    high: {
      en: "Total cholesterol is slightly above the usual limit. Food, activity and family history all play a part, and your doctor looks at it together with your other results.",
      hi: "कुल कोलेस्ट्रॉल सामान्य सीमा से थोड़ा ऊपर है। भोजन, गतिविधि और पारिवारिक इतिहास सब की भूमिका होती है, और डॉक्टर इसे आपके दूसरे नतीजों के साथ देखते हैं।",
      mr: "एकूण कोलेस्टेरॉल सामान्य मर्यादेपेक्षा थोडे जास्त आहे. आहार, हालचाल आणि कौटुंबिक इतिहास या सर्वांचा परिणाम होतो, आणि डॉक्टर ते तुमच्या इतर निकालांसोबत पाहतात.",
      hinglish: "Kul cholesterol saamanya seema se thoda upar hai. Bhojan, gatividhi aur parivarik itihaas sab ki bhumika hoti hai, aur doctor ise aapke doosre nateejon ke saath dekhte hain.",
    },
  },
  VITD: {
    low: {
      en: "Vitamin D is lower than the usual range. This is common and can affect bones and muscles. Your doctor may suggest sunlight, food changes or a supplement.",
      hi: "विटामिन डी सामान्य सीमा से कम है। यह आम बात है और हड्डियों व मांसपेशियों पर असर डाल सकता है। डॉक्टर धूप, भोजन में बदलाव या सप्लीमेंट सुझा सकते हैं।",
      mr: "व्हिटॅमिन डी सामान्य मर्यादेपेक्षा कमी आहे. हे सामान्य आहे आणि हाडे व स्नायूंवर परिणाम करू शकते. डॉक्टर उन्हात वेळ घालवणे, आहारातील बदल किंवा सप्लिमेंट सुचवू शकतात.",
      hinglish: "Vitamin D saamanya range se kam hai. Yeh aam baat hai aur haddiyon va maansapeshiyon par asar daal sakta hai. Doctor dhoop, bhojan mein badlav ya supplement suggest kar sakte hain.",
    },
  },
};

const summaries: Record<FixtureKey, Localized> = {
  diabetes: {
    en: "Most values are close to the usual range. HbA1c and fasting glucose are above it and cholesterol is slightly high, but HbA1c has come down since the earlier report.",
    hi: "ज़्यादातर मान सामान्य सीमा के पास हैं। HbA1c और फास्टिंग ग्लूकोज़ उससे ऊपर हैं और कोलेस्ट्रॉल थोड़ा ज़्यादा है, पर पिछली रिपोर्ट से HbA1c घटा है।",
    mr: "बहुतेक मूल्ये सामान्य मर्यादेच्या जवळ आहेत. HbA1c आणि उपाशीपोटी ग्लुकोज त्यापेक्षा जास्त आहेत आणि कोलेस्टेरॉल थोडे जास्त आहे, पण आधीच्या अहवालापासून HbA1c कमी झाला आहे.",
    hinglish: "Zyadatar values saamanya range ke paas hain. HbA1c aur fasting glucose usse upar hain aur cholesterol thoda zyada hai, par pichhli report se HbA1c ghata hai.",
  },
  cbc: {
    en: "All the blood counts in this report are within the usual range.",
    hi: "इस रिपोर्ट के सभी ब्लड काउंट सामान्य सीमा के भीतर हैं।",
    mr: "या अहवालातील सर्व रक्त मोजणी सामान्य मर्यादेत आहेत.",
    hinglish: "Is report ke sabhi blood count saamanya range ke andar hain.",
  },
  vitd: {
    en: "Vitamin D is lower than the usual range. This is common and your doctor can suggest the next step.",
    hi: "विटामिन डी सामान्य सीमा से कम है। यह आम है और अगला कदम आपके डॉक्टर बता सकते हैं।",
    mr: "व्हिटॅमिन डी सामान्य मर्यादेपेक्षा कमी आहे. हे सामान्य आहे आणि पुढची पायरी तुमचे डॉक्टर सांगू शकतात.",
    hinglish: "Vitamin D saamanya range se kam hai. Yeh aam hai aur agla kadam aapke doctor bata sakte hain.",
  },
  june: {
    en: "HbA1c and fasting glucose were above the usual range in this earlier report.",
    hi: "इस पुरानी रिपोर्ट में HbA1c और फास्टिंग ग्लूकोज़ सामान्य सीमा से ऊपर थे।",
    mr: "या जुन्या अहवालात HbA1c आणि उपाशीपोटी ग्लुकोज सामान्य मर्यादेपेक्षा जास्त होते.",
    hinglish: "Is purani report mein HbA1c aur fasting glucose saamanya range se upar the.",
  },
  lipid: {
    en: "Total cholesterol and triglycerides were slightly above the usual range in this report.",
    hi: "इस रिपोर्ट में कुल कोलेस्ट्रॉल और ट्राइग्लिसराइड सामान्य सीमा से थोड़े ऊपर थे।",
    mr: "या अहवालात एकूण कोलेस्टेरॉल आणि ट्रायग्लिसराइड सामान्य मर्यादेपेक्षा थोडे जास्त होते.",
    hinglish: "Is report mein kul cholesterol aur triglyceride saamanya range se thode upar the.",
  },
};

const doctorQuestions: Record<FixtureKey, Record<LanguageCode, string[]>> = {
  diabetes: {
    en: ["Should my diabetes medicine change?", "What HbA1c target is right for me?", "Is my cholesterol something to act on now, or just watch?", "Should I get my vitamin D checked as well?"],
    hi: ["क्या मेरी डायबिटीज़ की दवा बदलनी चाहिए?", "मेरे लिए HbA1c का सही लक्ष्य क्या है?", "क्या कोलेस्ट्रॉल पर अभी कुछ करना है, या बस नज़र रखनी है?", "क्या मुझे विटामिन डी की जाँच भी करानी चाहिए?"],
    mr: ["माझे मधुमेहाचे औषध बदलावे का?", "माझ्यासाठी HbA1c चे योग्य लक्ष्य काय?", "कोलेस्टेरॉलवर आता काही करायचे आहे की फक्त लक्ष ठेवायचे?", "मी व्हिटॅमिन डी ची तपासणीही करावी का?"],
    hinglish: ["Kya meri diabetes ki dawai badalni chahiye?", "Mere liye HbA1c ka sahi target kya hai?", "Kya cholesterol par abhi kuch karna hai, ya bas nazar rakhni hai?", "Kya mujhe vitamin D ki jaanch bhi karani chahiye?"],
  },
  cbc: {
    en: ["Are all my blood counts fine?", "Is any follow-up test needed?", "How often should I repeat this test?"],
    hi: ["क्या मेरे सभी ब्लड काउंट ठीक हैं?", "क्या कोई और जाँच ज़रूरी है?", "यह जाँच कितने समय में दोहरानी चाहिए?"],
    mr: ["माझ्या सर्व रक्त मोजणी ठीक आहेत का?", "आणखी कोणती तपासणी आवश्यक आहे का?", "ही तपासणी किती वेळाने पुन्हा करावी?"],
    hinglish: ["Kya mere sabhi blood count theek hain?", "Kya koi aur jaanch zaroori hai?", "Yeh jaanch kitne samay mein dohrani chahiye?"],
  },
  vitd: {
    en: ["What is the best way for me to raise my vitamin D?", "Do I need a supplement, and for how long?", "When should I repeat this test?"],
    hi: ["मेरे लिए विटामिन डी बढ़ाने का सबसे अच्छा तरीक़ा क्या है?", "क्या मुझे सप्लीमेंट चाहिए, और कितने समय तक?", "यह जाँच दोबारा कब करानी चाहिए?"],
    mr: ["माझे व्हिटॅमिन डी वाढवण्याचा सर्वोत्तम मार्ग कोणता?", "मला सप्लिमेंट लागेल का, आणि किती काळ?", "ही तपासणी पुन्हा केव्हा करावी?"],
    hinglish: ["Mere liye vitamin D badhane ka sabse achha tareeka kya hai?", "Kya mujhe supplement chahiye, aur kitne samay tak?", "Yeh jaanch dobara kab karani chahiye?"],
  },
  june: {
    en: ["How has my sugar control changed since this report?", "Is any other test due?", "What should I keep doing?"],
    hi: ["इस रिपोर्ट के बाद मेरी शुगर कैसी रही?", "क्या कोई और जाँच बाकी है?", "मुझे क्या जारी रखना चाहिए?"],
    mr: ["या अहवालानंतर माझी साखर कशी राहिली?", "आणखी कोणती तपासणी बाकी आहे का?", "मी काय चालू ठेवावे?"],
    hinglish: ["Is report ke baad meri sugar kaisi rahi?", "Kya koi aur jaanch baaki hai?", "Mujhe kya jaari rakhna chahiye?"],
  },
  lipid: {
    en: ["Does my cholesterol need treatment or only food changes?", "When should this be checked again?", "Does my diabetes change what I should aim for?"],
    hi: ["क्या मेरे कोलेस्ट्रॉल के लिए इलाज चाहिए या सिर्फ़ भोजन में बदलाव?", "इसे दोबारा कब जाँचना चाहिए?", "क्या मधुमेह की वजह से मेरा लक्ष्य बदलता है?"],
    mr: ["माझ्या कोलेस्टेरॉलसाठी उपचार हवेत की फक्त आहारात बदल?", "हे पुन्हा केव्हा तपासावे?", "मधुमेहामुळे माझे लक्ष्य बदलते का?"],
    hinglish: ["Kya mere cholesterol ke liye ilaaj chahiye ya sirf bhojan mein badlav?", "Ise dobara kab jaanchna chahiye?", "Kya madhumeh ki wajah se mera target badalta hai?"],
  },
};

const seekCareIf: Localized = {
  en: "Seek care sooner if there is very high thirst, repeated vomiting, confusion, chest pain or trouble breathing.",
  hi: "बहुत ज़्यादा प्यास, बार-बार उल्टी, भ्रम, सीने में दर्द या साँस लेने में तकलीफ़ हो तो जल्दी डॉक्टर को दिखाएँ।",
  mr: "खूप जास्त तहान, वारंवार उलट्या, गोंधळ, छातीत दुखणे किंवा श्वास घेण्यास त्रास झाल्यास लवकर डॉक्टरांना दाखवा.",
  hinglish: "Bahut zyada pyaas, baar-baar ulti, bhram, seene mein dard ya saans lene mein takleef ho to jaldi doctor ko dikhayein.",
};

const disclaimers: Localized = {
  en: "This explains your report in simple words. It is guidance, not a diagnosis. Your doctor decides.",
  hi: "यह आपकी रिपोर्ट को आसान शब्दों में समझाता है। यह मार्गदर्शन है, निदान नहीं। फ़ैसला आपके डॉक्टर का है।",
  mr: "हे तुमचा अहवाल सोप्या शब्दांत समजावते. हे मार्गदर्शन आहे, निदान नाही. निर्णय तुमच्या डॉक्टरांचा आहे.",
  hinglish: "Yeh aapki report ko aasan shabdon mein samjhata hai. Yeh guidance hai, diagnosis nahi. Faisla aapke doctor ka hai.",
};

const savedDocumentSummary: Record<LanguageCode, string> = {
  en: "This document is saved. It has no standard lab values for me to explain here, but you can ask Healix AI questions about what it says.",
  hi: "यह दस्तावेज़ सहेज लिया गया है। इसमें समझाने लायक सामान्य लैब मान नहीं मिले, पर आप Healix AI से इसके बारे में पूछ सकते हैं।",
  mr: "हा दस्तऐवज जतन केला आहे. यात समजावण्यासारखी नेहमीची लॅब मूल्ये आढळली नाहीत, पण तुम्ही Healix AI ला त्याबद्दल विचारू शकता.",
  hinglish: "Yeh document save ho gaya hai. Isme samjhane layak saamanya lab values nahi mili, par aap Healix AI se iske baare mein poochh sakte hain.",
};

function reasonCode(message: string | undefined): string {
  if (message === "unreadable_file" || message === "unreadable_image" || message === "scanned_pdf" || message === "no_text_found") return message;
  return "reader_error";
}

function documentText(record: ReportRecord): string {
  const date = new Date(record.issuedAtMs).toISOString().slice(0, 10);
  const lines = record.observations.map((entry) => {
    const { low, high } = entry.reference;
    const range = low !== null && low > 0 && high !== null ? `${low} to ${high}` : high !== null ? `up to ${high}` : low !== null ? `from ${low}` : "not given";
    const where = entry.interpretation === "normal" ? "within the reference range" : entry.interpretation === "low" ? "below the reference range" : "above the reference range";
    const meaning = glossaryAnalytes.find((item) => item.code === entry.code)?.what.en;
    return `${entry.display}: ${entry.value} ${entry.unit}, reference ${range} ${entry.unit}, ${where}.${meaning ? ` ${meaning}` : ""}`;
  });
  const head = `${record.reportType} from ${record.labName}, dated ${date}.`;
  const raw = record.rawText ? `Text read from the uploaded file:\n${record.rawText}` : "";
  const results = lines.length > 0 ? `Confirmed results:\n${lines.join("\n")}` : "";
  return [head, raw, results].filter(Boolean).join("\n\n");
}

export type ReportError = "not_found" | "review_required" | "wrong_state";

export class ReportStore {
  private reports = new Map<string, ReportRecord>();
  private jobs = new Map<string, JobRecord>();
  private uploadCount = 0;
  private boxes = loadBoxes();
  private extractor: ReportExtractor | null = null;
  private readonly seedHistory: boolean;
  private readonly uploadDirectory: string | undefined;

  constructor(
    private readonly clock: MockClock,
    options: ReportStoreOptions = {},
  ) {
    this.seedHistory = options.seedHistory ?? true;
    this.uploadDirectory = options.uploadDirectory;
    this.reset();
  }

  setExtractor(extractor: ReportExtractor): void {
    this.extractor = extractor;
  }

  reset(): void {
    this.reports.clear();
    this.jobs.clear();
    this.uploadCount = 0;
    this.boxes = loadBoxes();
    if (this.seedHistory) {
      this.seedHistoric("rep_june", "june");
      this.seedHistoric("rep_lipid", "lipid");
    }
  }

  snapshot(): ReportStoreSnapshot {
    return { reports: structuredClone([...this.reports.values()]), jobs: structuredClone([...this.jobs.values()]), uploadCount: this.uploadCount };
  }

  restore(snapshot: ReportStoreSnapshot): void {
    this.reports.clear();
    this.jobs.clear();
    for (const record of snapshot.reports) {
      if (record.status === "processing") record.status = "uploaded";
      this.reports.set(record.id, record);
    }
    for (const job of snapshot.jobs) this.jobs.set(job.id, job);
    this.uploadCount = snapshot.uploadCount;
  }

  private buildObservations(key: FixtureKey, useExtracted: boolean): Observation[] {
    const boxes = this.boxes[key] ?? {};
    return fixtures[key].observations.map((entry) => {
      const value = useExtracted && entry.extractedValue !== undefined ? entry.extractedValue : entry.value;
      const bbox = boxes[entry.code];
      return {
        code: entry.code,
        display: entry.display,
        value,
        unit: entry.unit,
        reference: { low: entry.low, high: entry.high },
        interpretation: interpret(value, entry.low, entry.high),
        confidence: entry.confidence,
        ...(bbox ? { bbox } : {}),
      };
    });
  }

  private seedHistoric(id: string, key: FixtureKey): void {
    this.reports.set(id, {
      id,
      profileId: diabeticProfileId,
      fixtureKey: key,
      labName: fixtures[key].labName,
      reportType: fixtures[key].reportType,
      issuedAtMs: this.clock.now().getTime() - fixtures[key].daysAgo * dayMs,
      status: "confirmed",
      observations: this.buildObservations(key, false),
    });
  }

  private toListItem(record: ReportRecord): ReportListItem {
    return {
      id: record.id,
      profile_id: record.profileId,
      lab_name: record.labName,
      report_type: record.reportType,
      issued_at: new Date(record.issuedAtMs).toISOString(),
      status: record.status,
      flag_count: record.observations.filter((entry) => entry.interpretation !== "normal").length,
    };
  }

  list(profileId?: string): ReportListItem[] {
    return [...this.reports.values()]
      .filter((record) => (profileId ? record.profileId === profileId : true))
      .sort((a, b) => b.issuedAtMs - a.issuedAtMs)
      .map((record) => this.toListItem(record));
  }

  get(id: string): DiagnosticReport | undefined {
    const record = this.reports.get(id);
    if (!record) return undefined;
    return {
      id: record.id,
      profile_id: record.profileId,
      lab_name: record.labName,
      report_type: record.reportType,
      issued_at: new Date(record.issuedAtMs).toISOString(),
      status: record.status,
      image_url: `/api/reports/${record.id}/image`,
      observations: record.observations,
    };
  }

  latestObservations(profileIds: readonly string[]): Observation[] {
    const records = [...this.reports.values()]
      .filter((record) => record.status === "confirmed" && profileIds.includes(record.profileId))
      .sort((a, b) => b.issuedAtMs - a.issuedAtMs);
    const latest = new Map<string, Observation>();
    for (const record of records) {
      for (const observation of record.observations) if (!latest.has(observation.code)) latest.set(observation.code, observation);
    }
    return [...latest.values()];
  }

  documentsFor(profileIds: readonly string[]): ReportDocument[] {
    return [...this.reports.values()]
      .filter((record) => record.status === "confirmed" && profileIds.includes(record.profileId))
      .map((record) => ({
        reportId: record.id,
        profileId: record.profileId,
        title: `${record.reportType} · ${record.labName}`,
        issuedAtMs: record.issuedAtMs,
        text: documentText(record),
      }));
  }

  imageSource(id: string): { kind: "fixture"; file: string } | { kind: "upload"; path: string; mime: string } | undefined {
    const record = this.reports.get(id);
    if (!record) return undefined;
    if (record.file) return { kind: "upload", path: record.file.path, mime: record.file.mime };
    return record.fixtureKey ? { kind: "fixture", file: fixtures[record.fixtureKey].imageFile } : undefined;
  }

  failureReason(id: string): string | undefined {
    return this.reports.get(id)?.failureReason;
  }

  uploadFile(profileId: string, name: string, mime: string, bytes: Buffer): string {
    if (!this.uploadDirectory) throw new Error("No upload directory is configured");
    this.uploadCount += 1;
    const id = `rep_up_${Date.now().toString(36)}_${String(this.uploadCount).padStart(3, "0")}`;
    mkdirSync(this.uploadDirectory, { recursive: true });
    const extension = extensionFor(mime);
    const path = resolve(this.uploadDirectory, `${id}${extension}`);
    writeFileSync(path, bytes);
    this.reports.set(id, {
      id,
      profileId,
      fixtureKey: null,
      labName: "Uploaded report",
      reportType: "Lab report",
      issuedAtMs: this.clock.now().getTime(),
      status: "uploaded",
      observations: [],
      file: { name, mime, path },
    });
    return id;
  }

  upload(profileId: string): string {
    const key = uploadCycle[this.uploadCount % uploadCycle.length] as FixtureKey;
    this.uploadCount += 1;
    const id = `rep_new_${String(this.uploadCount).padStart(3, "0")}`;
    this.reports.set(id, {
      id,
      profileId,
      fixtureKey: key,
      labName: fixtures[key].labName,
      reportType: fixtures[key].reportType,
      issuedAtMs: this.clock.now().getTime(),
      status: "uploaded",
      observations: [],
    });
    return id;
  }

  startJob(reportId: string, durationMs: number): string | undefined {
    const record = this.reports.get(reportId);
    if (!record) return undefined;
    record.status = "processing";
    record.failureReason = undefined;
    const id = `job_${String(this.jobs.size + 1).padStart(3, "0")}`;
    if (record.file) {
      const job: JobRecord = { id, reportId, startedAtMs: Date.now(), durationMs: 0, state: "processing" };
      this.jobs.set(id, job);
      void this.runExtraction(record, job);
      return id;
    }
    this.jobs.set(id, { id, reportId, startedAtMs: Date.now(), durationMs });
    return id;
  }

  private async runExtraction(record: ReportRecord, job: JobRecord): Promise<void> {
    const file = record.file;
    try {
      if (!file) throw new Error("no file");
      if (!this.extractor) throw new Error("No report reader is set up on this server");
      const result = await this.extractor(readFileSync(file.path), file.mime, file.name);
      record.labName = result.labName;
      record.reportType = result.reportType;
      if (result.issuedAtMs !== null) record.issuedAtMs = result.issuedAtMs;
      record.observations = result.observations;
      record.rawText = result.rawText;
      record.status = "ready_for_review";
      job.state = "ready_for_review";
    } catch (error) {
      record.status = "uploaded";
      record.failureReason = error instanceof Error ? error.message : "failed";
      job.state = "failed";
    }
  }

  jobStatus(jobId: string): { status: "queued" | "processing" | "ready_for_review" | "failed"; report_id: string; reason?: string } | undefined {
    const job = this.jobs.get(jobId);
    if (!job) return undefined;
    const record = this.reports.get(job.reportId);
    if (!record) return undefined;
    if (job.state) return { status: job.state, report_id: job.reportId, ...(job.state === "failed" ? { reason: reasonCode(record.failureReason) } : {}) };
    const elapsed = Date.now() - job.startedAtMs;
    if (elapsed >= job.durationMs) {
      if (record.status === "processing" && record.fixtureKey) {
        record.status = "ready_for_review";
        record.observations = this.buildObservations(record.fixtureKey, true);
      }
      return { status: "ready_for_review", report_id: job.reportId };
    }
    return { status: elapsed < job.durationMs * 0.25 ? "queued" : "processing", report_id: job.reportId };
  }

  confirm(reportId: string, corrections: Array<{ code: string; value: number }>): DiagnosticReport | ReportError {
    const record = this.reports.get(reportId);
    if (!record) return "not_found";
    if (record.status !== "ready_for_review" && record.status !== "confirmed") return "wrong_state";
    record.observations = record.observations.map((entry) => {
      const correction = corrections.find((item) => item.code === entry.code);
      if (!correction) return entry;
      return {
        ...entry,
        value: correction.value,
        interpretation: interpret(correction.value, entry.reference.low, entry.reference.high),
        confidence: 1,
      };
    });
    record.status = "confirmed";
    return this.get(reportId) as DiagnosticReport;
  }

  explain(reportId: string, language: LanguageCode, requestId: string): ExplainResponse | ReportError {
    const record = this.reports.get(reportId);
    if (!record) return "not_found";
    if (record.status !== "confirmed") return "review_required";

    const items = record.observations.map((entry) => {
      const direction = directionOf(entry.interpretation);
      const text = direction === "normal" ? undefined : (meanings[entry.code]?.[direction]?.[language] ?? genericMeaning(entry.display, direction, language));
      const bound = direction === "high" ? entry.reference.high : entry.reference.low;
      const span = (entry.reference.high ?? entry.value) - (entry.reference.low ?? 0) || 1;
      const history = this.historyFor(record, entry.code);
      return {
        code: entry.code,
        meaning: text ?? normalMeaning[language],
        direction,
        distance: direction === "normal" || bound === null ? 0 : Math.round((Math.abs(entry.value - bound) / span) * 100) / 100,
        ...(history.length > 1 ? { history } : {}),
      };
    });

    const nowMs = this.clock.now().getTime();
    const duplicates = record.observations.flatMap((entry) => {
      const previous = [...this.reports.values()]
        .filter((other) => other.id !== record.id && other.status === "confirmed" && other.issuedAtMs < record.issuedAtMs)
        .filter((other) => other.observations.some((observed) => observed.code === entry.code))
        .sort((a, b) => b.issuedAtMs - a.issuedAtMs)[0];
      if (!previous) return [];
      const daysAgo = Math.round((nowMs - previous.issuedAtMs) / dayMs);
      if (daysAgo > duplicateWindowDays) return [];
      return [{ code: entry.code, last_date: new Date(previous.issuedAtMs).toISOString(), days_ago: daysAgo }];
    });

    return {
      language,
      request_id: requestId,
      model: "mock-report-explain",
      prompt_version: "mock-v1",
      disclaimer: disclaimers[language],
      summary: record.fixtureKey ? summaries[record.fixtureKey][language] : record.observations.length === 0 ? savedDocumentSummary[language] : genericSummary(record.observations, language),
      items,
      doctor_questions: record.fixtureKey ? doctorQuestions[record.fixtureKey][language] : genericQuestions(language),
      duplicates,
      seek_care_if: seekCareIf[language],
    };
  }

  private historyFor(record: ReportRecord, code: string): Array<{ date: string; value: number }> {
    const points = [...this.reports.values()]
      .filter((other) => other.profileId === record.profileId && other.status === "confirmed" && other.issuedAtMs <= record.issuedAtMs)
      .flatMap((other) => {
        const observed = other.observations.find((entry) => entry.code === code);
        return observed ? [{ at: other.issuedAtMs, value: observed.value }] : [];
      })
      .sort((a, b) => a.at - b.at);
    return points.map((point) => ({ date: new Date(point.at).toISOString(), value: point.value }));
  }
}
