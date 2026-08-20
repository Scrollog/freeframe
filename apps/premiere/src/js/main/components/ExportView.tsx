/**
 * Renders the active sequence through Media Encoder and uploads the result to
 * FreeFrame — as a new version of the linked asset, or as a new asset.
 */
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../state";
import type { AssetLink } from "../../lib/freeframe/host";
import { findPresets, type Preset } from "../../lib/freeframe/presets";
import { Dropdown, MenuRadio } from "./Dropdown";
import { Toggle } from "./Toggle";
import { LocationPicker, type UploadLocation } from "./LocationPicker";
import { IconChevronDown, IconClose, IconRefresh, IconRename } from "./Icons";

/** `encodeSequence` work-area codes. */
const RANGES = [
  { value: 0, label: "Entire Sequence" },
  { value: 1, label: "In/Out Points" },
];

export const ExportView = ({
  link,
  onClose,
}: {
  link: AssetLink | null;
  onClose: () => void;
}) => {
  const { api, settings, updateSettings, host, startExport } = useApp();
  const [name, setName] = useState("");
  const [location, setLocation] = useState<UploadLocation | null>(null);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [range, setRange] = useState(0);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetPath, setPresetPath] = useState(settings.presetPath);
  const [markersAsComments, setMarkersAsComments] = useState(false);
  const [keepLocalCopy, setKeepLocalCopy] = useState(false);
  const [versionStack, setVersionStack] = useState(!!link);
  const [nextVersion, setNextVersion] = useState(0);
  // The link can outlive its asset — deleted here, on the web, or by someone
  // else. Until the version count comes back we don't know which.
  const [linkedAssetGone, setLinkedAssetGone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setName(host.sequenceName ?? ""), [host.sequenceName]);
  useEffect(() => setVersionStack(!!link), [link]);

  // Show which version the render will land on, the way the web viewer does.
  useEffect(() => {
    setNextVersion(0);
    setLinkedAssetGone(false);
    if (!link) return;
    let cancelled = false;
    api
      .versions(link.assetId)
      .then((list) => !cancelled && setNextVersion(list.length + 1))
      .catch(() => {
        if (cancelled) return;
        // Nothing to stack onto: fall back to creating a separate asset.
        setLinkedAssetGone(true);
        setVersionStack(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, link]);

  // Presets come off disk; rescanning is cheap and only happens on demand.
  const loadPresets = () => {
    const found = findPresets();
    setPresets(found);
    if (!presetPath && found.length) {
      setPresetPath(found[0].file);
      updateSettings({ presetPath: found[0].file });
    }
  };
  useEffect(loadPresets, []);

  // Default the destination to the linked asset's project — and re-pin it
  // whenever stacking is switched on, since the version has to go there.
  useEffect(() => {
    if (!link) return;
    if (location && !versionStack) return;
    if (versionStack && location?.projectId === link.projectId) return;
    setLocation({
      projectId: link.projectId,
      projectName: link.projectName || "Linked project",
      folderId: null,
      folderName: "Assets",
    });
  }, [link, location, versionStack]);

  const grouped = useMemo(() => {
    const groups: Record<string, Preset[]> = {};
    presets.forEach((preset) => {
      (groups[preset.group] ||= []).push(preset);
    });
    return groups;
  }, [presets]);

  const presetName = presets.find((p) => p.file === presetPath)?.name || "None chosen";

  const onExport = async () => {
    setError("");
    if (!host.ok) {
      setError("Open a sequence in Premiere first.");
      return;
    }
    if (!presetPath) {
      setError("Choose an export preset.");
      return;
    }
    if (!location) {
      setError("Choose an upload location.");
      return;
    }
    // Hand the job to the provider and get out of the way: the render outlives
    // this dialog, and its progress shows on the Sequences tab.
    startExport({
      name: versionStack && link ? link.assetName : name || host.sequenceName || "Sequence",
      projectId: location.projectId,
      projectName: location.projectName,
      folderId: location.folderId,
      assetId: versionStack ? link?.assetId : undefined,
      presetPath,
      range,
      markersAsComments,
      keepLocalCopy,
      exportDir: settings.exportDir,
      sequenceName: host.sequenceName ?? "",
      renderMode: settings.renderMode,
    });
    onClose();
  };

  const busy = false;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  return (
    <div className="scrim" onClick={() => !busy && onClose()}>
      <div className="export-view" onClick={(event) => event.stopPropagation()}>
      {pickingLocation && (
        <LocationPicker
          onCancel={() => setPickingLocation(false)}
          onSelect={(next) => {
            setLocation(next);
            setPickingLocation(false);
            setError("");
          }}
        />
      )}

      <div className="export-head">
        <h2>Export to FreeFrame</h2>
        <button className="icon-btn" onClick={onClose} disabled={busy} title="Close">
          <IconClose width={15} height={15} />
        </button>
      </div>

      <Toggle
        label="Add to Version Stack"
        hint={
          linkedAssetGone
            ? `${link?.assetName} is no longer on the server, so there is nothing to stack onto. This export creates a new asset.`
            : link
            ? `Uploads on top of ${link.assetName} as a new version instead of creating a separate asset.`
            : "Available once this sequence has an asset — the first export creates one, or link one from the Review tab."
        }
        checked={versionStack}
        onChange={setVersionStack}
        disabled={!link || linkedAssetGone}
      />

      <div className="form-row">
        <span className="form-label">Name</span>
        <span className="name-field">
          <input
            type="text"
            value={versionStack && link ? link.assetName : name}
            placeholder={host.sequenceName ?? "Sequence"}
            disabled={versionStack}
            onChange={(e) => setName(e.target.value)}
          />
          {versionStack && !!nextVersion && (
            <em className="version-badge" title="Uploads as this version of the asset">
              v{nextVersion}
            </em>
          )}
        </span>
      </div>

      <div className="form-row">
        <span className="form-label">Upload Location</span>
        <button
          className="form-control"
          disabled={versionStack}
          title={
            versionStack
              ? "A new version always lands on the asset's own project."
              : undefined
          }
          onClick={() => setPickingLocation(true)}
        >
          <span className="control-value">
            {location
              ? `${location.projectName} / ${location.folderName}`
              : "Select a FreeFrame location"}
          </span>
          {!versionStack && <IconRename width={14} height={14} />}
        </button>
      </div>

      <div className="form-row">
        <span className="form-label">Range</span>
        <Dropdown
          align="right"
          triggerClass="form-control"
          trigger={
            <>
              <span className="control-value">
                {RANGES.find((entry) => entry.value === range)?.label}
              </span>
              <IconChevronDown width={14} height={14} />
            </>
          }
        >
          {(close) =>
            RANGES.map((entry) => (
              <MenuRadio
                key={entry.value}
                label={entry.label}
                checked={range === entry.value}
                onSelect={() => {
                  setRange(entry.value);
                  close();
                }}
              />
            ))
          }
        </Dropdown>
      </div>

      <div className="form-row">
        <span className="form-label">Render with</span>
        <Dropdown
          align="right"
          triggerClass="form-control"
          trigger={
            <>
              <span className="control-value">
                {settings.renderMode === "premiere" ? "Premiere (in-app)" : "Media Encoder"}
              </span>
              <IconChevronDown width={14} height={14} />
            </>
          }
        >
          {(close) => (
            <>
              <MenuRadio
                label="Media Encoder"
                checked={settings.renderMode === "ame"}
                onSelect={() => {
                  updateSettings({ renderMode: "ame" });
                  close();
                }}
              />
              <MenuRadio
                label="Premiere (in-app)"
                checked={settings.renderMode === "premiere"}
                onSelect={() => {
                  updateSettings({ renderMode: "premiere" });
                  close();
                }}
              />
              <div className="menu-field">
                In-app skips Media Encoder, but Premiere is busy until the
                render finishes and reports no progress here.
              </div>
            </>
          )}
        </Dropdown>
      </div>

      <div className="form-row">
        <span className="form-label">Preset</span>
        <Dropdown
          align="right"
          triggerClass="form-control"
          trigger={
            <>
              <span className="control-value">{presetName}</span>
              <IconChevronDown width={14} height={14} />
            </>
          }
        >
          {(close) => (
            <>
              {Object.entries(grouped).map(([group, entries]) => (
                <div key={group}>
                  <div className="menu-sep">{group}</div>
                  {entries.map((preset) => (
                    <MenuRadio
                      key={preset.file}
                      label={preset.name}
                      checked={presetPath === preset.file}
                      onSelect={() => {
                        setPresetPath(preset.file);
                        updateSettings({ presetPath: preset.file });
                        close();
                      }}
                    />
                  ))}
                </div>
              ))}
              {!presets.length && (
                <div className="menu-field">No .epr presets found on this machine.</div>
              )}
              <button className="menu-foot" onClick={loadPresets}>
                <IconRefresh width={13} height={13} />
                Rescan presets
              </button>
            </>
          )}
        </Dropdown>
      </div>

      <Toggle
        label="Upload Markers as Comments"
        checked={markersAsComments}
        onChange={setMarkersAsComments}
      />
      <Toggle
        label="Save a Local Copy"
        hint={`Off: the render is deleted after it uploads. On: it stays in ${
          settings.exportDir || "the project folder"
        }.`}
        checked={keepLocalCopy}
        onChange={setKeepLocalCopy}
      />
      <p className="export-meta">
        {[
          host.ok ? host.sequenceName : "No sequence open",
          host.fps ? `${host.fps.toFixed(2)} fps` : null,
          presets.length ? `${presets.length} presets found` : null,
        ]
          .filter(Boolean)
          .join("  |  ")}
      </p>

      {error && <p className="error">{error}</p>}

      <div className="dialog-actions export-actions">
        <button onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="primary" onClick={onExport} disabled={busy || !host.ok}>
          {busy ? "Working…" : "Export"}
        </button>
      </div>
      </div>
    </div>
  );
};
