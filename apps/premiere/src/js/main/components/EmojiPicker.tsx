/** Compact emoji palette for the comment box, replies and reactions. */
import type { ReactNode } from "react";
import { Dropdown } from "./Dropdown";
import { IconEmoji } from "./Icons";

const EMOJI = [
  "👍", "👎", "❤️", "🔥", "🎉", "👏", "🙌", "✅",
  "❌", "⚠️", "❓", "💡", "👀", "🤔", "😂", "😅",
  "😍", "😎", "🥲", "😴", "🙏", "💪", "🚀", "⏱️",
  "🎬", "🎞️", "🎧", "🎨", "✂️", "🔊", "🔇", "🔁",
  "⭐", "✨", "💯", "🧠", "🐛", "🩹", "📌", "📝",
];

export const EmojiPicker = ({
  onPick,
  trigger,
  title = "Emoji",
}: {
  onPick: (emoji: string) => void;
  /** Defaults to the smiley glyph; reactions pass their own. */
  trigger?: ReactNode;
  title?: string;
}) => (
  <Dropdown
    up
    menuClass="emoji-menu"
    title={title}
    trigger={trigger ?? <IconEmoji width={15} height={15} />}
  >
    {(close) => (
      <div className="emoji-grid">
        {EMOJI.map((emoji) => (
          <button
            key={emoji}
            className="emoji"
            onClick={() => {
              onPick(emoji);
              close();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    )}
  </Dropdown>
);
