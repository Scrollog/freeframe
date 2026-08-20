/**
 * A curated emoji set for the picker.
 *
 * Hand-held rather than pulled from a package: the full Unicode data is a
 * multi-megabyte dependency, and a review panel needs the ones people actually
 * reach for on a cut, not every skin-tone variant of every glyph.
 */

export interface EmojiCategory {
  key: string;
  /** Shown as the tab. Using the glyph itself avoids inventing nine icons. */
  tab: string;
  label: string;
  emoji: [string, string][];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: "people",
    tab: "😀",
    label: "Smileys & People",
    emoji: [
      ["😀", "grinning face"],
      ["😃", "smiley"],
      ["😄", "smile"],
      ["😁", "grin"],
      ["😆", "laughing"],
      ["😅", "sweat smile"],
      ["🤣", "rolling on the floor laughing"],
      ["😂", "joy"],
      ["🙂", "slightly smiling face"],
      ["😉", "wink"],
      ["😊", "blush"],
      ["😍", "heart eyes"],
      ["😘", "kissing heart"],
      ["😎", "sunglasses"],
      ["🤩", "star struck"],
      ["🤔", "thinking face"],
      ["🤨", "raised eyebrow"],
      ["😐", "neutral face"],
      ["😴", "sleeping"],
      ["😌", "relieved"],
      ["😔", "pensive"],
      ["😢", "cry"],
      ["😭", "sob"],
      ["😤", "triumph"],
      ["😡", "rage"],
      ["🤯", "mind blown"],
      ["😱", "screaming in fear"],
      ["😳", "flushed"],
      ["🥲", "smiling face with tear"],
      ["🫠", "melting face"],
      ["👍", "thumbs up"],
      ["👎", "thumbs down"],
      ["👏", "clap"],
      ["🙌", "raising hands"],
      ["🙏", "folded hands"],
      ["👀", "eyes"],
      ["💪", "flexed biceps"],
      ["🫡", "saluting face"],
      ["🤝", "handshake"],
      ["👋", "waving hand"],
    ],
  },
  {
    key: "review",
    tab: "🎬",
    label: "Editing & Review",
    emoji: [
      ["🎬", "clapper board"],
      ["🎞️", "film frames"],
      ["📹", "video camera"],
      ["🎥", "movie camera"],
      ["🖼️", "framed picture"],
      ["🎧", "headphone"],
      ["🔊", "loud sound"],
      ["🔇", "muted"],
      ["🎵", "musical note"],
      ["✂️", "scissors"],
      ["🩹", "adhesive bandage"],
      ["🔁", "repeat"],
      ["⏱️", "stopwatch"],
      ["⏭️", "next track"],
      ["🐛", "bug"],
      ["🎨", "artist palette"],
      ["🖌️", "paintbrush"],
      ["💡", "light bulb"],
      ["🧠", "brain"],
      ["📝", "memo"],
      ["📌", "pushpin"],
      ["🔍", "magnifying glass"],
      ["⚡", "high voltage"],
      ["🚀", "rocket"],
    ],
  },
  {
    key: "symbols",
    tab: "✅",
    label: "Marks & Symbols",
    emoji: [
      ["✅", "check mark button"],
      ["☑️", "check box"],
      ["✔️", "check mark"],
      ["❌", "cross mark"],
      ["⛔", "no entry"],
      ["⚠️", "warning"],
      ["❓", "question mark"],
      ["❗", "exclamation mark"],
      ["‼️", "double exclamation"],
      ["💯", "hundred points"],
      ["🔥", "fire"],
      ["✨", "sparkles"],
      ["⭐", "star"],
      ["🌟", "glowing star"],
      ["❤️", "red heart"],
      ["🧡", "orange heart"],
      ["💛", "yellow heart"],
      ["💚", "green heart"],
      ["💙", "blue heart"],
      ["💜", "purple heart"],
      ["🖤", "black heart"],
      ["🔴", "red circle"],
      ["🟠", "orange circle"],
      ["🟡", "yellow circle"],
      ["🟢", "green circle"],
      ["🔵", "blue circle"],
      ["🟣", "purple circle"],
      ["⚫", "black circle"],
    ],
  },
  {
    key: "objects",
    tab: "💼",
    label: "Objects & Places",
    emoji: [
      ["💼", "briefcase"],
      ["📁", "file folder"],
      ["📅", "calendar"],
      ["⏰", "alarm clock"],
      ["💰", "money bag"],
      ["📈", "chart increasing"],
      ["📉", "chart decreasing"],
      ["🔒", "locked"],
      ["🔑", "key"],
      ["🖥️", "desktop computer"],
      ["💾", "floppy disk"],
      ["🔋", "battery"],
      ["☕", "hot beverage"],
      ["🍕", "pizza"],
      ["🍿", "popcorn"],
      ["🎉", "party popper"],
      ["🎁", "wrapped gift"],
      ["🏆", "trophy"],
      ["✈️", "airplane"],
      ["🌍", "globe"],
      ["🌙", "crescent moon"],
      ["☀️", "sun"],
      ["🌧️", "rain cloud"],
      ["🐛", "caterpillar"],
    ],
  },
];

/** Flat lookup for search and for naming whatever is under the cursor. */
export const EMOJI_INDEX: Record<string, string> = Object.fromEntries(
  EMOJI_CATEGORIES.flatMap((category) => category.emoji)
);

export const searchEmoji = (query: string): [string, string][] => {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return EMOJI_CATEGORIES.flatMap((category) => category.emoji).filter(([, name]) =>
    name.includes(needle)
  );
};

/** `waving hand` → `:waving_hand:`, the shortcode shown beside the name. */
export const shortcodeFor = (name: string): string => `:${name.replace(/\s+/g, "_")}:`;
