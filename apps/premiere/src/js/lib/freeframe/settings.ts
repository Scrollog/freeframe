/**
 * Panel settings, persisted per user.
 *
 * Inside Premiere this is a JSON file under the user's home directory; in the
 * browser (`yarn dev`) it falls back to localStorage so the UI still works.
 */
import { fs, os, path } from "../cep/node";

export interface AssetLink {
  assetId: string;
  assetName: string;
  projectId: string;
  projectName: string;
  versionId?: string;
  offsetSeconds?: number;
}

export interface Settings {
  /** FreeFrame API root, e.g. http://localhost:8000 — no trailing slash. */
  serverUrl: string;
  /** Web app root used by "open in browser". Empty = same as serverUrl. */
  webUrl: string;
  accessToken: string;
  refreshToken: string;
  /** Last project the user browsed, restored on launch. */
  lastProjectId: string;
  /** Absolute path to the .epr preset used when exporting to Media Encoder. */
  presetPath: string;
  /** Where renders are written before upload. Empty = next to the .prproj. */
  exportDir: string;
  /** Hide resolved comments in the list and skip them when syncing markers. */
  hideResolved: boolean;
  /** Whether FreeFrame markers are currently shown on the timeline. */
  markersVisible: boolean;
  /** Width of the comment column, in pixels, when the panel is wide enough. */
  sideWidth: number;
  /** Replay a comment's drawing over the video when it is selected. */
  annotationsVisible: boolean;
  /** Where renders happen: Media Encoder, or inside Premiere itself. */
  renderMode: "ame" | "premiere";
  /** Card size chosen under Appearance, in the browse grids. */
  cardSize: "small" | "medium" | "large";
  /** Assets this machine has exported, newest first. */
  exportHistory: {
    assetId: string;
    name: string;
    projectId: string;
    projectName: string;
    sequenceName: string;
    uploadedAt: string;
  }[];
  /** Links keyed by `<projectPath>::<sequenceId>`, mirroring the .prproj XMP. */
  links: Record<string, AssetLink>;
}

export const defaultSettings: Settings = {
  serverUrl: "",
  webUrl: "",
  accessToken: "",
  refreshToken: "",
  lastProjectId: "",
  presetPath: "",
  exportDir: "",
  hideResolved: false,
  markersVisible: true,
  sideWidth: 320,
  annotationsVisible: true,
  renderMode: "ame",
  cardSize: "medium",
  exportHistory: [],
  links: {},
};

const STORAGE_KEY = "freeframe-cep-settings";

const isCEP = () => typeof window !== "undefined" && !!window.cep;

const settingsFile = (): string => {
  const dir = path.join(os.homedir(), ".freeframe");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "premiere-panel.json");
};

export const loadSettings = (): Settings => {
  try {
    const raw = isCEP()
      ? fs.readFileSync(settingsFile(), "utf-8")
      : window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultSettings };
    return { ...defaultSettings, ...JSON.parse(raw as string) };
  } catch (e) {
    // A missing or corrupt file is normal on first run.
    return { ...defaultSettings };
  }
};

export const saveSettings = (settings: Settings): void => {
  const raw = JSON.stringify(settings, null, 2);
  try {
    if (isCEP()) {
      fs.writeFileSync(settingsFile(), raw, "utf-8");
    } else {
      window.localStorage.setItem(STORAGE_KEY, raw);
    }
  } catch (e) {
    console.error("Could not persist panel settings", e);
  }
};

export const linkKey = (projectPath: string, sequenceId: string) =>
  `${projectPath}::${sequenceId}`;
