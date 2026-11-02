export type CitationPart = { kind: "text"; value: string } | { kind: "cite"; n: number };

const marker = /\[(\d{1,2})\]/g;

export function splitCitations(text: string): CitationPart[] {
  const parts: CitationPart[] = [];
  let last = 0;
  for (const match of text.matchAll(marker)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", value: text.slice(last, index) });
    parts.push({ kind: "cite", n: Number(match[1]) });
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

export function stripCitations(text: string): string {
  return text.replace(marker, "").replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?।])/g, "$1").trim();
}
