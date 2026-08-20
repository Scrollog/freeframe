/** Modal that asks for a single line of text — used to create a project. */
import { useEffect, useState } from "react";

export const PromptDialog = ({
  title,
  label,
  placeholder,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="scrim" onClick={onCancel}>
      <div className="dialog prompt" onClick={(event) => event.stopPropagation()}>
        <h3>{title}</h3>
        <label>
          {label}
          <input
            type="text"
            value={value}
            placeholder={placeholder}
            autoFocus
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && value.trim()) onConfirm(value.trim());
            }}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={busy || !value.trim()}
            onClick={() => onConfirm(value.trim())}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
