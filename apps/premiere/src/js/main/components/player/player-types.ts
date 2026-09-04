export const PLAYBACK_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

export interface QualityLevel {
  index: number;
  height?: number;
  width?: number;
  bitrate?: number;
}

export type TimeMode = "timecode" | "frames" | "seconds";

export const TIME_MODES: { key: TimeMode; label: string }[] = [
  { key: "timecode", label: "Timecode" },
  { key: "frames", label: "Frames" },
  { key: "seconds", label: "Seconds" },
];
