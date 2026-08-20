/**
 * Modal confirmation. CEP blocks `window.confirm`, so consequential actions —
 * linking a sequence, deleting an asset — ask here instead.
 */
import { useEffect, type ReactNode } from "react";
import { IconAlert } from "./Icons";

export interface ConfirmRequest {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog = ({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) => {
  useEffect(() => {
    if (!request) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [request, onClose]);

  if (!request) return null;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="dialog" onClick={(event) => event.stopPropagation()}>
        <span className={`dialog-icon${request.danger ? " danger" : ""}`}>
          <IconAlert width={18} height={18} />
        </span>
        <h3>{request.title}</h3>
        <p>{request.body}</p>
        <div className="dialog-actions">
          <button onClick={onClose}>Cancel</button>
          <button
            className={request.danger ? "danger" : "primary"}
            autoFocus
            onClick={() => {
              request.onConfirm();
              onClose();
            }}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
