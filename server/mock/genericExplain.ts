import type { Observation } from "@core/api/schemas/ai";
import type { LanguageCode } from "@core/i18n/languages";

type Direction = "high" | "low";

const meaning: Record<LanguageCode, Record<Direction, (name: string) => string>> = {
  en: {
    high: (name) => `${name} is above the usual range. Food, activity, sleep and other conditions can all affect it, so your doctor reads it together with your other results.`,
    low: (name) => `${name} is below the usual range. Many everyday things can affect it, so your doctor reads it together with your other results.`,
  },
  hi: {
    high: (name) => `${name} सामान्य सीमा से ऊपर है। भोजन, गतिविधि, नींद और दूसरी स्थितियाँ इसे प्रभावित कर सकती हैं, इसलिए डॉक्टर इसे आपके दूसरे नतीजों के साथ पढ़ते हैं।`,
    low: (name) => `${name} सामान्य सीमा से नीचे है। रोज़मर्रा की कई बातें इसे प्रभावित कर सकती हैं, इसलिए डॉक्टर इसे आपके दूसरे नतीजों के साथ पढ़ते हैं।`,
  },
  mr: {
    high: (name) => `${name} सामान्य मर्यादेपेक्षा जास्त आहे. आहार, हालचाल, झोप आणि इतर स्थिती यांचा परिणाम होऊ शकतो, म्हणून डॉक्टर ते तुमच्या इतर निकालांसोबत पाहतात.`,
    low: (name) => `${name} सामान्य मर्यादेपेक्षा कमी आहे. रोजच्या अनेक गोष्टींचा परिणाम होऊ शकतो, म्हणून डॉक्टर ते तुमच्या इतर निकालांसोबत पाहतात.`,
  },
  hinglish: {
    high: (name) => `${name} saamanya range se upar hai. Bhojan, gatividhi, neend aur doosri sthitiyan ise prabhavit kar sakti hain, isliye doctor ise aapke doosre nateejon ke saath padhte hain.`,
    low: (name) => `${name} saamanya range se neeche hai. Roz ki kai baatein ise prabhavit kar sakti hain, isliye doctor ise aapke doosre nateejon ke saath padhte hain.`,
  },
};

const allNormal: Record<LanguageCode, string> = {
  en: "All the values in this report are within the usual range.",
  hi: "इस रिपोर्ट के सभी मान सामान्य सीमा के भीतर हैं।",
  mr: "या अहवालातील सर्व मूल्ये सामान्य मर्यादेत आहेत.",
  hinglish: "Is report ki sabhi values saamanya range ke andar hain.",
};

const someFlagged: Record<LanguageCode, (flagged: number, total: number, names: string) => string> = {
  en: (flagged, total, names) => `${flagged} of ${total} values are outside the usual range: ${names}. Your doctor can explain what this means for you.`,
  hi: (flagged, total, names) => `${total} में से ${flagged} मान सामान्य सीमा से बाहर हैं: ${names}। इसका आपके लिए क्या मतलब है, यह आपके डॉक्टर बता सकते हैं।`,
  mr: (flagged, total, names) => `${total} पैकी ${flagged} मूल्ये सामान्य मर्यादेबाहेर आहेत: ${names}. याचा तुमच्यासाठी काय अर्थ आहे, हे तुमचे डॉक्टर सांगू शकतात.`,
  hinglish: (flagged, total, names) => `${total} mein se ${flagged} values saamanya range se bahar hain: ${names}. Iska aapke liye kya matlab hai, yeh aapke doctor bata sakte hain.`,
};

const questions: Record<LanguageCode, string[]> = {
  en: ["Does any of this need action now, or only watching?", "Do I need follow-up tests, and when?", "Should I change my food or daily routine?"],
  hi: ["क्या इसमें से किसी पर अभी कुछ करना है, या सिर्फ़ नज़र रखनी है?", "क्या मुझे और जाँच करानी है, और कब?", "क्या मुझे अपना खान-पान या दिनचर्या बदलनी चाहिए?"],
  mr: ["यापैकी कशावर आता काही करायचे आहे का, की फक्त लक्ष ठेवायचे?", "मला आणखी तपासण्या कराव्या लागतील का, आणि केव्हा?", "मी माझा आहार किंवा दिनक्रम बदलावा का?"],
  hinglish: ["Kya inmein se kisi par abhi kuch karna hai, ya sirf nazar rakhni hai?", "Kya mujhe aur jaanch karani hai, aur kab?", "Kya mujhe apna khaan-paan ya dincharya badalni chahiye?"],
};

export function genericMeaning(name: string, direction: Direction, language: LanguageCode): string {
  return meaning[language][direction](name);
}

export function genericSummary(observations: readonly Observation[], language: LanguageCode): string {
  const flagged = observations.filter((entry) => entry.interpretation !== "normal");
  if (flagged.length === 0) return allNormal[language];
  return someFlagged[language](flagged.length, observations.length, flagged.map((entry) => entry.display).join(", "));
}

export function genericQuestions(language: LanguageCode): string[] {
  return questions[language];
}
