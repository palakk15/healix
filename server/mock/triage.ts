import { specialtyLabel } from "@core/domain/labels";
import type { Specialty, Urgency } from "@core/domain/specialty";
import type { LanguageCode } from "@core/i18n/languages";
import type { TriageRequest, TriageResponse } from "@core/api/schemas/ai";
import { detectLanguage } from "@core/domain/languageDetect";

type Localized = Record<LanguageCode, string>;

interface RedFlagRule {
  id: string;
  specialty: Specialty;
  label: Localized;
  matches: (text: string) => boolean;
}

interface SpecialtyRule {
  specialty: Specialty;
  patterns: RegExp[];
}

const devanagariDigits = "०१२३४५६७८९";

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[०-९]/g, (digit) => String(devanagariDigits.indexOf(digit)))
    .replace(/\s+/g, " ")
    .trim();
}

const any = (text: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

const chestPain = [/chest (pain|tightness|pressure)|pain in (the |my )?chest|सीने (में )?दर्द|छाती (में )?(दर्द|दुख)|छातीत (दुख|दाब)|seene mein dard|chhati (mein )?dard|chhatit dukh/];
const sweating = [/sweat|perspir|पसीना|पसीने|घाम|pasina|pasine|ghaam/];
const fever = [/fever|temperature|बुखार|ताप|bukhar|taap/];
const babyWords = [/baby|infant|newborn|बच्चे|बच्चा|बाळ|नवजात|bachch|bacche|navjaat/];
const bleeding = [/bleed|blood|खून|रक्त|bleeding|khoon|spotting/];
const pregnancy = [/pregnan|गर्भवती|प्रेग्नेंट|गरोदर|garbhvati|garbh/];

function babyUnderThreeMonths(text: string): boolean {
  if (!any(text, babyWords)) return false;
  const months = text.match(/(\d+)\s*(month|months|mahine|mahina|महीने|महीना|महिन्याचा|महिन्यांचा|मास)/);
  if (months?.[1] !== undefined && Number(months[1]) < 3) return true;
  const weeks = text.match(/(\d+)\s*(week|weeks|hafte|हफ्ते|आठवड्यांचा|आठवड्याचा)/);
  if (weeks?.[1] !== undefined && Number(weeks[1]) <= 12) return true;
  return /newborn|नवजात|navjaat/.test(text);
}

const redFlagRules: RedFlagRule[] = [
  {
    id: "chest_pain_sweating",
    specialty: "Cardiology",
    label: { en: "Chest pain with sweating", hi: "सीने में दर्द के साथ पसीना", mr: "छातीत दुखणे आणि घाम", hinglish: "Seene mein dard aur pasina" },
    matches: (text) => any(text, chestPain) && any(text, sweating),
  },
  {
    id: "breathing_trouble",
    specialty: "Pulmonology",
    label: { en: "Trouble breathing", hi: "साँस लेने में तकलीफ़", mr: "श्वास घेण्यास त्रास", hinglish: "Saans lene mein takleef" },
    matches: (text) =>
      any(text, [
        /(trouble|difficulty|hard|struggling|can'?t|cannot|short(ness)? of|gasping for)( in| to)? breath(e|ing)?|breathless/,
        /सांस (लेने में )?(तकलीफ|दिक्कत|फूल)|साँस (लेने में )?(तकलीफ|दिक्कत|फूल)|दम (घुट|फूल)/,
        /श्वास (घ्यायला|घेण्यास) (त्रास|अडचण)|दम लागतो|धाप लागते/,
        /saans (lene mein )?(takleef|dikkat|phool)|dum (ghut|phool)/,
      ]),
  },
  {
    id: "face_drooping",
    specialty: "Neurology",
    label: { en: "Face drooping", hi: "चेहरा एक तरफ़ लटकना", mr: "चेहरा एका बाजूला वाकडा होणे", hinglish: "Chehra ek taraf latakna" },
    matches: (text) =>
      any(text, [
        /face (is )?(droop|drooping|drooped|dropping|crooked|sagging)|droop(ing)? (of )?(the |my )?face|slurred speech/,
        /चेहरा (टेढ़ा|एक तरफ|लटक)|मुँह (टेढ़ा|एक तरफ)/,
        /चेहरा वाकडा|तोंड वाकडे|चेहरा एका बाजूला/,
        /chehra (tedha|latak)|mooh tedha|munh tedha/,
      ]),
  },
  {
    id: "sudden_severe_headache",
    specialty: "Neurology",
    label: { en: "Sudden severe headache", hi: "अचानक बहुत तेज़ सिरदर्द", mr: "अचानक खूप तीव्र डोकेदुखी", hinglish: "Achanak bahut tez sir dard" },
    matches: (text) =>
      any(text, [
        /(sudden|worst|thunderclap).{0,30}headache|headache.{0,30}(sudden|worst|thunderclap)/,
        /अचानक.{0,25}(तेज|बहुत|भयंकर).{0,25}(सिर|सर|सिरदर्द|सरदर्द)/,
        /अचानक.{0,30}(डोके|डोकेदुखी)/,
        /achanak.{0,25}(sir|sar).{0,15}dard/,
      ]),
  },
  {
    id: "heavy_bleeding",
    specialty: "General Physician",
    label: { en: "Heavy bleeding", hi: "बहुत ज़्यादा खून बहना", mr: "खूप रक्तस्राव", hinglish: "Bahut zyada khoon behna" },
    matches: (text) =>
      any(text, [
        /(heavy|severe|profuse|a lot of|won'?t stop|not stopping).{0,15}bleed|bleeding.{0,25}(heavy|won'?t stop|not stopping|a lot)/,
        /बहुत (ज़्यादा |ज्यादा )?खून|खून (नहीं )?रुक(ता)? नहीं|रक्तस्राव/,
        /खूप (रक्त|रक्तस्त्राव|रक्तस्राव)|रक्त थांबत नाही/,
        /bahut (zyada )?khoon|khoon nahi ruk/,
      ]),
  },
  {
    id: "fits",
    specialty: "Neurology",
    label: { en: "Fits or seizure", hi: "दौरे या मिर्गी", mr: "फिट्स किंवा आकडी", hinglish: "Daure ya mirgi" },
    matches: (text) =>
      any(text, [/seizure|convuls|\bfits?\b|having a fit/, /मिर्गी|दौरा (पड़|आ)|झटके/, /आकडी|फिट (आली|येत)|फिट्स/, /mirgi|daura pad|jhatke/]),
  },
  {
    id: "fainting",
    specialty: "General Physician",
    label: { en: "Fainting", hi: "बेहोश होना", mr: "भोवळ किंवा बेशुद्ध होणे", hinglish: "Behosh hona" },
    matches: (text) => any(text, [/faint|passed out|pass out|unconscious|collapsed/, /बेहोश|चक्कर खाकर गिर/, /भोवळ|बेशुद्ध/, /behosh|chakkar (aa|khaa)/]),
  },
  {
    id: "baby_fever",
    specialty: "Pediatrics",
    label: { en: "Fever in a baby under 3 months", hi: "3 महीने से छोटे बच्चे में बुखार", mr: "3 महिन्यांपेक्षा लहान बाळाला ताप", hinglish: "3 mahine se chhote bachche ko bukhar" },
    matches: (text) => any(text, fever) && babyUnderThreeMonths(text),
  },
  {
    id: "pregnancy_bleeding",
    specialty: "Gynecology and Obstetrics",
    label: { en: "Bleeding during pregnancy", hi: "गर्भावस्था में खून आना", mr: "गरोदरपणात रक्तस्राव", hinglish: "Pregnancy mein khoon aana" },
    matches: (text) => any(text, pregnancy) && any(text, bleeding),
  },
  {
    id: "poisoning",
    specialty: "General Physician",
    label: { en: "Possible poisoning", hi: "ज़हर खाने की आशंका", mr: "विषबाधेची शक्यता", hinglish: "Zeher khane ki ashanka" },
    matches: (text) =>
      any(text, [
        /poison|overdose|swallowed.{0,15}(bleach|pesticide|acid|kerosene|tablets|pills)|drank.{0,15}(bleach|pesticide|acid|kerosene)/,
        /ज़हर|जहर|कीटनाशक/,
        /विष(बाधा)?|कीटकनाशक/,
        /zeher|jahar|keetnashak/,
      ]),
  },
  {
    id: "self_harm",
    specialty: "Psychiatry",
    label: { en: "Thoughts of self-harm", hi: "खुद को नुकसान पहुँचाने के विचार", mr: "स्वतःला इजा करण्याचे विचार", hinglish: "Khud ko nuksan pahunchane ke vichar" },
    matches: (text) =>
      any(text, [
        /(want to|going to|thinking of|think of|plan to) (die|kill myself|end my life|harm myself)|suicid|kill myself|end my life/,
        /मरना चाहत|आत्महत्या|जान दे/,
        /मरावेसे वाटते|जीव द्यावा|जीव देणार|आत्महत्येचे/,
        /atmahatya|marna chah|jaan dena/,
      ]),
  },
];

const specialtyRules: SpecialtyRule[] = [
  { specialty: "Gastroenterology", patterns: [/stomach|abdomen|abdominal|belly|acidity|heartburn|indigestion|bloating|vomit|nausea|constipation|diarrh|loose motion|stool|\bgas\b/, /पेट|जलन|एसिडिटी|अपच|उल्टी|दस्त|कब्ज|गैस/, /पोटात|पोट|जळजळ|उलटी|जुलाब|बद्धकोष्ठ|पचन|आम्लपित्त/, /\bpet\b|jalan|ulti|dast|kabz|pachan/] },
  { specialty: "Cardiology", patterns: [/palpitation|heart (racing|beat|pain|problem)|high bp|blood pressure/, /धड़कन|दिल (की|में)|हृदय|ब्लड प्रेशर/, /धडधड|हृदय|रक्तदाब|ब्लड प्रेशर/, /dhadkan|dil (ki|mein)|\bbp\b/] },
  { specialty: "Pulmonology", patterns: [/cough|wheez|asthma|lungs?|phlegm|breathless/, /खांसी|खाँसी|सांस|साँस|दमा|बलगम/, /खोकला|दमा|कफ|श्वास/, /khansi|saans|dama|balgam/] },
  { specialty: "Neurology", patterns: [/migraine|dizz|numb|tingling|tremor|memory loss|vertigo/, /चक्कर|सुन्न|झुनझुनी|माइग्रेन|कंपन/, /चक्कर|मुंग्या|सुन्न|मायग्रेन|हातपाय थरथर/, /chakkar|sunn|jhunjhuni|migraine/] },
  { specialty: "Orthopedics", patterns: [/knee|joint|back pain|bone|fracture|sprain|shoulder|neck pain|arthritis|ankle|hip pain/, /घुटन|जोड़|कमर दर्द|हड्डी|मोच|कंधे/, /गुडघ|सांधे|पाठदुखी|कंबर|हाड|मोच|खांदा/, /ghutn|jod|kamar dard|haddi/] },
  { specialty: "Dermatology", patterns: [/rash|itch|skin|acne|pimple|eczema|hair fall|fungal|dandruff/, /दाने|खुजली|त्वचा|फोड़े|मुँहासे|बाल झड़/, /खाज|पुरळ|त्वचे|केस गळ|मुरुम/, /daane|khujli|twacha|baal jhad/] },
  { specialty: "ENT", patterns: [/\bear\b|ears|throat|nose|sinus|tonsil|hearing|blocked nose/, /कान|गला|नाक|साइनस|टॉन्सिल/, /कान|घसा|नाक|सायनस|टॉन्सिल/, /kaan|\bgala\b|naak/] },
  { specialty: "Ophthalmology", patterns: [/\beyes?\b|vision|blurry|red eye|eyesight/, /आंख|आँख|नजर|धुंधला/, /डोळे|डोळ्यां|दिसत नाही|नजर/, /aankh|nazar|dhundhla/] },
  { specialty: "Gynecology and Obstetrics", patterns: [/period|menstrual|pregnan|vaginal|pcod|pcos|white discharge/, /माहवारी|पीरियड|गर्भ|सफेद पानी/, /मासिक पाळी|गरोदर|गर्भ|पाळी/, /mahwari|masik|garbh|periods/] },
  { specialty: "Pediatrics", patterns: [/child|baby|infant|toddler|my son|my daughter/, /बच्चे|बच्चा|बच्ची/, /बाळ|लहान मुल|मुलाला|मुलीला/, /bachch|bacche/] },
  { specialty: "Psychiatry", patterns: [/anxiety|anxious|depress|panic|can'?t sleep|insomnia|stress|mood|feeling sad/, /चिंता|घबराहट|उदास|नींद नहीं|तनाव/, /काळजी वाटते|झोप येत नाही|उदास|नैराश्य|ताण/, /ghabrahat|udaas|neend nahi|tanav/] },
  { specialty: "Urology", patterns: [/urine|urinary|burning urination|kidney stone|prostate|pee\b/, /पेशाब|मूत्र/, /लघवी|मूत्र/, /peshab|mutra/] },
  { specialty: "Endocrinology", patterns: [/thyroid|diabetes|blood sugar|hormone|weight gain/, /थायराइड|मधुमेह|शुगर|डायबिटीज/, /थायरॉईड|मधुमेह|साखर|डायबेटीस/, /thyroid|sugar badh|diabetes/] },
  { specialty: "Nephrology", patterns: [/kidney|swelling (in|of) (the )?(feet|legs)|creatinine/, /गुर्दे|किडनी|पैरों में सूजन/, /मूत्रपिंड|किडनी|पायांवर सूज/, /gurde|kidney/] },
  { specialty: "Dentistry", patterns: [/tooth|teeth|\bgums?\b|dental|cavity|toothache/, /दांत|दाँत|मसूड़े/, /दात|हिरड्या/, /daant|\bdant\b/] },
  { specialty: "General Physician", patterns: [/fever|cold\b|body ache|weakness|fatigue|headache|tired/, /सिर|सर में|बुखार|सर्दी|कमजोरी|थकान/, /ताप|डोके|अंगदुखी|अशक्तपणा|थकवा|सर्दी/, /bukhar|sardi|kamzori|sir dard|thakan/] },
];

const routineSpecialties: Specialty[] = ["Orthopedics", "Dermatology", "Dentistry", "Endocrinology"];

const urgentPatterns = [
  /unbearable|worst pain|severe pain|can'?t (pass urine|walk|eat|drink)|blood in (stool|urine|vomit)|black stool|vomiting blood/,
  /असहनीय|सहन नहीं|मल में खून|पेशाब में खून|काला मल|खून की उल्टी/,
  /असह्य|सहन होत नाही|शौचातून रक्त|लघवीतून रक्त|रक्ताची उलटी|काळे शौच/,
  /sahan nahi|khoon ki ulti|kala stool|stool mein khoon/,
];

const disclaimers: Localized = {
  en: "This is guidance, not a diagnosis.",
  hi: "यह मार्गदर्शन है, निदान नहीं।",
  mr: "हे मार्गदर्शन आहे, निदान नाही.",
  hinglish: "Yeh guidance hai, diagnosis nahi.",
};

const reasoningCopy = {
  described: {
    en: (text: string) => `You described: “${text}”`,
    hi: (text: string) => `आपने बताया: “${text}”`,
    mr: (text: string) => `तुम्ही सांगितले: “${text}”`,
    hinglish: (text: string) => `Aapne bataya: “${text}”`,
  } satisfies Record<LanguageCode, (text: string) => string>,
  safe: {
    en: "No danger signs such as chest pain, trouble breathing or heavy bleeding were found",
    hi: "सीने में दर्द, साँस की तकलीफ़ या ज़्यादा खून बहने जैसे ख़तरे के संकेत नहीं मिले",
    mr: "छातीत दुखणे, श्वास घेण्यास त्रास किंवा जास्त रक्तस्राव यांसारखी धोक्याची चिन्हे आढळली नाहीत",
    hinglish: "Seene mein dard, saans ki takleef ya zyada khoon behne jaise khatre ke sanket nahi mile",
  } satisfies Localized,
  conclusion: {
    en: (plain: string) => `These symptoms are usually checked by a ${plain}`,
    hi: (plain: string) => `ऐसे लक्षण आमतौर पर ${plain} देखते हैं`,
    mr: (plain: string) => `अशी लक्षणे सहसा ${plain} तपासतात`,
    hinglish: (plain: string) => `Aise lakshan aam taur par ${plain} dekhte hain`,
  } satisfies Record<LanguageCode, (plain: string) => string>,
  flagFound: {
    en: (flag: string) => `${flag} was found in what you described`,
    hi: (flag: string) => `आपके बताए लक्षणों में ${flag} मिला`,
    mr: (flag: string) => `तुम्ही सांगितलेल्या लक्षणांमध्ये ${flag} आढळले`,
    hinglish: (flag: string) => `Aapke bataye lakshanon mein ${flag} mila`,
  } satisfies Record<LanguageCode, (flag: string) => string>,
  emergencyNow: {
    en: "This can be serious. Please get emergency help now",
    hi: "यह गंभीर हो सकता है। अभी आपातकालीन मदद लें",
    mr: "हे गंभीर असू शकते. आत्ताच आपत्कालीन मदत घ्या",
    hinglish: "Yeh gambhir ho sakta hai. Abhi emergency madad lein",
  } satisfies Localized,
};

const headacheQuestion = {
  question: {
    en: "Did the headache start suddenly and feel like the worst ever?",
    hi: "क्या सिरदर्द अचानक शुरू हुआ और अब तक का सबसे तेज़ लग रहा है?",
    mr: "डोकेदुखी अचानक सुरू झाली आणि आतापर्यंतची सर्वात तीव्र वाटते का?",
    hinglish: "Kya sir dard achanak shuru hua aur ab tak ka sabse tez lag raha hai?",
  } satisfies Localized,
  options: {
    en: ["Yes, suddenly", "No, it built up slowly"],
    hi: ["हाँ, अचानक", "नहीं, धीरे-धीरे बढ़ा"],
    mr: ["हो, अचानक", "नाही, हळूहळू वाढली"],
    hinglish: ["Haan, achanak", "Nahi, dheere-dheere badha"],
  } satisfies Record<LanguageCode, string[]>,
};

interface ScriptedCase {
  text: string;
  language: LanguageCode;
  specialty: Specialty;
  urgency: Urgency;
  reasoning: string[];
  red_flags: string[];
  confidence: number;
  followUp?: boolean;
}

const scriptedCases: ScriptedCase[] = [
  {
    text: "जेवल्यानंतर पोटात जळजळ होते, तीन दिवसांपासून",
    language: "mr",
    specialty: "Gastroenterology",
    urgency: "soon",
    reasoning: [
      "जेवल्यानंतर वरच्या पोटात जळजळ, तीन दिवसांपासून",
      "रक्ताची उलटी किंवा काळे शौच यांसारखी धोक्याची चिन्हे आढळली नाहीत",
      "अशा लक्षणांची तपासणी सहसा पोट आणि पचनाचे तज्ज्ञ करतात",
    ],
    red_flags: [],
    confidence: 0.78,
  },
  {
    text: "Do din se pet mein jalan ho rahi hai",
    language: "hinglish",
    specialty: "Gastroenterology",
    urgency: "soon",
    reasoning: [
      "Do din se pet mein jalan",
      "Khoon ki ulti ya kale stool jaise khatre ke sanket nahi mile",
      "Aise lakshan aam taur par pet aur pachan ke specialist dekhte hain",
    ],
    red_flags: [],
    confidence: 0.76,
  },
  {
    text: "मुझे दो दिन से सिर में बहुत दर्द है",
    language: "hi",
    specialty: "General Physician",
    urgency: "soon",
    reasoning: [
      "दो दिन से सिर में बहुत दर्द",
      "अब तक अचानक तेज़ दर्द, कमज़ोरी या बोलने में दिक्कत जैसे संकेत नहीं मिले",
      "पहले सामान्य चिकित्सक से जाँच कराना ठीक रहेगा",
    ],
    red_flags: [],
    confidence: 0.64,
    followUp: true,
  },
  {
    text: "Knee pain when climbing stairs for 2 weeks",
    language: "en",
    specialty: "Orthopedics",
    urgency: "routine",
    reasoning: [
      "Knee pain when climbing stairs for 2 weeks",
      "No danger signs such as a recent fall, swelling with fever or being unable to walk",
      "These symptoms are usually checked by a bone and joint specialist",
    ],
    red_flags: [],
    confidence: 0.83,
  },
  {
    text: "chest pain and sweating",
    language: "en",
    specialty: "Cardiology",
    urgency: "emergency",
    reasoning: [
      "Chest pain with sweating",
      "This combination can be a sign of a heart problem that needs care right now",
      "Please call emergency services immediately",
    ],
    red_flags: ["Chest pain with sweating"],
    confidence: 0.95,
  },
  {
    text: "बच्चे को तेज बुखार है, 2 महीने का है",
    language: "hi",
    specialty: "Pediatrics",
    urgency: "emergency",
    reasoning: [
      "2 महीने के बच्चे को तेज़ बुखार",
      "3 महीने से छोटे बच्चे में बुखार को तुरंत डॉक्टर को दिखाना ज़रूरी है",
      "अभी आपातकालीन सेवा को कॉल करें",
    ],
    red_flags: ["3 महीने से छोटे बच्चे में बुखार"],
    confidence: 0.96,
  },
];

function normalizedKey(text: string): string {
  return normalizeText(text).replace(/[.!?।]+$/, "");
}

const scriptedByKey = new Map(scriptedCases.map((entry) => [normalizedKey(entry.text), entry]));

export interface TriageSession {
  id: string;
  request: TriageRequest;
  language: LanguageCode;
  round: number;
  pendingQuestion: string | null;
  pendingYesAnswer: string | null;
}

export interface TriageOutcome {
  response: Omit<TriageResponse, "request_id" | "model" | "prompt_version">;
  session: TriageSession;
}

function snippetOf(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 90 ? `${trimmed.slice(0, 87)}…` : trimmed;
}

function chooseSpecialty(text: string, age: number): { specialty: Specialty; confidence: number } {
  const scored = specialtyRules.map((rule) => ({
    specialty: rule.specialty,
    score: rule.patterns.filter((pattern) => pattern.test(text)).length,
  }));
  if (age <= 12) {
    const pediatrics = scored.find((entry) => entry.specialty === "Pediatrics");
    if (pediatrics) pediatrics.score += 2;
  }
  const best = scored.filter((entry) => entry.score > 0 && entry.specialty !== "General Physician").sort((a, b) => b.score - a.score)[0];
  if (best) return { specialty: best.specialty, confidence: Math.min(0.6 + best.score * 0.1, 0.88) };
  const general = scored.find((entry) => entry.specialty === "General Physician");
  return { specialty: "General Physician", confidence: general && general.score > 0 ? 0.62 : 0.4 };
}

function emergencyOutcome(rule: RedFlagRule, language: LanguageCode, request: TriageRequest, session: TriageSession): TriageOutcome {
  const flag = rule.label[language];
  return {
    session,
    response: {
      language,
      session_id: session.id,
      specialty: rule.specialty,
      urgency: "emergency",
      reasoning: [reasoningCopy.described[language](snippetOf(request.text)), reasoningCopy.flagFound[language](flag), reasoningCopy.emergencyNow[language]],
      follow_up_questions: [],
      red_flags: [flag],
      confidence: 0.93,
      disclaimer: disclaimers[language],
    },
  };
}

export function runTriage(request: TriageRequest, sessionId: string): TriageOutcome {
  const text = normalizeText(request.text);
  const language = (request.language && request.language in disclaimers ? request.language : detectLanguage(request.text)) as LanguageCode;
  const session: TriageSession = { id: sessionId, request, language, round: 0, pendingQuestion: null, pendingYesAnswer: null };

  const scripted = scriptedByKey.get(normalizedKey(request.text));
  if (scripted) {
    const followUps = scripted.followUp
      ? [{ question: headacheQuestion.question[scripted.language], options: headacheQuestion.options[scripted.language] }]
      : [];
    if (scripted.followUp) {
      session.pendingQuestion = headacheQuestion.question[scripted.language];
      session.pendingYesAnswer = headacheQuestion.options[scripted.language][0] ?? null;
      session.round = 1;
    }
    session.language = scripted.language;
    return {
      session,
      response: {
        language: scripted.language,
        session_id: sessionId,
        specialty: scripted.specialty,
        urgency: scripted.urgency,
        reasoning: scripted.reasoning,
        follow_up_questions: followUps,
        red_flags: scripted.red_flags,
        confidence: scripted.confidence,
        disclaimer: disclaimers[scripted.language],
      },
    };
  }

  const firedFlag = redFlagRules.find((rule) => rule.matches(text));
  if (firedFlag) return emergencyOutcome(firedFlag, language, request, session);

  const { specialty, confidence } = chooseSpecialty(text, request.age);
  let urgency: Urgency = routineSpecialties.includes(specialty) ? "routine" : "soon";
  if (any(text, urgentPatterns)) urgency = "urgent";

  const asksHeadache = /headache|सिरदर्द|सर दर्द|सिर में दर्द|सिर दर्द|डोकेदुखी|डोके दुखते|sir dard/.test(text);
  const followUps =
    asksHeadache && specialty === "General Physician"
      ? [{ question: headacheQuestion.question[language], options: headacheQuestion.options[language] }]
      : [];
  if (followUps.length > 0) {
    session.round = 1;
    session.pendingQuestion = headacheQuestion.question[language];
    session.pendingYesAnswer = headacheQuestion.options[language][0] ?? null;
  }

  const plain = specialtyLabel(specialty, language).plain;
  return {
    session,
    response: {
      language,
      session_id: sessionId,
      specialty,
      urgency,
      reasoning: [reasoningCopy.described[language](snippetOf(request.text)), reasoningCopy.safe[language], reasoningCopy.conclusion[language](plain)],
      follow_up_questions: followUps,
      red_flags: [],
      confidence,
      disclaimer: disclaimers[language],
    },
  };
}

export function answerTriage(
  session: TriageSession,
  answers: Array<{ question: string; answer: string }>,
): TriageOutcome["response"] {
  const language = session.language;
  const answeredYes = session.pendingYesAnswer !== null && answers.some((entry) => entry.answer.trim() === session.pendingYesAnswer);
  session.round = Math.min(session.round + 1, 2);
  session.pendingQuestion = null;

  if (answeredYes) {
    const rule = redFlagRules.find((entry) => entry.id === "sudden_severe_headache");
    if (rule) return emergencyOutcome(rule, language, session.request, session).response;
  }

  const plain = specialtyLabel("General Physician", language).plain;
  const echo = answers.map((entry) => entry.answer).join(", ");
  return {
    language,
    session_id: session.id,
    specialty: "General Physician",
    urgency: "soon",
    reasoning: [reasoningCopy.described[language](snippetOf(`${session.request.text} · ${echo}`)), reasoningCopy.safe[language], reasoningCopy.conclusion[language](plain)],
    follow_up_questions: [],
    red_flags: [],
    confidence: 0.7,
    disclaimer: disclaimers[language],
  };
}

export const scriptedDemoPhrases = scriptedCases.map((entry) => entry.text);

export { detectLanguage };
