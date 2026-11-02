export interface Recording {
  blob: Blob;
  fileName: string;
}

export interface RecorderHandle {
  stop: () => Promise<Recording>;
  cancel: () => void;
}

export interface RecorderOptions {
  maxMs: number;
  onLevel?: (level: number) => void;
  onAutoStop?: () => void;
}

export type StartRecording = (options: RecorderOptions) => Promise<RecorderHandle>;

export const maxRecordingMs = 28_000;

export const startRecordingOnDemand: StartRecording = async (options) => {
  const { startRecording } = await import("./recorder");
  return startRecording(options);
};
