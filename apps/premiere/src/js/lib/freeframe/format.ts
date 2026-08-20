/** Small display helpers shared by the card grids. */

/** Same eight presets, and the same hash, the web app uses for project tiles. */
const GRADIENTS = [
  ["#7c3aed", "#a855f7", "#d946ef"],
  ["#2563eb", "#4f46e5", "#8b5cf6"],
  ["#059669", "#0d9488", "#06b6d4"],
  ["#f97316", "#f59e0b", "#eab308"],
  ["#e11d48", "#db2777", "#d946ef"],
  ["#06b6d4", "#3b82f6", "#6366f1"],
  ["#0ea5e9", "#22d3ee", "#2dd4bf"],
  ["#ec4899", "#f43f5e", "#fb923c"],
];

export const gradientFor = (id: string): string => {
  const hash = id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
  const [from, via, to] = GRADIENTS[hash % GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${via}, ${to})`;
};

export const relativeTime = (iso: string): string => {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const seconds = Math.max(0, (Date.now() - then) / 1000);
  if (seconds < 60) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.floor(days)}d ago`;
  const months = days / 30;
  if (months < 12) return `${Math.floor(months)}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
};

export const formatBytes = (bytes: number): string => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, index);
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
};

/** `15:13` for a duration, matching the badge on the asset cards. */
export const formatDuration = (seconds?: number | null): string => {
  if (!seconds && seconds !== 0) return "";
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`;
};

/** `Aug 17` — the compact date the asset cards show next to the version. */
export const shortDate = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "";
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
};
