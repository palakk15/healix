import type { LanguageCode } from "../i18n/languages";
import type { Specialty, Urgency } from "./specialty";

export interface SpecialtyLabel {
  title: string;
  plain: string;
}

type SpecialtyLabels = Record<Specialty, Record<LanguageCode, SpecialtyLabel>>;

export const specialtyLabels: SpecialtyLabels = {
  "General Physician": {
    en: { title: "General Physician", plain: "everyday illness doctor" },
    hi: { title: "सामान्य चिकित्सक", plain: "आम बीमारियों के डॉक्टर" },
    mr: { title: "सामान्य चिकित्सक", plain: "सामान्य आजारांचे डॉक्टर" },
    hinglish: { title: "General Physician", plain: "aam bimariyon ke doctor" },
  },
  Cardiology: {
    en: { title: "Cardiologist", plain: "heart specialist" },
    hi: { title: "हृदय रोग विशेषज्ञ", plain: "दिल की बीमारियों के विशेषज्ञ" },
    mr: { title: "हृदयरोगतज्ज्ञ", plain: "हृदयाच्या आजारांचे तज्ज्ञ" },
    hinglish: { title: "Cardiologist", plain: "dil ki bimariyon ke specialist" },
  },
  Pulmonology: {
    en: { title: "Pulmonologist", plain: "lungs and breathing specialist" },
    hi: { title: "फेफड़ों के विशेषज्ञ", plain: "साँस और फेफड़ों के विशेषज्ञ" },
    mr: { title: "फुफ्फुसरोगतज्ज्ञ", plain: "श्वसन आणि फुफ्फुसांचे तज्ज्ञ" },
    hinglish: { title: "Pulmonologist", plain: "saans aur phephdon ke specialist" },
  },
  Gastroenterology: {
    en: { title: "Gastroenterologist", plain: "stomach and digestion specialist" },
    hi: { title: "गैस्ट्रोएंटेरोलॉजिस्ट", plain: "पेट और पाचन के विशेषज्ञ" },
    mr: { title: "गॅस्ट्रोएन्टेरोलॉजिस्ट", plain: "पोट आणि पचनाचे तज्ज्ञ" },
    hinglish: { title: "Gastroenterologist", plain: "pet aur pachan ke specialist" },
  },
  Neurology: {
    en: { title: "Neurologist", plain: "brain and nerves specialist" },
    hi: { title: "न्यूरोलॉजिस्ट", plain: "दिमाग और नसों के विशेषज्ञ" },
    mr: { title: "न्यूरोलॉजिस्ट", plain: "मेंदू आणि नसांचे तज्ज्ञ" },
    hinglish: { title: "Neurologist", plain: "dimag aur nason ke specialist" },
  },
  Orthopedics: {
    en: { title: "Orthopedic doctor", plain: "bone and joint specialist" },
    hi: { title: "हड्डी रोग विशेषज्ञ", plain: "हड्डी और जोड़ों के विशेषज्ञ" },
    mr: { title: "अस्थिरोगतज्ज्ञ", plain: "हाडे आणि सांध्यांचे तज्ज्ञ" },
    hinglish: { title: "Orthopedic doctor", plain: "haddi aur jodon ke specialist" },
  },
  Dermatology: {
    en: { title: "Dermatologist", plain: "skin, hair and nails specialist" },
    hi: { title: "त्वचा रोग विशेषज्ञ", plain: "त्वचा, बाल और नाखूनों के विशेषज्ञ" },
    mr: { title: "त्वचारोगतज्ज्ञ", plain: "त्वचा, केस आणि नखांचे तज्ज्ञ" },
    hinglish: { title: "Dermatologist", plain: "twacha, baal aur nakhun ke specialist" },
  },
  ENT: {
    en: { title: "ENT specialist", plain: "ear, nose and throat specialist" },
    hi: { title: "कान-नाक-गला विशेषज्ञ", plain: "कान, नाक और गले के विशेषज्ञ" },
    mr: { title: "कान-नाक-घसा तज्ज्ञ", plain: "कान, नाक आणि घशाचे तज्ज्ञ" },
    hinglish: { title: "ENT specialist", plain: "kaan, naak aur gale ke specialist" },
  },
  Ophthalmology: {
    en: { title: "Eye specialist", plain: "eye doctor" },
    hi: { title: "नेत्र रोग विशेषज्ञ", plain: "आँखों के विशेषज्ञ" },
    mr: { title: "नेत्ररोगतज्ज्ञ", plain: "डोळ्यांचे तज्ज्ञ" },
    hinglish: { title: "Eye specialist", plain: "aankhon ke specialist" },
  },
  "Gynecology and Obstetrics": {
    en: { title: "Gynecologist", plain: "women's health and pregnancy specialist" },
    hi: { title: "स्त्री रोग एवं प्रसूति विशेषज्ञ", plain: "महिलाओं के स्वास्थ्य और गर्भावस्था के विशेषज्ञ" },
    mr: { title: "स्त्रीरोग व प्रसूतितज्ज्ञ", plain: "महिलांचे आरोग्य आणि गर्भारपणाचे तज्ज्ञ" },
    hinglish: { title: "Gynecologist", plain: "mahilaon ke swasthya aur pregnancy ke specialist" },
  },
  Pediatrics: {
    en: { title: "Pediatrician", plain: "children's doctor" },
    hi: { title: "बाल रोग विशेषज्ञ", plain: "बच्चों के डॉक्टर" },
    mr: { title: "बालरोगतज्ज्ञ", plain: "लहान मुलांचे डॉक्टर" },
    hinglish: { title: "Pediatrician", plain: "bachchon ke doctor" },
  },
  Psychiatry: {
    en: { title: "Psychiatrist", plain: "mental health specialist" },
    hi: { title: "मनोरोग विशेषज्ञ", plain: "मन और भावनाओं के स्वास्थ्य के विशेषज्ञ" },
    mr: { title: "मानसोपचारतज्ज्ञ", plain: "मन आणि भावनांच्या आरोग्याचे तज्ज्ञ" },
    hinglish: { title: "Psychiatrist", plain: "mann ke swasthya ke specialist" },
  },
  Urology: {
    en: { title: "Urologist", plain: "urinary tract specialist" },
    hi: { title: "मूत्र रोग विशेषज्ञ", plain: "मूत्र मार्ग के विशेषज्ञ" },
    mr: { title: "मूत्ररोगतज्ज्ञ", plain: "मूत्रमार्गाचे तज्ज्ञ" },
    hinglish: { title: "Urologist", plain: "mutra marg ke specialist" },
  },
  Endocrinology: {
    en: { title: "Endocrinologist", plain: "diabetes and hormone specialist" },
    hi: { title: "एंडोक्राइनोलॉजिस्ट", plain: "मधुमेह और हार्मोन के विशेषज्ञ" },
    mr: { title: "एंडोक्रायनॉलॉजिस्ट", plain: "मधुमेह आणि हार्मोन्सचे तज्ज्ञ" },
    hinglish: { title: "Endocrinologist", plain: "madhumeh aur hormone ke specialist" },
  },
  Nephrology: {
    en: { title: "Nephrologist", plain: "kidney specialist" },
    hi: { title: "गुर्दा रोग विशेषज्ञ", plain: "गुर्दों के विशेषज्ञ" },
    mr: { title: "मूत्रपिंडरोगतज्ज्ञ", plain: "मूत्रपिंडांचे तज्ज्ञ" },
    hinglish: { title: "Nephrologist", plain: "gurde ke specialist" },
  },
  Dentistry: {
    en: { title: "Dentist", plain: "teeth and gums doctor" },
    hi: { title: "दंत चिकित्सक", plain: "दाँत और मसूड़ों के डॉक्टर" },
    mr: { title: "दंतवैद्य", plain: "दात आणि हिरड्यांचे डॉक्टर" },
    hinglish: { title: "Dentist", plain: "daant aur masudon ke doctor" },
  },
};

export const urgencyLabels: Record<Urgency, Record<LanguageCode, string>> = {
  emergency: { en: "Emergency", hi: "आपातकाल", mr: "आपत्कालीन", hinglish: "Emergency" },
  urgent: { en: "Urgent · today", hi: "जल्दी · आज ही", mr: "तातडीचे · आजच", hinglish: "Urgent · aaj hi" },
  soon: { en: "Within 2 days", hi: "2 दिन के भीतर", mr: "2 दिवसांत", hinglish: "2 din ke andar" },
  routine: { en: "Routine", hi: "सामान्य", mr: "नेहमीचे", hinglish: "Routine" },
};

export function specialtyLabel(specialty: Specialty, language: LanguageCode): SpecialtyLabel {
  return specialtyLabels[specialty][language];
}

export function urgencyLabel(urgency: Urgency, language: LanguageCode): string {
  return urgencyLabels[urgency][language];
}
