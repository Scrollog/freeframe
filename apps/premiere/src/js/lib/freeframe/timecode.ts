/** Timecode helpers shared by the comment list and the marker sync. */

const pad = (n: number, width = 2) => String(Math.floor(n)).padStart(width, "0");

/** `HH:MM:SS:FF` for a frame-rate-aware display, or `HH:MM:SS` without one. */
export const formatTimecode = (seconds: number | null, fps?: number): string => {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return "--:--:--";
  const total = Math.max(0, seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = Math.floor(total % 60);
  if (!fps || fps <= 0) return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  // Round to the nearest frame first, so 0.9999 of a frame doesn't read as one short.
  const frames = Math.round((total - Math.floor(total)) * fps) % Math.round(fps);
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}:${pad(frames)}`;
};

/** Snaps a time to the nearest frame boundary — markers land on frames, not floats. */
export const snapToFrame = (seconds: number, fps?: number): number => {
  if (!fps || fps <= 0) return seconds;
  return Math.round(seconds * fps) / fps;
};

export const parseTimecode = (timecode: string, fps: number): number | null => {
  const parts = timecode.split(/[:;]/).map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 4) {
    const [h, m, s, f] = parts;
    return h * 3600 + m * 60 + s + (fps > 0 ? f / fps : 0);
  }
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  return null;
};
