/**
 * Emoji palette for the comment box, replies and reactions: category tabs, a
 * search box, a recents row, and a footer naming whatever is under the cursor.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useApp } from "../state";
import {
  EMOJI_CATEGORIES,
  EMOJI_INDEX,
  searchEmoji,
  shortcodeFor,
} from "../../lib/freeframe/emoji";
import { Dropdown } from "./Dropdown";
import { IconClock, IconEmoji, IconSearch } from "./Icons";

const RECENT_LIMIT = 16;

export const EmojiPicker = ({
  onPick,
  trigger,
  title = "Emoji",
}: {
  onPick: (emoji: string) => void;
  /** Defaults to the smiley glyph; reactions pass their own. */
  trigger?: ReactNode;
  title?: string;
}) => {
  const { settings, updateSettings } = useApp();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<string>("recent");
  const [hovered, setHovered] = useState<string>("");

  const recent = settings.recentEmoji ?? [];
  const results = useMemo(() => searchEmoji(query), [query]);

  const choose = (emoji: string, close: () => void) => {
    updateSettings({
      recentEmoji: [emoji, ...recent.filter((e) => e !== emoji)].slice(0, RECENT_LIMIT),
    });
    onPick(emoji);
    close();
  };

  const Grid = ({ items, close }: { items: string[]; close: () => void }) => (
    <div className="emoji-grid">
      {items.map((emoji) => (
        <button
          key={emoji}
          className="emoji"
          onClick={() => choose(emoji, close)}
          onMouseEnter={() => setHovered(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  return (
    <Dropdown
      up
      menuClass="emoji-menu"
      title={title}
      trigger={trigger ?? <IconEmoji width={15} height={15} />}
    >
      {(close) => (
        <div className="emoji-panel" onMouseLeave={() => setHovered("")}>
          <div className="emoji-tabs">
            <button
              className={`emoji-tab${tab === "recent" ? " on" : ""}`}
              onClick={() => setTab("recent")}
              title="Recently used"
            >
              <IconClock width={14} height={14} />
            </button>
            {EMOJI_CATEGORIES.map((category) => (
              <button
                key={category.key}
                className={`emoji-tab${tab === category.key ? " on" : ""}`}
                onClick={() => setTab(category.key)}
                title={category.label}
              >
                {category.tab}
              </button>
            ))}
          </div>

          <div className="field emoji-search">
            <IconSearch width={13} height={13} />
            <input
              type="search"
              placeholder="Search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="emoji-scroll">
            {query.trim() ? (
              results.length ? (
                <>
                  <div className="emoji-heading">Results</div>
                  <Grid items={results.map(([emoji]) => emoji)} close={close} />
                </>
              ) : (
                <p className="muted empty">Nothing matches “{query.trim()}”.</p>
              )
            ) : tab === "recent" ? (
              recent.length ? (
                <>
                  <div className="emoji-heading">Recently used</div>
                  <Grid items={recent} close={close} />
                </>
              ) : (
                <p className="muted empty">Nothing used yet.</p>
              )
            ) : (
              EMOJI_CATEGORIES.filter((category) => category.key === tab).map(
                (category) => (
                  <div key={category.key}>
                    <div className="emoji-heading">{category.label}</div>
                    <Grid items={category.emoji.map(([emoji]) => emoji)} close={close} />
                  </div>
                )
              )
            )}
          </div>

          <div className="emoji-foot">
            {hovered ? (
              <>
                <span className="emoji-foot-glyph">{hovered}</span>
                <span className="emoji-foot-name">
                  <strong>{EMOJI_INDEX[hovered] ?? "emoji"}</strong>
                  <em>{shortcodeFor(EMOJI_INDEX[hovered] ?? "emoji")}</em>
                </span>
              </>
            ) : (
              <span className="emoji-foot-name muted">Pick an emoji</span>
            )}
          </div>
        </div>
      )}
    </Dropdown>
  );
};
