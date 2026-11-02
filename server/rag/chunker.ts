export interface ChunkOptions {
  chunkSize: number;
  overlap: number;
  separators: readonly string[];
}

export interface TextChunk {
  index: number;
  text: string;
}

export const defaultChunkOptions: ChunkOptions = {
  chunkSize: 480,
  overlap: 60,
  separators: ["\n\n", "\n", ". ", "; ", ", ", " ", ""],
};

function splitOn(text: string, separator: string): string[] {
  if (separator === "") return Array.from(text);
  const pieces = text.split(separator);
  return pieces.map((piece, index) => (index < pieces.length - 1 ? `${piece}${separator}` : piece)).filter((piece) => piece.length > 0);
}

function recurse(text: string, separators: readonly string[], size: number): string[] {
  if (text.length <= size) return [text];
  const [separator, ...rest] = separators;
  if (separator === undefined) return [text];
  const pieces = splitOn(text, separator);
  if (pieces.length === 1 && separator !== "") return recurse(text, rest, size);

  const merged: string[] = [];
  let current = "";
  const flush = () => {
    if (current.length > 0) merged.push(current);
    current = "";
  };
  for (const piece of pieces) {
    if (piece.length > size) {
      flush();
      merged.push(...recurse(piece, rest, size));
      continue;
    }
    if (current.length + piece.length > size) flush();
    current += piece;
  }
  flush();
  return merged;
}

function withOverlap(parts: string[], overlap: number): string[] {
  if (overlap <= 0) return parts;
  return parts.map((part, index) => {
    if (index === 0) return part;
    const previous = parts[index - 1] ?? "";
    const tail = previous.slice(Math.max(0, previous.length - overlap));
    const boundary = tail.search(/\s/);
    const clean = boundary >= 0 ? tail.slice(boundary + 1) : tail;
    return clean.length > 0 ? `${clean} ${part}` : part;
  });
}

export function recursiveChunk(text: string, options: Partial<ChunkOptions> = {}): TextChunk[] {
  const settings = { ...defaultChunkOptions, ...options };
  const normalised = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (normalised.length === 0) return [];
  const parts = recurse(normalised, settings.separators, settings.chunkSize)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return withOverlap(parts, settings.overlap).map((value, index) => ({ index, text: value }));
}
