export interface Analyte {
  code: string;
  display: string;
  pattern: RegExp;
  unit: string;
  plausible: [number, number];
  defaultRange: { low: number | null; high: number | null } | null;
  scale?: { above: number; divideBy: number };
}

export const analytes: Analyte[] = [
  { code: "HBA1C", display: "HbA1c", pattern: /hb\s?a\s?[1lI]\s?c|glyc(?:ated|osylated)\s+h(?:a)?emoglobin/i, unit: "%", plausible: [3, 20], defaultRange: { low: 4, high: 5.6 } },
  { code: "FBS", display: "Fasting glucose", pattern: /fasting\s+(?:blood\s+)?(?:glucose|sugar)|\bfbs\b|\bfbg\b/i, unit: "mg/dL", plausible: [30, 600], defaultRange: { low: 70, high: 99 } },
  { code: "PPBS", display: "Post-meal glucose", pattern: /post\s*[-]?\s*(?:prandial|meal)|\bppbs\b|\bppg\b/i, unit: "mg/dL", plausible: [40, 700], defaultRange: { low: 70, high: 140 } },
  { code: "RBS", display: "Random glucose", pattern: /random\s+(?:blood\s+)?(?:glucose|sugar)|\brbs\b/i, unit: "mg/dL", plausible: [30, 700], defaultRange: { low: 70, high: 140 } },
  { code: "TC", display: "Total cholesterol", pattern: /total\s+cholesterol|cholesterol\s*,?\s*total|\bt\.?\s?chol\b/i, unit: "mg/dL", plausible: [60, 600], defaultRange: { low: 0, high: 200 } },
  { code: "TG", display: "Triglycerides", pattern: /triglycerides?|\btg\b/i, unit: "mg/dL", plausible: [20, 1500], defaultRange: { low: 0, high: 150 } },
  { code: "HDL", display: "HDL cholesterol", pattern: /\bhdl\b/i, unit: "mg/dL", plausible: [10, 150], defaultRange: { low: 40, high: null } },
  { code: "LDL", display: "LDL cholesterol", pattern: /\bldl\b/i, unit: "mg/dL", plausible: [20, 400], defaultRange: { low: 0, high: 100 } },
  { code: "HB", display: "Haemoglobin", pattern: /\bha?emoglobin\b(?!\s*a\s?[1lI])|\bhb\b|\bhgb\b/i, unit: "g/dL", plausible: [3, 25], defaultRange: { low: 12, high: 15.5 } },
  { code: "WBC", display: "White blood cells", pattern: /white\s+blood\s+cell|\bwbc\b|total\s+leu[ck]ocyte|\btlc\b/i, unit: "×10³/µL", plausible: [0.5, 100], defaultRange: { low: 4, high: 11 }, scale: { above: 500, divideBy: 1000 } },
  { code: "PLT", display: "Platelets", pattern: /platelet(?:\s+count)?|\bplt\b/i, unit: "×10³/µL", plausible: [10, 1500], defaultRange: { low: 150, high: 450 } },
  { code: "RBC", display: "Red blood cells", pattern: /red\s+blood\s+cell|\brbc\b|red\s+cell\s+count/i, unit: "×10⁶/µL", plausible: [1, 10], defaultRange: { low: 3.8, high: 5.2 } },
  { code: "VITD", display: "Vitamin D", pattern: /vitamin\s*d|25\s*[-]?\s*(?:oh|hydroxy)/i, unit: "ng/mL", plausible: [2, 200], defaultRange: { low: 30, high: 100 } },
  { code: "VITB12", display: "Vitamin B12", pattern: /vitamin\s*b\s?[-]?\s?12|\bb\s?12\b|cobalamin/i, unit: "pg/mL", plausible: [50, 2000], defaultRange: { low: 200, high: 900 } },
  { code: "TSH", display: "TSH", pattern: /\btsh\b|thyroid\s+stimulating/i, unit: "µIU/mL", plausible: [0.01, 100], defaultRange: { low: 0.4, high: 4.0 } },
  { code: "CREAT", display: "Creatinine", pattern: /creatinine/i, unit: "mg/dL", plausible: [0.1, 15], defaultRange: { low: 0.6, high: 1.3 } },
  { code: "ALT", display: "ALT (SGPT)", pattern: /\balt\b|sgpt/i, unit: "U/L", plausible: [3, 2000], defaultRange: { low: 0, high: 45 } },
  { code: "AST", display: "AST (SGOT)", pattern: /\bast\b|sgot/i, unit: "U/L", plausible: [3, 2000], defaultRange: { low: 0, high: 40 } },
];

const groups: Array<{ codes: string[]; title: string }> = [
  { codes: ["HBA1C", "FBS", "PPBS", "RBS"], title: "Diabetes check-up" },
  { codes: ["TC", "TG", "HDL", "LDL"], title: "Lipid profile" },
  { codes: ["HB", "WBC", "PLT", "RBC"], title: "Complete blood count" },
  { codes: ["VITD", "VITB12"], title: "Vitamins" },
  { codes: ["TSH"], title: "Thyroid" },
  { codes: ["CREAT"], title: "Kidney function" },
  { codes: ["ALT", "AST"], title: "Liver function" },
];

export function reportTypeFor(codes: readonly string[]): string {
  const counts = groups.map((group) => ({ group, hits: group.codes.filter((code) => codes.includes(code)).length }));
  const best = counts.sort((a, b) => b.hits - a.hits)[0];
  if (!best || best.hits === 0) return "Lab report";
  const strong = counts.filter((entry) => entry.hits > 0).length;
  return strong > 1 && best.hits < codes.length ? "Lab report" : best.group.title;
}
