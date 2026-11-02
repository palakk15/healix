import type { SttResponse, TranslateResponse } from "@core/api/schemas/sarvam";
import { detectLanguage, languageFromSarvamCode } from "@core/domain/languageDetect";
import { chunkText, stripCitationMarkers } from "@core/domain/textChunks";
import { languages, type LanguageCode } from "@core/i18n/languages";
import { callSarvam, defaultTransport, type SarvamTransport } from "./client";
import type { SarvamConfig } from "./config";
import { notConfigured, SarvamError, unavailable } from "./errors";
import { createCannedTranscriber, type SpeechPurpose } from "./mockStt";
import {
  buildLidBody,
  buildSttForm,
  buildTranslateBody,
  buildTransliterateBody,
  buildTtsBody,
  parseLidResponse,
  parseSttResponse,
  parseTranslateResponse,
  parseTransliterateResponse,
  parseTtsResponse,
  wirePaths,
} from "./wire";

const translationCacheLimit = 500;
const defaultPace = 1;

export interface TranscribeInput {
  audio: Blob;
  fileName: string;
  language: LanguageCode;
  purpose: SpeechPurpose;
}

export class SarvamService {
  private canned = createCannedTranscriber();
  private readonly translations = new Map<string, string>();

  constructor(
    readonly config: SarvamConfig,
    private readonly transport: SarvamTransport = defaultTransport,
  ) {}

  resetDemo(): void {
    this.canned = createCannedTranscriber();
  }

  async transcribe(input: TranscribeInput): Promise<SttResponse> {
    if (this.config.mode === "off") throw unavailable();
    if (input.audio.size === 0) throw new SarvamError(400, "no_audio", "No audio was received", true);

    if (this.config.mode === "mock") {
      const canned = this.canned(input.language, input.purpose);
      return { transcript: canned.transcript, language: languageFromSarvamCode(canned.languageCode, canned.transcript, input.language), source: "mock" };
    }

    if (!this.config.sttModel) throw notConfigured("speech-to-text model");
    const payload = await callSarvam(
      this.config,
      this.transport,
      wirePaths.speechToText,
      buildSttForm(input.audio, input.fileName, { model: this.config.sttModel, mode: languages[input.language].speechMode }),
    );
    const parsed = parseSttResponse(payload);
    if (!parsed) throw new SarvamError(502, "sarvam_bad_response", "Sarvam sent an unreadable answer", true);
    if (parsed.transcript.length === 0) throw new SarvamError(400, "no_speech", "We could not hear any words. Please try again.", true);
    return {
      transcript: parsed.transcript,
      language: languageFromSarvamCode(parsed.languageCode, parsed.transcript, input.language),
      source: "sarvam",
    };
  }

  async speak(text: string, language: LanguageCode, pace = defaultPace): Promise<string[]> {
    if (this.config.mode !== "live") throw unavailable();
    if (!this.config.ttsModel) throw notConfigured("text-to-speech model");
    const chunks = chunkText(stripCitationMarkers(text));
    if (chunks.length === 0) throw new SarvamError(400, "no_text", "There is nothing to read aloud", false);

    const audios: string[] = [];
    for (const chunk of chunks) {
      const payload = await callSarvam(this.config, this.transport, wirePaths.textToSpeech, buildTtsBody(this.config, chunk, language, pace));
      const parsed = parseTtsResponse(payload);
      if (!parsed) throw new SarvamError(502, "sarvam_bad_response", "Sarvam sent an unreadable answer", true);
      audios.push(...parsed.audios);
    }
    return audios;
  }

  async translate(text: string, target: LanguageCode, source: LanguageCode | undefined): Promise<TranslateResponse> {
    const passthrough = (degraded: boolean): TranslateResponse => ({ text, target, cached: false, source: "passthrough", degraded });
    if (source === target) return passthrough(false);
    if (this.config.mode !== "live") return passthrough(this.config.mode === "off");

    const key = `${source ?? "auto"}>${target}|${text}`;
    const cached = this.translations.get(key);
    if (cached !== undefined) return { text: cached, target, cached: true, source: "sarvam", degraded: false };

    try {
      const payload = await callSarvam(this.config, this.transport, wirePaths.translate, buildTranslateBody(this.config, text, source, target));
      const parsed = parseTranslateResponse(payload);
      if (!parsed) return passthrough(true);
      if (this.translations.size >= translationCacheLimit) {
        const oldest = this.translations.keys().next().value;
        if (oldest !== undefined) this.translations.delete(oldest);
      }
      this.translations.set(key, parsed.text);
      return { text: parsed.text, target, cached: false, source: "sarvam", degraded: false };
    } catch {
      return passthrough(true);
    }
  }

  async transliterate(text: string, from: LanguageCode, to: LanguageCode): Promise<string> {
    if (this.config.mode !== "live") throw unavailable();
    const payload = await callSarvam(this.config, this.transport, wirePaths.transliterate, buildTransliterateBody(text, from, to));
    const parsed = parseTransliterateResponse(payload);
    if (parsed === null) throw new SarvamError(502, "sarvam_bad_response", "Sarvam sent an unreadable answer", true);
    return parsed;
  }

  async identify(text: string): Promise<{ language: LanguageCode; source: "sarvam" | "local" }> {
    const local = { language: detectLanguage(text), source: "local" as const };
    if (this.config.mode !== "live") return local;
    try {
      const payload = await callSarvam(this.config, this.transport, wirePaths.languageId, buildLidBody(text));
      const mapped = languageFromSarvamCode(parseLidResponse(payload), text, local.language);
      return mapped ? { language: mapped, source: "sarvam" } : local;
    } catch {
      return local;
    }
  }
}
