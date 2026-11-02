import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@core/api/error";
import type { SttResponse } from "@core/api/schemas/sarvam";
import { RecorderError } from "../../audio/recorderError";
import type { RecorderHandle, RecorderOptions, Recording } from "../../audio/recorderTypes";
import { sessionStore } from "../../store";
import { renderWithI18n, resetStores, settle, stubMeta } from "../../test-utils";
import { VoiceButton, type VoiceResult, type VoiceState } from "./VoiceButton";

const recording: Recording = { blob: new Blob(["wav"], { type: "audio/wav" }), fileName: "speech.wav" };
const noticeText = "Your voice is sent to Sarvam AI to turn it into text.";

function fakeRecorder() {
  const handle: RecorderHandle = { stop: vi.fn(async () => recording), cancel: vi.fn() };
  let options: RecorderOptions | undefined;
  const start = vi.fn(async (given: RecorderOptions) => {
    options = given;
    return handle;
  });
  return { start, handle, options: () => options };
}

const transcribed: SttResponse = { transcript: "जेवल्यानंतर पोटात जळजळ होते", language: "mr", source: "mock" };

function setup(overrides: Partial<React.ComponentProps<typeof VoiceButton>> = {}) {
  const recorder = fakeRecorder();
  const onResult = vi.fn<(result: VoiceResult) => void>();
  const onMessage = vi.fn<(message: string | null) => void>();
  const onStateChange = vi.fn<(state: VoiceState) => void>();
  const transcribe = vi.fn(async () => transcribed);
  renderWithI18n(
    <VoiceButton
      language="mr"
      purpose="symptoms"
      onResult={onResult}
      onMessage={onMessage}
      onStateChange={onStateChange}
      recorder={recorder.start}
      transcribe={transcribe}
      {...overrides}
    />,
  );
  return { recorder, onResult, onMessage, onStateChange, transcribe };
}

beforeEach(() => {
  vi.stubGlobal("fetch", stubMeta("mock"));
  resetStores();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const micButton = () => screen.getByRole("button", { name: /speak/i });

describe("VoiceButton consent", () => {
  it("shows the one-line notice before the first recording and does not record yet", async () => {
    const { recorder } = setup();
    await settle();
    fireEvent.click(micButton());
    expect(screen.getByRole("dialog")).toHaveTextContent(noticeText);
    expect(recorder.start).not.toHaveBeenCalled();
  });

  it("closes the notice on Cancel, on Escape and on an outside press without recording", async () => {
    const { recorder } = setup();
    await settle();
    fireEvent.click(micButton());
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(micButton());
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(micButton());
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(recorder.start).not.toHaveBeenCalled();
  });

  it("records after Allow and remembers the voice consent", async () => {
    const { recorder } = setup();
    await settle();
    fireEvent.click(micButton());
    fireEvent.click(screen.getByRole("button", { name: "Allow and continue" }));
    await waitFor(() => expect(recorder.start).toHaveBeenCalledTimes(1));
    expect(sessionStore.getState().consents.voice).toBe(true);
    expect(await screen.findByRole("button", { name: "Stop recording" })).toHaveAttribute("aria-pressed", "true");
  });

  it("goes straight to recording when voice consent was already given", async () => {
    sessionStore.getState().setConsent("voice", true);
    const { recorder } = setup();
    await settle();
    fireEvent.click(micButton());
    await waitFor(() => expect(recorder.start).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("VoiceButton recording", () => {
  beforeEach(() => sessionStore.getState().setConsent("voice", true));

  it("records, transcribes and hands the text and detected language to the page", async () => {
    const { recorder, onResult, onMessage, transcribe, onStateChange } = setup();
    await settle();
    fireEvent.click(micButton());
    fireEvent.click(await screen.findByRole("button", { name: "Stop recording" }));
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));

    expect(recorder.handle.stop).toHaveBeenCalledTimes(1);
    expect(transcribe).toHaveBeenCalledWith(recording, { language: "mr", purpose: "symptoms" });
    expect(onResult).toHaveBeenCalledWith({ text: "जेवल्यानंतर पोटात जळजळ होते", language: "mr", source: "mock" });
    expect(onMessage.mock.calls.map(([message]) => message)).toEqual([null, "Listening…", "Understanding what you said…", null]);
    expect(onStateChange.mock.calls.map(([state]) => state)).toEqual(["recording", "transcribing", "idle"]);
    await waitFor(() => expect(micButton()).toBeEnabled());
  });

  it("shows a live level ring that follows the microphone level", async () => {
    const { recorder } = setup();
    await settle();
    fireEvent.click(micButton());
    const ring = await screen.findByTestId("voice-level-ring");
    act(() => recorder.options()?.onLevel?.(0.8));
    expect(ring.style.transform).toBe("scale(1.4)");
    act(() => recorder.options()?.onLevel?.(0));
    expect(ring.style.transform).toBe("scale(1)");
  });

  it("cancels on Escape without transcribing", async () => {
    const { recorder, onResult, transcribe } = setup();
    await settle();
    fireEvent.click(micButton());
    await screen.findByRole("button", { name: "Stop recording" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(recorder.handle.cancel).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(micButton()).toBeInTheDocument());
    expect(transcribe).not.toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
  });

  it("stops by itself when the recorder reports the time limit", async () => {
    const { recorder, onResult } = setup();
    await settle();
    fireEvent.click(micButton());
    await screen.findByRole("button", { name: "Stop recording" });
    await act(async () => recorder.options()?.onAutoStop?.());
    await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
  });

  it("limits recordings to 28 seconds", async () => {
    const { recorder } = setup();
    await settle();
    fireEvent.click(micButton());
    await waitFor(() => expect(recorder.options()?.maxMs).toBe(28_000));
  });

  it("ignores a second click while a recording is starting", async () => {
    const { recorder } = setup();
    await settle();
    fireEvent.click(micButton());
    fireEvent.click(micButton());
    await settle();
    expect(recorder.start).toHaveBeenCalledTimes(1);
  });

  it("cancels the recording if the page goes away mid-recording", async () => {
    const recorder = fakeRecorder();
    const { unmount } = renderWithI18n(
      <VoiceButton language="en" purpose="any" onResult={vi.fn()} recorder={recorder.start} transcribe={vi.fn()} />,
    );
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /speak/i }));
    await screen.findByRole("button", { name: "Stop recording" });
    unmount();
    expect(recorder.handle.cancel).toHaveBeenCalled();
  });
});

describe("VoiceButton errors never block typing", () => {
  beforeEach(() => sessionStore.getState().setConsent("voice", true));

  async function failWith(cause: unknown, options: { atRecorder?: boolean } = {}) {
    const recorder = options.atRecorder
      ? { ...fakeRecorder(), start: vi.fn(async () => Promise.reject(cause)) }
      : fakeRecorder();
    const transcribe = vi.fn(async () => Promise.reject(cause));
    const onMessage = vi.fn<(message: string | null) => void>();
    const onResult = vi.fn();
    renderWithI18n(<VoiceButton language="en" purpose="any" onResult={onResult} onMessage={onMessage} recorder={recorder.start as never} transcribe={transcribe} />);
    await settle();
    fireEvent.click(screen.getByRole("button", { name: /speak/i }));
    if (!options.atRecorder) fireEvent.click(await screen.findByRole("button", { name: "Stop recording" }));
    await waitFor(() => expect(onMessage.mock.calls.at(-1)?.[0]).not.toBeNull());
    expect(onResult).not.toHaveBeenCalled();
    return onMessage.mock.calls.at(-1)?.[0];
  }

  it("explains a blocked microphone", async () => {
    expect(await failWith(new RecorderError("denied"), { atRecorder: true })).toBe("Microphone access is blocked. You can type instead.");
  });

  it("explains a missing microphone", async () => {
    expect(await failWith(new RecorderError("no_device"), { atRecorder: true })).toBe("No microphone was found. You can type instead.");
  });

  it("asks to try again when no words were heard", async () => {
    expect(await failWith(new ApiError("no_speech", "x", true, 400))).toBe("We could not hear any words. Please try again.");
  });

  it("asks to wait when rate limited", async () => {
    expect(await failWith(new ApiError("rate_limited", "x", true, 429))).toBe("Too many tries. Please wait a moment.");
  });

  it("falls back to a calm message for network and server problems", async () => {
    expect(await failWith(new ApiError("network_error", "x", true, 0))).toBe("Voice is not working right now. You can type instead.");
    cleanup();
    expect(await failWith(new ApiError("sarvam_timeout", "x", true, 504))).toBe("Voice is not working right now. You can type instead.");
  });

  it("returns to the idle mic after an error so the person can try again", async () => {
    await failWith(new ApiError("sarvam_failed", "x", true, 502));
    await waitFor(() => expect(screen.getByRole("button", { name: /speak/i })).toBeEnabled());
  });

  it("hides the mic for good when the server says voice is unavailable", async () => {
    await failWith(new ApiError("sarvam_unavailable", "x", false, 503));
    await waitFor(() => expect(screen.queryByRole("button", { name: /speak/i })).toBeNull());
  });
});

describe("VoiceButton visibility", () => {
  it("is hidden when the server has no voice at all", async () => {
    vi.stubGlobal("fetch", stubMeta("off"));
    setup();
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("stays visible when the server cannot be asked, because typing still works either way", async () => {
    vi.stubGlobal("fetch", stubMeta("broken"));
    setup();
    await settle();
    expect(micButton()).toBeInTheDocument();
  });

  it.each(["live", "mock"] as const)("is shown in %s mode", async (mode) => {
    vi.stubGlobal("fetch", stubMeta(mode));
    setup();
    await settle();
    expect(micButton()).toBeInTheDocument();
  });
});
