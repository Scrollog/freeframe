import { IconInfo } from "./Icons";

/** iOS-style switch used by the export options. */
export const Toggle = ({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Shown on an info glyph beside the label. */
  hint?: string;
  disabled?: boolean;
}) => (
  <label className={`switch-row${disabled ? " off" : ""}`}>
    <span className="switch-label">
      {label}
      {hint && (
        <span className="switch-hint" title={hint}>
          <IconInfo width={13} height={13} />
        </span>
      )}
    </span>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch${checked ? " on" : ""}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  </label>
);
