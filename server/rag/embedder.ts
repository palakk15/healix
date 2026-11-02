export const embeddingDimensions = 512;

const stopWords = new Set(["the", "a", "an", "is", "are", "of", "to", "in", "and", "or", "my", "me", "it", "this", "that", "what", "does", "do", "how", "why", "for", "on", "i", "be", "was", "at", "with", "mean", "means"]);

const aliases: Array<[RegExp, string]> = [
  [/\bhba1c\b|\ba1c\b|glycated|glycosylated/g, "hba1c"],
  [/\bsugar\b|\bglucose\b|\bfbs\b/g, "glucose"],
  [/\bhb\b|\bhaemoglobin\b|\bhemoglobin\b/g, "hemoglobin"],
  [/\bcholesterol\b|\blipid\b|\bldl\b|\bhdl\b/g, "cholesterol"],
  [/\bbp\b/g, "pressure"],
];

function hash(text: string, seed: number): number {
  let value = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value >>> 0;
}

export function tokenize(text: string): string[] {
  let lowered = text.toLowerCase();
  for (const [pattern, replacement] of aliases) lowered = lowered.replace(pattern, replacement);
  return (lowered.match(/[\p{L}\p{N}]+/gu) ?? []).filter((token) => !stopWords.has(token));
}

function add(vector: Float32Array, feature: string, weight: number): void {
  const slot = hash(feature, 0) % embeddingDimensions;
  const sign = hash(feature, 1) % 2 === 0 ? 1 : -1;
  vector[slot] = (vector[slot] ?? 0) + sign * weight;
}

export function embed(text: string): number[] {
  const vector = new Float32Array(embeddingDimensions);
  const tokens = tokenize(text);
  for (const token of tokens) {
    add(vector, `w:${token}`, 1);
    const padded = `^${token}$`;
    for (let index = 0; index + 3 <= padded.length; index += 1) add(vector, `c:${padded.slice(index, index + 3)}`, 0.35);
  }
  for (let index = 0; index + 1 < tokens.length; index += 1) add(vector, `b:${tokens[index]}_${tokens[index + 1]}`, 0.6);
  let norm = 0;
  for (const component of vector) norm += component * component;
  norm = Math.sqrt(norm);
  if (norm === 0) return Array.from(vector);
  return Array.from(vector, (component) => Math.round((component / norm) * 10000) / 10000);
}

export function cosine(a: readonly number[], b: readonly number[]): number {
  let total = 0;
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) total += (a[index] ?? 0) * (b[index] ?? 0);
  return total;
}
