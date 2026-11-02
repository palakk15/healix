import { downmixToMono, encodeWav, resampleLinear, rmsLevel, sttSampleRate } from "@core/domain/wav";
import { RecorderError, type RecorderFailure } from "./recorderError";
import type { Recording, StartRecording } from "./recorderTypes";

export { RecorderError, type RecorderFailure };

const preferredMimeTypes = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return preferredMimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
}

function classify(cause: unknown): RecorderFailure {
  const name = typeof cause === "object" && cause !== null ? (cause as { name?: string }).name : undefined;
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no_device";
  return "failed";
}

async function toWav(blob: Blob): Promise<Recording> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    const mono = resampleLinear(downmixToMono(channels), decoded.sampleRate, sttSampleRate);
    const wav = encodeWav(mono, sttSampleRate);
    return { blob: new Blob([wav.buffer as ArrayBuffer], { type: "audio/wav" }), fileName: "speech.wav" };
  } catch {
    const extension = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    return { blob, fileName: `speech.${extension}` };
  } finally {
    void context.close();
  }
}

export const startRecording: StartRecording = async (options) => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    throw new RecorderError("no_device");
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (cause) {
    throw new RecorderError(classify(cause));
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  let meterTimer: ReturnType<typeof setInterval> | undefined;
  let meterContext: AudioContext | undefined;
  if (options.onLevel) {
    try {
      meterContext = new AudioContext();
      const analyser = meterContext.createAnalyser();
      analyser.fftSize = 512;
      meterContext.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      meterTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        options.onLevel?.(rmsLevel(samples));
      }, 60);
    } catch {
      meterContext = undefined;
    }
  }

  let finished = false;
  const release = () => {
    if (finished) return;
    finished = true;
    clearTimeout(limitTimer);
    if (meterTimer) clearInterval(meterTimer);
    void meterContext?.close();
    for (const track of stream.getTracks()) track.stop();
  };

  const stopped = new Promise<void>((resolve) => recorder.addEventListener("stop", () => resolve(), { once: true }));
  const limitTimer = setTimeout(() => options.onAutoStop?.(), options.maxMs);
  recorder.start();

  return {
    async stop() {
      if (recorder.state !== "inactive") recorder.stop();
      await stopped;
      release();
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      if (blob.size === 0) throw new RecorderError("failed");
      return toWav(blob);
    },
    cancel() {
      if (recorder.state !== "inactive") recorder.stop();
      release();
    },
  };
};
