/**
 * Finds the user's Media Encoder export presets on disk.
 *
 * `encodeSequence` needs a path to an .epr file and Adobe exposes no API for
 * listing them, so the panel reads the two places they live: the user's own
 * presets under Documents, and the system presets shipped with Media Encoder.
 * Only the codec folders worth exporting review copies from are scanned — the
 * full system set runs to several hundred files, most of them tape formats.
 */
import { fs, os, path } from "../cep/node";

export interface Preset {
  name: string;
  file: string;
  group: string;
}

/**
 * Media Encoder names its system preset folders by codec FourCC. These are the
 * ones that make sense for a review upload.
 */
const SYSTEM_GROUPS: { dir: string; group: string }[] = [
  { dir: "4E49434B_48323634", group: "H.264" },
  { dir: "4A454646_48455643", group: "HEVC" },
  { dir: "3F3F3F3F_4D6F6F56", group: "QuickTime" },
];

const listEpr = (dir: string): string[] => {
  try {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((file) => file.toLowerCase().endsWith(".epr"))
      .map((file) => path.join(dir, file));
  } catch (e) {
    return [];
  }
};

const userPresetDirs = (): string[] => {
  const root = path.join(os.homedir(), "Documents", "Adobe", "Adobe Media Encoder");
  try {
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root)
      // Version folders sort newest-first so recent presets lead the list.
      .filter((entry) => /^\d+\.\d+$/.test(entry))
      .sort((a, b) => parseFloat(b) - parseFloat(a))
      .map((version) => path.join(root, version, "Presets"));
  } catch (e) {
    return [];
  }
};

const systemRoots = (): string[] => {
  const bases = [
    process.env["ProgramFiles"] || "C:\\Program Files",
    "/Applications",
  ];
  const roots: string[] = [];
  bases.forEach((base) => {
    const adobe = path.join(base, "Adobe");
    try {
      if (!fs.existsSync(adobe)) return;
      fs.readdirSync(adobe)
        .filter((entry) => entry.indexOf("Media Encoder") > -1)
        .forEach((entry) =>
          roots.push(path.join(adobe, entry, "MediaIO", "systempresets"))
        );
    } catch (e) {
      // An unreadable Program Files just means no system presets are offered.
    }
  });
  return roots;
};

/** Every preset we can find, user presets first. */
export const findPresets = (): Preset[] => {
  const seen = new Set<string>();
  const presets: Preset[] = [];

  const add = (file: string, group: string) => {
    const name = path.basename(file, path.extname(file));
    const key = `${group}/${name}`;
    if (seen.has(key)) return;
    seen.add(key);
    presets.push({ name, file, group });
  };

  userPresetDirs().forEach((dir) => listEpr(dir).forEach((file) => add(file, "My presets")));
  systemRoots().forEach((root) =>
    SYSTEM_GROUPS.forEach(({ dir, group }) =>
      listEpr(path.join(root, dir)).forEach((file) => add(file, group))
    )
  );

  return presets;
};
