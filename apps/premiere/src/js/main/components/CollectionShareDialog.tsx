import { useEffect, useState } from "react";
import { useApp } from "../state";
import type { ShareLink } from "../../lib/freeframe/types";
import { openLinkInBrowser } from "../../lib/utils/bolt";
import { IconCheck, IconCopy, IconExternal, IconLink } from "./Icons";

/** Creates one share link for the folder currently open in Assets. */
export const CollectionShareDialog = ({
  projectId,
  folderId,
  name,
  onClose,
}: {
  projectId: string;
  folderId: string | null;
  name: string;
  onClose: () => void;
}) => {
  const { api, settings } = useApp();
  const [share, setShare] = useState<ShareLink | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const webBase = (settings.webUrl || settings.serverUrl).replace(/\/+$/, "");
  const url = share ? `${webBase}/s/${share.short_code ?? share.token}` : "";
  const target = folderId ? "folder" : "project";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const link = folderId
          ? await api.createFolderShare(folderId, { title: name })
          : await api.createProjectShare(projectId, { title: name });
        if (!cancelled) setShare(link);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, folderId, name, projectId]);

  const copy = () => {
    if (!url) return;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="share-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="share-head">
          <h3>Share {name}</h3>
        </div>
        <p className="muted">
          {folderId
            ? "Everyone with this link can review the assets in this folder."
            : "Everyone with this link can review the assets in this project."}
        </p>
        <div className="link-box">
          <input type="text" readOnly value={share ? url : "Creating link…"} />
          {copied && (
            <span className="copied">
              Link copied! <IconCheck width={12} height={12} />
            </span>
          )}
          <button className="icon-btn" onClick={copy} disabled={!url} title="Copy link">
            <IconLink width={15} height={15} />
          </button>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="share-foot">
          <span className="spacer" />
          <button disabled={!url} onClick={copy}>
            <IconCopy width={14} height={14} />
            Copy Link
          </button>
          <button
            className="text-btn"
            disabled={!url}
            onClick={() => url && openLinkInBrowser(url)}
            title={`Open shared ${target}`}
          >
            <IconExternal width={14} height={14} />
          </button>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
