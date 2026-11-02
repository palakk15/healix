import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { recursiveChunk, type ChunkOptions } from "./chunker";
import { cosine, embed } from "./embedder";

export interface ReportDocument {
  reportId: string;
  profileId: string;
  title: string;
  issuedAtMs: number;
  text: string;
}

export interface StoredChunk {
  id: string;
  reportId: string;
  profileId: string;
  title: string;
  issuedAtMs: number;
  index: number;
  text: string;
  vector: number[];
}

export interface SearchHit {
  chunk: StoredChunk;
  score: number;
}

interface StoreFile {
  version: 1;
  documents: Record<string, string>;
  chunks: StoredChunk[];
}

function digest(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export class VectorStore {
  private chunks: StoredChunk[] = [];
  private documents = new Map<string, string>();
  private dirty = false;

  constructor(
    private readonly file?: string,
    private readonly chunkOptions: Partial<ChunkOptions> = {},
  ) {
    this.load();
  }

  private load(): void {
    if (!this.file || !existsSync(this.file)) return;
    try {
      const parsed = JSON.parse(readFileSync(this.file, "utf8")) as StoreFile;
      if (parsed.version !== 1) return;
      this.chunks = parsed.chunks;
      this.documents = new Map(Object.entries(parsed.documents));
    } catch {
      this.chunks = [];
      this.documents.clear();
    }
  }

  save(): void {
    if (!this.file || !this.dirty) return;
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    const payload: StoreFile = { version: 1, documents: Object.fromEntries(this.documents), chunks: this.chunks };
    writeFileSync(temporary, JSON.stringify(payload));
    renameSync(temporary, this.file);
    this.dirty = false;
  }

  get size(): number {
    return this.chunks.length;
  }

  has(reportId: string): boolean {
    return this.documents.has(reportId);
  }

  remove(reportId: string): void {
    if (!this.documents.delete(reportId)) return;
    this.chunks = this.chunks.filter((chunk) => chunk.reportId !== reportId);
    this.dirty = true;
  }

  upsert(document: ReportDocument): number {
    const fingerprint = digest(`${document.profileId}|${document.title}|${document.text}`);
    if (this.documents.get(document.reportId) === fingerprint) return 0;
    this.chunks = this.chunks.filter((chunk) => chunk.reportId !== document.reportId);
    const pieces = recursiveChunk(document.text, this.chunkOptions);
    for (const piece of pieces) {
      this.chunks.push({
        id: `${document.reportId}#${piece.index}`,
        reportId: document.reportId,
        profileId: document.profileId,
        title: document.title,
        issuedAtMs: document.issuedAtMs,
        index: piece.index,
        text: piece.text,
        vector: embed(`${document.title}\n${piece.text}`),
      });
    }
    this.documents.set(document.reportId, fingerprint);
    this.dirty = true;
    return pieces.length;
  }

  sync(documents: readonly ReportDocument[]): void {
    const wanted = new Set(documents.map((document) => document.reportId));
    for (const reportId of [...this.documents.keys()]) if (!wanted.has(reportId)) this.remove(reportId);
    for (const document of documents) this.upsert(document);
    this.save();
  }

  search(query: string, filter: { profileIds: readonly string[]; limit?: number }): SearchHit[] {
    const vector = embed(query);
    return this.chunks
      .filter((chunk) => filter.profileIds.includes(chunk.profileId))
      .map((chunk) => ({ chunk, score: cosine(vector, chunk.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, filter.limit ?? 4);
  }

  countFor(profileIds: readonly string[]): number {
    return this.chunks.filter((chunk) => profileIds.includes(chunk.profileId)).length;
  }
}
