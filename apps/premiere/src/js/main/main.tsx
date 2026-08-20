import { useEffect, useState } from "react";
import { AppProvider, useApp } from "./state";
import { Login } from "./components/Login";
import { ProjectGrid } from "./components/ProjectGrid";
import { AssetGrid } from "./components/AssetGrid";
import { AssetView } from "./components/AssetView";
import { ExportView } from "./components/ExportView";
import { SequencesView } from "./components/SequencesView";
import { SettingsView } from "./components/SettingsView";
import type { Asset, Project } from "../lib/freeframe/types";
import {
  getLink,
  inPremiere,
  setLink as setHostLink,
  type AssetLink,
} from "../lib/freeframe/host";
import { linkKey } from "../lib/freeframe/settings";
import { IconComment, IconGrid, IconSettings, IconUpload } from "./components/Icons";
import "./main.scss";

type Tab = "browse" | "review" | "sequences" | "settings";

const Shell = () => {
  const { status, api, settings, updateSettings, host, exportJobs } = useApp();
  const [tab, setTab] = useState<Tab>("browse");
  const [project, setProject] = useState<Project | null>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [link, setLink] = useState<AssetLink | null>(null);
  const [exporting, setExporting] = useState(false);

  const sequenceKey = host.sequenceId ? linkKey(host.projectPath ?? "", host.sequenceId) : "";

  // Follow whichever sequence is in front: read its link, and open the asset it
  // points at so switching sequences switches the review context too.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sequenceKey) {
        setLink(null);
        return;
      }
      const stored = inPremiere() ? await getLink() : null;
      const resolved = stored ?? settings.links[sequenceKey] ?? null;
      if (cancelled) return;
      setLink(resolved);
      if (resolved && resolved.assetId !== asset?.id) {
        try {
          const linked = await api.asset(resolved.assetId);
          if (!cancelled) setAsset(linked);
        } catch (e) {
          // The asset may have been deleted or moved out of reach; keep the
          // link so the user can see it and unlink deliberately.
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // `asset` is deliberately excluded: this reacts to the sequence changing.
  }, [sequenceKey, api]);

  const onLinkChange = (next: AssetLink | null) => {
    setLink(next);
    if (!sequenceKey) return;
    const links = { ...settings.links };
    if (next) links[sequenceKey] = next;
    else delete links[sequenceKey];
    updateSettings({ links });
  };

  const activeJobs = exportJobs.filter((job) => job.phase !== "done").length;

  /**
   * A finished export *is* the link: the asset came out of this sequence, so
   * bind them. Without this the version stack could never turn itself on —
   * only the manual "Link to Premiere Sequence" ever created a link.
   */
  const latestExport = settings.exportHistory?.[0];
  useEffect(() => {
    if (!latestExport || !host.ok || !sequenceKey) return;
    if (latestExport.sequenceName !== host.sequenceName) return;
    if (link?.assetId === latestExport.assetId) return;
    const next: AssetLink = {
      assetId: latestExport.assetId,
      assetName: latestExport.name,
      projectId: latestExport.projectId,
      projectName: latestExport.projectName,
      offsetSeconds: link?.offsetSeconds ?? 0,
    };
    setHostLink(next);
    onLinkChange(next);
  }, [latestExport?.assetId, latestExport?.uploadedAt, host.ok, host.sequenceName, sequenceKey]);

  const openAsset = (next: Asset) => {
    setAsset(next);
    setTab("review");
  };

  if (status === "loading") return <p className="muted center">Connecting…</p>;
  if (status === "unauthenticated") return <Login />;

  return (
    <>
      <nav className="tabs">
        <button className={tab === "browse" ? "on" : ""} onClick={() => setTab("browse")}>
          <IconGrid width={14} height={14} />
          Browse
        </button>
        <button
          className={tab === "review" ? "on" : ""}
          onClick={() => setTab("review")}
          disabled={!asset}
        >
          <IconComment width={14} height={14} />
          Review
        </button>
        <button
          className={tab === "sequences" ? "on" : ""}
          onClick={() => setTab("sequences")}
        >
          <IconUpload width={14} height={14} />
          Sequences
          {!!activeJobs && <em className="tab-badge">{activeJobs}</em>}
        </button>
        <button
          className={`icon-only${tab === "settings" ? " on" : ""}`}
          onClick={() => setTab("settings")}
          title="Settings"
        >
          <IconSettings width={14} height={14} />
        </button>
      </nav>

      <main className="content">
        {tab === "browse" &&
          (project ? (
            <AssetGrid
              project={project}
              onBack={() => setProject(null)}
              onOpenAsset={openAsset}
              onExport={() => setExporting(true)}
              link={link}
            />
          ) : (
            <ProjectGrid
              onOpen={(next) => {
                setProject(next);
                updateSettings({ lastProjectId: next.id });
              }}
            />
          ))}
        {tab === "review" && asset && (
          <AssetView
            asset={asset}
            link={link}
            onLinkChange={onLinkChange}
            onBack={() => setTab("browse")}
            onExport={() => setExporting(true)}
          />
        )}
        {tab === "sequences" && (
          <SequencesView
            link={link}
            onExport={() => setExporting(true)}
            onOpenAsset={openAsset}
          />
        )}
        {tab === "settings" && <SettingsView />}
      </main>

      {exporting && <ExportView link={link} onClose={() => setExporting(false)} />}
    </>
  );
};

export const App = () => (
  // The panel keeps its own dark surface rather than following Premiere's theme
  // colour, which is several steps lighter than the FreeFrame palette.
  <div className="app">
    <AppProvider>
      <Shell />
    </AppProvider>
  </div>
);
