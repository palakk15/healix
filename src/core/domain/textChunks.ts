export const ttsMaxCharacters = 2000;

const sentenceEnd = /(?<=[.!?।॥])\s+|\n+/;

function splitLong(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence];
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) parts.push(rest);
  return parts;
}

export function chunkText(text: string, max: number = ttsMaxCharacters): string[] {
  const sentences = text
    .split(sentenceEnd)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0)
    .flatMap((sentence) => splitLong(sentence, max));

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current.length === 0) current = sentence;
    else if (current.length + 1 + sentence.length <= max) current = `${current} ${sentence}`;
    else {
      chunks.push(current);
      current = sentence;
    }
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function stripCitationMarkers(text: string): string {
  return text.replace(/\s*\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();
}
