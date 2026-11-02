import { beforeEach, describe, expect, it, vi } from "vitest";
import { cacheKey, clearMemoryCacheForTests, readCachedAudio, writeCachedAudio } from "./audioCache";
import { playAudios, stopAllPlayback } from "./player";
import { getVoiceMode, markVoiceUnavailable, resetVoiceModeForTests } from "../lib/voiceMode";

class FakeAudio {
  paused = false;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly src: string) {}
  play() {
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  end() {
    this.onended?.();
  }
}

function factory() {
  const elements: FakeAudio[] = [];
  return { elements, create: (source: string) => (elements.push(new FakeAudio(source)), elements.at(-1) as unknown as HTMLAudioElement) };
}

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  stopAllPlayback();
  clearMemoryCacheForTests();
  resetVoiceModeForTests();
  vi.unstubAllGlobals();
});

describe("player", () => {
  it("plays the chunks one after another as WAV data", async () => {
    const { elements, create } = factory();
    const handle = playAudios(["AAA", "BBB", "CCC"], create);
    await tick();
    expect(elements.map((element) => element.src)).toEqual(["data:audio/wav;base64,AAA"]);
    (elements[0] as unknown as FakeAudio).end();
    await tick();
    (elements[1] as unknown as FakeAudio).end();
    await tick();
    expect(elements).toHaveLength(3);
    (elements[2] as unknown as FakeAudio).end();
    await handle.finished;
  });

  it("stops mid-way and never starts the next chunk", async () => {
    const { elements, create } = factory();
    const handle = playAudios(["AAA", "BBB"], create);
    await tick();
    handle.stop();
    await handle.finished;
    expect(elements[0]?.paused).toBe(true);
    (elements[0] as unknown as FakeAudio).end();
    await tick();
    expect(elements).toHaveLength(1);
  });

  it("only ever plays one voice at a time", async () => {
    const { elements, create } = factory();
    const first = playAudios(["AAA"], create);
    await tick();
    const second = playAudios(["BBB"], create);
    await first.finished;
    expect(elements[0]?.paused).toBe(true);
    second.stop();
  });

  it("finishes cleanly when playback fails", async () => {
    const create = () => ({ play: () => Promise.reject(new Error("blocked")), pause: () => undefined }) as unknown as HTMLAudioElement;
    await playAudios(["AAA"], create).finished;
  });
});

describe("audio cache", () => {
  it("keys on text, language and pace", async () => {
    const base = await cacheKey("नमस्कार", "mr", 1);
    expect(await cacheKey("नमस्कार", "mr", 1)).toBe(base);
    expect(await cacheKey("नमस्कार", "hi", 1)).not.toBe(base);
    expect(await cacheKey("नमस्कार", "mr", 0.85)).not.toBe(base);
    expect(await cacheKey("धन्यवाद", "mr", 1)).not.toBe(base);
  });

  it("returns what was stored, and nothing for an unknown key", async () => {
    expect(await readCachedAudio("missing")).toBeNull();
    await writeCachedAudio("k1", ["AAA", "BBB"]);
    expect(await readCachedAudio("k1")).toEqual(["AAA", "BBB"]);
  });

  it("keeps working when browser storage is blocked", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new Error("blocked");
      },
    });
    await expect(writeCachedAudio("k2", ["AAA"])).resolves.toBeUndefined();
    expect(await readCachedAudio("k2")).toEqual(["AAA"]);
    clearMemoryCacheForTests();
    expect(await readCachedAudio("k2")).toBeNull();
  });
});

describe("voice mode", () => {
  it("reads the mode once and remembers it", async () => {
    const fetchStub = vi.fn(async () => new Response(JSON.stringify({ sarvam_mode: "live" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);
    expect(await getVoiceMode()).toBe("live");
    expect(await getVoiceMode()).toBe("live");
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });

  it("does not remember a failure, so it can try again", async () => {
    const fetchStub = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(new Response(JSON.stringify({ sarvam_mode: "mock" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);
    expect(await getVoiceMode()).toBe("unknown");
    expect(await getVoiceMode()).toBe("mock");
  });

  it("treats an older server without sarvam_mode as unknown, and can be switched off", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ data_mode: "mock", sarvam_enabled: false }), { status: 200 }));
    expect(await getVoiceMode()).toBe("unknown");
    markVoiceUnavailable();
    expect(await getVoiceMode()).toBe("off");
  });
});
