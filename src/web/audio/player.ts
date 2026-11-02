export interface PlaybackHandle {
  stop: () => void;
  finished: Promise<void>;
}

export type AudioFactory = (source: string) => HTMLAudioElement;

const defaultFactory: AudioFactory = (source) => new Audio(source);

let current: PlaybackHandle | null = null;

export function stopAllPlayback(): void {
  current?.stop();
  current = null;
}

export function playAudios(audios: readonly string[], factory: AudioFactory = defaultFactory): PlaybackHandle {
  stopAllPlayback();
  let stopped = false;
  let active: HTMLAudioElement | null = null;
  let finish: () => void = () => undefined;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });

  const handle: PlaybackHandle = {
    stop() {
      if (stopped) return;
      stopped = true;
      active?.pause();
      finish();
    },
    finished,
  };

  const playFrom = async (index: number): Promise<void> => {
    const chunk = audios[index];
    if (stopped || chunk === undefined) {
      finish();
      return;
    }
    const element = factory(`data:audio/wav;base64,${chunk}`);
    active = element;
    await new Promise<void>((resolve, reject) => {
      element.onended = () => resolve();
      element.onerror = () => reject(new Error("audio playback failed"));
      element.play().catch(reject);
    });
    await playFrom(index + 1);
  };

  current = handle;
  void playFrom(0).catch(() => finish());
  void finished.then(() => {
    if (current === handle) current = null;
  });
  return handle;
}
