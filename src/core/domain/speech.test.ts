import { describe, expect, it } from "vitest";
import { detectLanguage, languageFromSarvamCode, languagesMatch, scriptOf } from "./languageDetect";
import { chunkText, stripCitationMarkers, ttsMaxCharacters } from "./textChunks";
import { downmixToMono, encodeWav, resampleLinear, rmsLevel } from "./wav";

describe("language detection", () => {
  it("tells scripts apart", () => {
    expect(scriptOf("पोटात दुखते")).toBe("devanagari");
    expect(scriptOf("pet mein dard")).toBe("latin");
    expect(scriptOf("123 ?!")).toBe("other");
  });

  it("separates Marathi, Hindi, Hinglish and English", () => {
    expect(detectLanguage("मला पोटात दुखत आहे")).toBe("mr");
    expect(detectLanguage("मेरे पेट में दर्द है")).toBe("hi");
    expect(detectLanguage("mujhe pet mein dard hai")).toBe("hinglish");
    expect(detectLanguage("I have a stomach ache")).toBe("en");
  });

  it("maps Sarvam language codes, keeping Hinglish when the transcript is in Latin script", () => {
    expect(languageFromSarvamCode("mr-IN", "पोटात जळजळ", "en")).toBe("mr");
    expect(languageFromSarvamCode("hi-IN", "मेरे पेट में दर्द", "en")).toBe("hi");
    expect(languageFromSarvamCode("hi-IN", "do din se pet mein jalan", "en")).toBe("hinglish");
    expect(languageFromSarvamCode("en-IN", "knee pain", "hi")).toBe("en");
    expect(languageFromSarvamCode("ta-IN", "வலி", "en")).toBeNull();
    expect(languageFromSarvamCode(undefined, "x", "en")).toBeNull();
  });

  it("treats Hindi and Hinglish as the same spoken language", () => {
    expect(languagesMatch("hi", "hinglish")).toBe(true);
    expect(languagesMatch("mr", "en")).toBe(false);
    expect(languagesMatch("en", "en")).toBe(true);
  });
});

describe("text chunking for text to speech", () => {
  it("keeps short text in one chunk", () => {
    expect(chunkText("Take rest. Drink water.")).toEqual(["Take rest. Drink water."]);
  });

  it("splits on sentence boundaries including the Devanagari danda, never past the limit", () => {
    const sentence = "यह एक लंबा वाक्य है जो बार-बार दोहराया जाता है।";
    const text = Array.from({ length: 120 }, () => sentence).join(" ");
    const chunks = chunkText(text, 500);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(500);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(text);
  });

  it("splits a single very long sentence at word boundaries", () => {
    const text = Array.from({ length: 900 }, (_, index) => `word${index}`).join(" ");
    const chunks = chunkText(text, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    expect(Math.max(...chunks.map((chunk) => chunk.length))).toBeLessThanOrEqual(1000);
    expect(chunks.join(" ")).toBe(text);
  });

  it("uses a limit below Sarvam's roughly 2,500 characters and ignores empty input", () => {
    expect(ttsMaxCharacters).toBeLessThan(2500);
    expect(chunkText("   ")).toEqual([]);
  });

  it("removes citation markers before speaking", () => {
    expect(stripCitationMarkers("Keep sugar steady [1]. Check vitamin D [2].")).toBe("Keep sugar steady. Check vitamin D.");
  });
});

describe("WAV encoding", () => {
  it("writes a valid 16-bit mono PCM header", () => {
    const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1, -1]), 16000);
    const view = new DataView(wav.buffer);
    const text = (offset: number, length: number) => String.fromCharCode(...wav.slice(offset, offset + length));
    expect(text(0, 4)).toBe("RIFF");
    expect(text(8, 4)).toBe("WAVE");
    expect(text(12, 4)).toBe("fmt ");
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(text(36, 4)).toBe("data");
    expect(view.getUint32(40, true)).toBe(10);
    expect(wav.length).toBe(54);
    expect(view.getInt16(46, true)).toBe(Math.trunc(0.5 * 0x7fff));
    expect(view.getInt16(52, true)).toBe(-0x8000);
  });

  it("clamps out-of-range samples", () => {
    const view = new DataView(encodeWav(new Float32Array([3, -3]), 8000).buffer);
    expect(view.getInt16(44, true)).toBe(0x7fff);
    expect(view.getInt16(46, true)).toBe(-0x8000);
  });

  it("resamples to the target rate and keeps a constant signal constant", () => {
    const output = resampleLinear(new Float32Array(48000).fill(0.25), 48000, 16000);
    expect(output.length).toBe(16000);
    expect(output.every((value) => Math.abs(value - 0.25) < 1e-6)).toBe(true);
    expect(resampleLinear(new Float32Array([1, 2]), 16000, 16000)).toEqual(new Float32Array([1, 2]));
  });

  it("downmixes stereo and measures loudness", () => {
    const mono = downmixToMono([new Float32Array([1, 0]), new Float32Array([0, 1])]);
    expect(Array.from(mono)).toEqual([0.5, 0.5]);
    expect(rmsLevel(new Float32Array(100))).toBe(0);
    expect(rmsLevel(new Float32Array(100).fill(0.5))).toBe(1);
  });
});
