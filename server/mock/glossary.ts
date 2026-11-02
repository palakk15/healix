import type { LanguageCode } from "@core/i18n/languages";

type Localized = Record<LanguageCode, string>;

const t = (en: string, hi: string, mr: string, hinglish: string): Localized => ({ en, hi, mr, hinglish });

export interface GlossaryAnalyte {
  code: string;
  pattern: RegExp;
  display: string;
  what: Localized;
}

export const glossaryAnalytes: GlossaryAnalyte[] = [
  {
    code: "HBA1C",
    display: "HbA1c",
    pattern: /hb\s?a\s?[1lI]\s?c|a1c|glyc(?:ated|osylated)|एचबीए1सी|एच\.?बी\.?ए\.?1\.?सी/i,
    what: t(
      "HbA1c shows your average blood sugar over the last two to three months.",
      "HbA1c पिछले दो से तीन महीनों की आपकी औसत रक्त शर्करा दिखाता है।",
      "HbA1c गेल्या दोन ते तीन महिन्यांची तुमची सरासरी रक्तातील साखर दाखवतो.",
      "HbA1c pichhle do se teen mahine ki aapki average blood sugar dikhata hai.",
    ),
  },
  {
    code: "FBS",
    display: "Fasting glucose",
    pattern: /fasting\s+(?:blood\s+)?(?:glucose|sugar)|\bfbs\b|\bfbg\b|फास्टिंग|उपाशी(?:पोटी)?\s*(?:साखर|ग्लुकोज)/i,
    what: t(
      "Fasting glucose is your blood sugar after at least eight hours without food.",
      "फास्टिंग ग्लूकोज़ कम से कम आठ घंटे बिना खाए की आपकी रक्त शर्करा है।",
      "उपाशीपोटी ग्लुकोज म्हणजे किमान आठ तास अन्नाशिवाय असलेली तुमची रक्तातील साखर.",
      "Fasting glucose kam se kam aath ghante bina khaaye ki aapki blood sugar hai.",
    ),
  },
  {
    code: "PPBS",
    display: "Post-meal glucose",
    pattern: /post\s*[-]?\s*(?:prandial|meal)|\bppbs\b|\bppg\b|खाने के बाद.*शुगर|जेवणानंतर.*साखर/i,
    what: t(
      "Post-meal glucose is your blood sugar about two hours after eating.",
      "खाने के बाद की ग्लूकोज़ खाने के लगभग दो घंटे बाद की आपकी रक्त शर्करा है।",
      "जेवणानंतरची ग्लुकोज म्हणजे जेवणानंतर सुमारे दोन तासांनी तुमची रक्तातील साखर.",
      "Khane ke baad ki glucose khane ke lagbhag do ghante baad ki aapki blood sugar hai.",
    ),
  },
  {
    code: "RBS",
    display: "Random glucose",
    pattern: /random\s+(?:blood\s+)?(?:glucose|sugar)|\brbs\b/i,
    what: t(
      "Random glucose is your blood sugar measured at any time of the day, without fasting.",
      "रैंडम ग्लूकोज़ दिन के किसी भी समय, बिना फास्टिंग के मापी गई आपकी रक्त शर्करा है।",
      "रँडम ग्लुकोज म्हणजे दिवसाच्या कोणत्याही वेळी, उपाशी न राहता मोजलेली तुमची रक्तातील साखर.",
      "Random glucose din ke kisi bhi samay, bina fasting ke maapi gayi aapki blood sugar hai.",
    ),
  },
  {
    code: "TC",
    display: "Total cholesterol",
    pattern: /total\s+cholesterol|cholesterol\s*,?\s*total|\bcholesterol\b|कोलेस्ट्रॉल|कोलेस्टेरॉल/i,
    what: t(
      "Total cholesterol is the overall amount of fatty substances in your blood, including the helpful and the harmful kinds.",
      "कुल कोलेस्ट्रॉल आपके खून में चिकनाई वाले पदार्थों की कुल मात्रा है, जिसमें फ़ायदेमंद और नुकसानदेह दोनों शामिल हैं।",
      "एकूण कोलेस्टेरॉल म्हणजे तुमच्या रक्तातील चरबीयुक्त पदार्थांचे एकूण प्रमाण, ज्यात उपयुक्त आणि हानिकारक दोन्ही प्रकार येतात.",
      "Kul cholesterol aapke khoon mein chikne padarthon ki kul matra hai, jismein faydemand aur nuksandeh dono shamil hain.",
    ),
  },
  {
    code: "TG",
    display: "Triglycerides",
    pattern: /triglycerides?|\btg\b|ट्राइग्लिसराइड|ट्रायग्लिसराइड/i,
    what: t(
      "Triglycerides are a type of fat in your blood. They rise after sugary or fatty food and with extra weight.",
      "ट्राइग्लिसराइड आपके खून में मौजूद एक तरह की चर्बी है। मीठे या चिकने भोजन और ज़्यादा वज़न से यह बढ़ती है।",
      "ट्रायग्लिसराइड हा तुमच्या रक्तातील एक चरबीचा प्रकार आहे. गोड किंवा तेलकट अन्न आणि जास्त वजनामुळे तो वाढतो.",
      "Triglyceride aapke khoon mein maujood ek tarah ki charbi hai. Meethe ya chikne bhojan aur zyada wazan se yeh badhti hai.",
    ),
  },
  {
    code: "HDL",
    display: "HDL cholesterol",
    pattern: /\bhdl\b|एचडीएल/i,
    what: t(
      "HDL is the helpful cholesterol that carries extra cholesterol away from your arteries. Higher is better.",
      "HDL फ़ायदेमंद कोलेस्ट्रॉल है जो अतिरिक्त कोलेस्ट्रॉल को धमनियों से दूर ले जाता है। ज़्यादा होना बेहतर है।",
      "HDL हे उपयुक्त कोलेस्टेरॉल आहे जे अतिरिक्त कोलेस्टेरॉल धमन्यांपासून दूर नेते. जास्त असणे चांगले.",
      "HDL faydemand cholesterol hai jo atirikt cholesterol ko dhamaniyon se door le jaata hai. Zyada hona behtar hai.",
    ),
  },
  {
    code: "LDL",
    display: "LDL cholesterol",
    pattern: /\bldl\b|एलडीएल/i,
    what: t(
      "LDL is the harmful cholesterol that can build up inside your arteries. Lower is better.",
      "LDL नुकसानदेह कोलेस्ट्रॉल है जो धमनियों के अंदर जम सकता है। कम होना बेहतर है।",
      "LDL हे हानिकारक कोलेस्टेरॉल आहे जे धमन्यांच्या आत साचू शकते. कमी असणे चांगले.",
      "LDL nuksandeh cholesterol hai jo dhamaniyon ke andar jam sakta hai. Kam hona behtar hai.",
    ),
  },
  {
    code: "HB",
    display: "Haemoglobin",
    pattern: /\bha?emoglobin\b(?!\s*a\s?[1lI])|\bhb\b|\bhgb\b|हीमोग्लोबिन|हिमोग्लोबिन/i,
    what: t(
      "Haemoglobin is the protein in red blood cells that carries oxygen around your body.",
      "हीमोग्लोबिन लाल रक्त कोशिकाओं का वह प्रोटीन है जो शरीर में ऑक्सीजन पहुँचाता है।",
      "हिमोग्लोबिन हे लाल रक्तपेशींमधील प्रथिन आहे जे शरीरभर ऑक्सिजन पोहोचवते.",
      "Haemoglobin laal rakt koshikaon ka woh protein hai jo sharir mein oxygen pahunchata hai.",
    ),
  },
  {
    code: "WBC",
    display: "White blood cells",
    pattern: /white\s+blood\s+cell|\bwbc\b|total\s+leu[ck]ocyte|\btlc\b|श्वेत रक्त|पांढऱ्या रक्त|डब्ल्यूबीसी/i,
    what: t(
      "White blood cells are the cells that fight infection.",
      "श्वेत रक्त कोशिकाएँ वे कोशिकाएँ हैं जो संक्रमण से लड़ती हैं।",
      "पांढऱ्या रक्तपेशी म्हणजे संसर्गाशी लढणाऱ्या पेशी.",
      "Shwet rakt koshikayen woh koshikayen hain jo sankraman se ladti hain.",
    ),
  },
  {
    code: "PLT",
    display: "Platelets",
    pattern: /platelet|\bplt\b|प्लेटलेट|प्लेटलेट्स/i,
    what: t(
      "Platelets are tiny cells that help your blood clot when you are injured.",
      "प्लेटलेट छोटी कोशिकाएँ हैं जो चोट लगने पर खून को जमने में मदद करती हैं।",
      "प्लेटलेट या लहान पेशी आहेत ज्या दुखापत झाल्यावर रक्त गोठण्यास मदत करतात.",
      "Platelet chhoti koshikayen hain jo chot lagne par khoon ko jamne mein madad karti hain.",
    ),
  },
  {
    code: "RBC",
    display: "Red blood cells",
    pattern: /red\s+blood\s+cell|\brbc\b|red\s+cell\s+count|लाल रक्त|लाल रक्तपेशी|आरबीसी/i,
    what: t(
      "Red blood cells carry oxygen from your lungs to the rest of your body.",
      "लाल रक्त कोशिकाएँ फेफड़ों से बाकी शरीर तक ऑक्सीजन ले जाती हैं।",
      "लाल रक्तपेशी फुफ्फुसांतून उर्वरित शरीरापर्यंत ऑक्सिजन नेतात.",
      "Laal rakt koshikayen fefdon se baaki sharir tak oxygen le jaati hain.",
    ),
  },
  {
    code: "VITD",
    display: "Vitamin D",
    pattern: /vitamin\s*d|25\s*[-]?\s*(?:oh|hydroxy)|विटामिन डी|व्हिटॅमिन डी|व्हिटामिन डी/i,
    what: t(
      "Vitamin D helps your body absorb calcium for strong bones and muscles.",
      "विटामिन डी शरीर को मज़बूत हड्डियों और मांसपेशियों के लिए कैल्शियम सोखने में मदद करता है।",
      "व्हिटॅमिन डी मजबूत हाडे आणि स्नायूंसाठी शरीराला कॅल्शियम शोषून घेण्यास मदत करते.",
      "Vitamin D sharir ko mazboot haddiyon aur maansapeshiyon ke liye calcium sokhne mein madad karta hai.",
    ),
  },
  {
    code: "VITB12",
    display: "Vitamin B12",
    pattern: /vitamin\s*b\s?[-]?\s?12|\bb\s?12\b|cobalamin|विटामिन बी12|व्हिटॅमिन बी12/i,
    what: t(
      "Vitamin B12 keeps your nerves and blood cells healthy.",
      "विटामिन B12 आपकी नसों और रक्त कोशिकाओं को स्वस्थ रखता है।",
      "व्हिटॅमिन B12 तुमच्या नसा आणि रक्तपेशी निरोगी ठेवते.",
      "Vitamin B12 aapki nason aur rakt koshikaon ko swasth rakhta hai.",
    ),
  },
  {
    code: "TSH",
    display: "TSH",
    pattern: /\btsh\b|thyroid|टीएसएच|थायरॉइड|थायरॉईड|थायरॉयड/i,
    what: t(
      "TSH is a hormone from the brain that tells your thyroid gland how much to work.",
      "TSH दिमाग से आने वाला हार्मोन है जो थायरॉइड ग्रंथि को बताता है कि कितना काम करना है।",
      "TSH हे मेंदूकडून येणारे संप्रेरक आहे जे थायरॉइड ग्रंथीला किती काम करायचे ते सांगते.",
      "TSH dimaag se aane wala hormone hai jo thyroid gland ko batata hai ki kitna kaam karna hai.",
    ),
  },
  {
    code: "CREAT",
    display: "Creatinine",
    pattern: /creatinine|क्रिएटिनिन|क्रिएटिनीन/i,
    what: t(
      "Creatinine is a waste product that healthy kidneys filter out of your blood.",
      "क्रिएटिनिन एक अपशिष्ट पदार्थ है जिसे स्वस्थ गुर्दे खून से छान देते हैं।",
      "क्रिएटिनिन हा एक टाकाऊ पदार्थ आहे जो निरोगी मूत्रपिंडे रक्तातून गाळून काढतात.",
      "Creatinine ek apshisht padarth hai jise swasth gurde khoon se chhaan dete hain.",
    ),
  },
  {
    code: "ALT",
    display: "ALT (SGPT)",
    pattern: /\balt\b|sgpt|एसजीपीटी/i,
    what: t(
      "ALT is an enzyme found mostly in the liver, and it rises when the liver is irritated.",
      "ALT मुख्य रूप से लिवर में पाया जाने वाला एंज़ाइम है, जो लिवर में जलन होने पर बढ़ता है।",
      "ALT हे मुख्यतः यकृतात आढळणारे एन्झाइम आहे, जे यकृताला त्रास झाल्यावर वाढते.",
      "ALT mukhya roop se liver mein paya jaane wala enzyme hai, jo liver mein jalan hone par badhta hai.",
    ),
  },
  {
    code: "AST",
    display: "AST (SGOT)",
    pattern: /\bast\b|sgot|एसजीओटी/i,
    what: t(
      "AST is an enzyme found in the liver, heart and muscles, and it rises when these are strained.",
      "AST लिवर, दिल और मांसपेशियों में पाया जाने वाला एंज़ाइम है, जो इन पर ज़ोर पड़ने पर बढ़ता है।",
      "AST हे यकृत, हृदय आणि स्नायूंमध्ये आढळणारे एन्झाइम आहे, जे यांच्यावर ताण आल्यावर वाढते.",
      "AST liver, dil aur maansapeshiyon mein paya jaane wala enzyme hai, jo inpar zor padne par badhta hai.",
    ),
  },
];

export interface GlossaryTerm {
  id: "range" | "flags" | "unit" | "fasting" | "critical";
  pattern: RegExp;
  strong?: RegExp;
  needsContext: boolean;
  text: Localized;
}

export const glossaryTerms: GlossaryTerm[] = [
  {
    id: "range",
    pattern: /reference\s+range|usual\s+range|normal\s+range|\brange\b|सामान्य सीमा|रेफरेंस|रेंज|सामान्य मर्यादा|मर्यादा/i,
    strong: /reference\s+range|usual\s+range|normal\s+range|सामान्य सीमा|रेफरेंस रेंज|रेफरन्स रेंज|सामान्य मर्यादा/i,
    needsContext: true,
    text: t(
      "A reference range, also called the usual or normal range, is the span of values most healthy people have for a test. A value outside it is not a diagnosis, only something to discuss with your doctor. Ranges can differ slightly between labs.",
      "रेफ़रेंस रेंज, यानी सामान्य सीमा, किसी जाँच के लिए ज़्यादातर स्वस्थ लोगों के मानों का दायरा है। उससे बाहर का मान निदान नहीं, सिर्फ़ डॉक्टर से चर्चा की बात है। अलग-अलग लैब में सीमा थोड़ी अलग हो सकती है।",
      "रेफरन्स रेंज, म्हणजे सामान्य मर्यादा, म्हणजे त्या तपासणीसाठी बहुतेक निरोगी लोकांच्या मूल्यांची श्रेणी. त्याबाहेरचे मूल्य म्हणजे निदान नाही, फक्त डॉक्टरांशी बोलण्याचा मुद्दा. वेगवेगळ्या लॅबमध्ये मर्यादा थोडी वेगळी असू शकते.",
      "Reference range, yaani saamanya seema, kisi jaanch ke liye zyadatar swasth logon ki values ka daayra hai. Usse bahar ki value diagnosis nahi, sirf doctor se charcha ki baat hai. Alag-alag lab mein range thodi alag ho sakti hai.",
    ),
  },
  {
    id: "flags",
    pattern: /\bhigh\b|\blow\b|\bflag|marked|\b[hl]\b|ऊँच|ऊंच|ज्यादा|ज़्यादा|हाई|लो\b|जास्त|कमी|अधिक/i,
    needsContext: true,
    text: t(
      "H or High next to a value means it is above the usual range, and L or Low means it is below. It points to something to talk about with your doctor, not to a diagnosis.",
      "किसी मान के आगे H या High का मतलब है कि वह सामान्य सीमा से ऊपर है, और L या Low का मतलब है कि वह नीचे है। यह डॉक्टर से बात करने का इशारा है, निदान नहीं।",
      "एखाद्या मूल्यापुढे H किंवा High म्हणजे ते सामान्य मर्यादेपेक्षा जास्त आहे, आणि L किंवा Low म्हणजे ते कमी आहे. हे डॉक्टरांशी बोलण्याचे निमित्त आहे, निदान नाही.",
      "Kisi value ke aage H ya High ka matlab hai ki woh saamanya seema se upar hai, aur L ya Low ka matlab hai ki woh neeche hai. Yeh doctor se baat karne ka ishara hai, diagnosis nahi.",
    ),
  },
  {
    id: "unit",
    pattern: /\bunits?\b|mg\s*\/\s*d[lL]|g\s*\/\s*d[lL]|ng\s*\/\s*m[lL]|यूनिट|इकाई|एकक/i,
    strong: /mg\s*\/\s*d[lL]|g\s*\/\s*d[lL]|ng\s*\/\s*m[lL]/i,
    needsContext: true,
    text: t(
      "The unit tells you how a value is measured. For example, mg/dL means milligrams in a tenth of a litre of blood. Only compare two values when their units are the same.",
      "यूनिट बताती है कि मान कैसे मापा गया है। जैसे mg/dL का मतलब है एक लीटर के दसवें हिस्से खून में मिलीग्राम। दो मानों की तुलना तभी करें जब उनकी यूनिट एक जैसी हो।",
      "युनिट सांगते की मूल्य कसे मोजले आहे. उदा. mg/dL म्हणजे एका लिटरच्या दशांश रक्तातील मिलिग्रॅम. दोन मूल्यांची तुलना तेव्हाच करा जेव्हा त्यांचे युनिट सारखे असेल.",
      "Unit batati hai ki value kaise maapi gayi hai. Jaise mg/dL ka matlab hai ek litre ke dasve hisse khoon mein milligram. Do values ki tulna tabhi karein jab unki unit ek jaisi ho.",
    ),
  },
  {
    id: "fasting",
    pattern: /\bfasting\b|फास्टिंग|उपाशी|खाली पेट|उपाशीपोटी/i,
    needsContext: false,
    text: t(
      "Fasting means not eating or drinking anything except water for about eight hours before the test, so that food does not change the result.",
      "फास्टिंग का मतलब है जाँच से लगभग आठ घंटे पहले पानी के अलावा कुछ न खाना-पीना, ताकि भोजन नतीजे को न बदले।",
      "फास्टिंग म्हणजे तपासणीच्या सुमारे आठ तास आधी पाण्याशिवाय काही न खाणे-पिणे, म्हणजे अन्नाचा निकालावर परिणाम होत नाही.",
      "Fasting ka matlab hai jaanch se lagbhag aath ghante pehle paani ke alawa kuch na khana-peena, taaki bhojan nateeje ko na badle.",
    ),
  },
  {
    id: "critical",
    pattern: /\bcritical\b|क्रिटिकल|गंभीर रूप से|गंभीर मान|अतिगंभीर/i,
    needsContext: false,
    text: t(
      "A critical value is very far outside the usual range. Labs often phone the doctor about these, so please speak to your doctor soon.",
      "क्रिटिकल मान सामान्य सीमा से बहुत दूर होता है। लैब अक्सर ऐसे मानों के बारे में डॉक्टर को फ़ोन करती हैं, इसलिए कृपया जल्द अपने डॉक्टर से बात करें।",
      "क्रिटिकल मूल्य सामान्य मर्यादेपासून खूप दूर असते. लॅब अनेकदा अशा मूल्यांबद्दल डॉक्टरांना फोन करतात, म्हणून कृपया लवकर तुमच्या डॉक्टरांशी बोला.",
      "Critical value saamanya seema se bahut door hoti hai. Lab aksar aisi values ke baare mein doctor ko phone karti hain, isliye kripya jaldi apne doctor se baat karein.",
    ),
  },
];

export const reportContext = /report|result|test|lab|value|reading|number|marked|रिपोर्ट|जाँच|जांच|मान|नतीजा|नतीजे|तपासणी|अहवाल|मूल्य|निकाल|वैल्यू|व्हॅल्यू/i;

export const summaryIntent =
  /(?:explain|summari[sz]e|simplify|read|tell me about)\s+(?:me\s+)?(?:my|the|this|whole|full|entire)\s+(?:whole\s+|full\s+)?report|what(?:'s|\s+is)\s+in\s+(?:my|the|this)\s+report|(?:my|the|this)\s+report\s+(?:say|says|in simple|explained|summary)|मेरी रिपोर्ट.*(?:समझ|बता)|रिपोर्ट.*(?:समझाइए|समझाओ|बताइए|बताओ)|माझा अहवाल.*(?:समज|सांग)|अहवाल.*(?:समजावा|सांगा)|meri report.*(?:samjh|bata)|report samjha/i;

export const greetingPattern =
  /^\s*(?:hi+|hii+|hello+|hey+|hola|yo|good\s*(?:morning|afternoon|evening|night)|namaste|namaskar|namaskaram|नमस्ते|नमस्कार|हेलो|हैलो|हाय|हॅलो|सलाम|pranam|ram ram)(?:\s+(?:there|healix|ai|ji|sir|madam|doctor|bhai))?\s*[!.,?🙏👋]*\s*$/iu;

export const thanksPattern = /^\s*(?:thanks?(?:\s+(?:a lot|you|so much))?|thank\s*you(?:\s+(?:so much|very much))?|thx|ok(?:ay)?\s*thanks?|shukriya|dhanyavaad|dhanyavad|धन्यवाद|शुक्रिया|आभार|आभारी|धन्यवाद)\s*[!.🙏]*\s*$/iu;

export const byePattern = /^\s*(?:bye+|goodbye|good\s*bye|see you|take care|alvida|टाटा|अलविदा|बाय)\s*[!.]*\s*$/iu;

export const helpPattern =
  /^\s*(?:help|help me|what can you do|what do you do|who are you|what are you|how (?:do|can) (?:i|you) use (?:this|you|healix)|how does this work|कैसे (?:काम|इस्तेमाल)|तुम कौन|आप कौन|तू कोण|तुम्ही कोण|kaun ho|kya kar sakte|kaise use)\b.{0,40}[?!.]*\s*$/iu;

export const smallTalk: Record<"greeting" | "thanks" | "bye" | "help", Localized> = {
  greeting: t(
    "Hello! I am Healix AI. Ask me about your uploaded report, what a lab test means, or how to use Healix. For example: \"Is my HbA1c high?\"",
    "नमस्ते! मैं Healix AI हूँ। आप मुझसे अपनी अपलोड की गई रिपोर्ट, किसी जाँच का मतलब, या Healix के इस्तेमाल के बारे में पूछ सकते हैं। जैसे: \"क्या मेरा HbA1c ज़्यादा है?\"",
    "नमस्कार! मी Healix AI आहे. तुम्ही तुमच्या अपलोड केलेल्या अहवालाबद्दल, एखाद्या तपासणीचा अर्थ किंवा Healix कसे वापरायचे याबद्दल विचारू शकता. उदाहरणार्थ: \"माझा HbA1c जास्त आहे का?\"",
    "Namaste! Main Healix AI hoon. Aap apni upload ki hui report, kisi jaanch ka matlab, ya Healix kaise use karein, yeh sab poochh sakte hain. Jaise: \"Kya mera HbA1c zyada hai?\"",
  ),
  thanks: t(
    "You are welcome! Ask me anything else about your report whenever you like.",
    "आपका स्वागत है! अपनी रिपोर्ट के बारे में कुछ और पूछना हो तो कभी भी पूछिए।",
    "तुमचे स्वागत आहे! तुमच्या अहवालाबद्दल आणखी काही विचारायचे असेल तर कधीही विचारा.",
    "Aapka swagat hai! Apni report ke baare mein kuch aur poochhna ho toh kabhi bhi poochhiye.",
  ),
  bye: t(
    "Take care! I am here whenever you want to understand your report.",
    "अपना ध्यान रखिए! रिपोर्ट समझनी हो तो मैं यहीं हूँ।",
    "काळजी घ्या! अहवाल समजून घ्यायचा असेल तेव्हा मी इथे आहे.",
    "Apna khayal rakhiye! Report samajhni ho toh main yahin hoon.",
  ),
  help: t(
    "I can explain the words and numbers in your uploaded reports, tell you whether a value is inside or outside the printed range, summarise a report, and explain lab terms. I cannot diagnose or suggest medicines. Try: \"Explain my report in simple words.\"",
    "मैं आपकी अपलोड की गई रिपोर्ट के शब्द और संख्याएँ समझा सकता हूँ, बता सकता हूँ कि कोई मान छपी सीमा के भीतर है या बाहर, रिपोर्ट का सार दे सकता हूँ और जाँच के शब्द समझा सकता हूँ। मैं निदान या दवा नहीं बता सकता। आज़माइए: \"मेरी रिपोर्ट आसान शब्दों में समझाइए।\"",
    "मी तुमच्या अपलोड केलेल्या अहवालातील शब्द आणि आकडे समजावू शकतो, एखादे मूल्य छापलेल्या मर्यादेत आहे की बाहेर ते सांगू शकतो, अहवालाचा सारांश देऊ शकतो आणि तपासणीचे शब्द समजावू शकतो. मी निदान किंवा औषधे सांगू शकत नाही. करून पहा: \"माझा अहवाल सोप्या शब्दांत समजवा.\"",
    "Main aapki upload ki hui report ke shabd aur numbers samjha sakta hoon, bata sakta hoon ki koi value chhapi seema ke andar hai ya bahar, report ka saar de sakta hoon aur jaanch ke shabd samjha sakta hoon. Main diagnosis ya dawa nahi bata sakta. Try karein: \"Meri report aasan shabdon mein samjhao.\"",
  ),
};

export const offTopicMessage: Localized = {
  en: "I can only answer doubts related to the report.",
  hi: "मैं सिर्फ़ रिपोर्ट से जुड़े सवालों के जवाब दे सकता हूँ।",
  mr: "मी फक्त अहवालाशी संबंधित शंकांची उत्तरे देऊ शकतो.",
  hinglish: "Main sirf report se jude sawaalon ke jawab de sakta hoon.",
};

export const unknownTermMessage: Localized = {
  en: "I do not have that term in my glossary yet. Please ask your doctor, or ask me about a test name shown in your report.",
  hi: "यह शब्द अभी मेरी शब्दावली में नहीं है। कृपया अपने डॉक्टर से पूछें, या अपनी रिपोर्ट में दिखे किसी जाँच का नाम पूछें।",
  mr: "हा शब्द अजून माझ्या शब्दकोशात नाही. कृपया तुमच्या डॉक्टरांना विचारा, किंवा तुमच्या अहवालात दिसणाऱ्या एखाद्या तपासणीच्या नावाबद्दल विचारा.",
  hinglish: "Yeh shabd abhi meri shabdavali mein nahi hai. Kripya apne doctor se poochhein, ya apni report mein dikhe kisi jaanch ka naam poochhein.",
};

export const noReportMessage: Localized = {
  en: "I could not find a confirmed report yet. Upload and confirm one under Reports, then ask me again. You can still ask what a test or a term means.",
  hi: "मुझे अभी कोई पक्की की हुई रिपोर्ट नहीं मिली। रिपोर्ट सेक्शन में एक अपलोड करके पक्की करें, फिर मुझसे दोबारा पूछें। आप फिर भी पूछ सकते हैं कि कोई जाँच या शब्द क्या है।",
  mr: "मला अजून कोणताही निश्चित केलेला अहवाल सापडला नाही. अहवाल विभागात एक अपलोड करून निश्चित करा, मग मला पुन्हा विचारा. तरीही एखादी तपासणी किंवा शब्द म्हणजे काय ते विचारू शकता.",
  hinglish: "Mujhe abhi koi pakki ki hui report nahi mili. Reports section mein ek upload karke pakki karein, phir mujhse dobara poochhein. Aap phir bhi poochh sakte hain ki koi jaanch ya shabd kya hai.",
};

export const mine: Record<"line" | "above" | "below" | "within" | "summaryHead" | "summaryFlag" | "summaryOk" | "summaryAllOk", Localized> = {
  line: t(
    "In your report, {name} is {value} {unit}, which is {where} ({range}).",
    "आपकी रिपोर्ट में {name} {value} {unit} है, जो {where} है ({range})।",
    "तुमच्या अहवालात {name} {value} {unit} आहे, जे {where} आहे ({range}).",
    "Aapki report mein {name} {value} {unit} hai, jo {where} hai ({range}).",
  ),
  above: t("above the usual range", "सामान्य सीमा से ऊपर", "सामान्य मर्यादेपेक्षा जास्त", "saamanya seema se upar"),
  below: t("below the usual range", "सामान्य सीमा से नीचे", "सामान्य मर्यादेपेक्षा कमी", "saamanya seema se neeche"),
  within: t("within the usual range", "सामान्य सीमा के भीतर", "सामान्य मर्यादेत", "saamanya seema ke andar"),
  summaryHead: t(
    "From your latest values: {flagged} of {total} are outside the usual range.",
    "आपके ताज़ा मानों में से {total} में से {flagged} सामान्य सीमा से बाहर हैं।",
    "तुमच्या ताज्या मूल्यांपैकी {total} पैकी {flagged} सामान्य मर्यादेबाहेर आहेत.",
    "Aapki taaza values mein se {total} mein se {flagged} saamanya seema se bahar hain.",
  ),
  summaryFlag: t("{name}: {value} {unit}, {where}.", "{name}: {value} {unit}, {where}।", "{name}: {value} {unit}, {where}.", "{name}: {value} {unit}, {where}."),
  summaryOk: t("The rest are within the usual range.", "बाकी सामान्य सीमा के भीतर हैं।", "उर्वरित सामान्य मर्यादेत आहेत.", "Baaki saamanya seema ke andar hain."),
  summaryAllOk: t(
    "All {total} values in your latest report are within the usual range.",
    "आपकी ताज़ा रिपोर्ट के सभी {total} मान सामान्य सीमा के भीतर हैं।",
    "तुमच्या ताज्या अहवालातील सर्व {total} मूल्ये सामान्य मर्यादेत आहेत.",
    "Aapki taaza report ki sabhi {total} values saamanya seema ke andar hain.",
  ),
};
