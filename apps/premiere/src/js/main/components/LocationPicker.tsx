/** Modal for choosing the project (and folder) a render is uploaded into. */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "../state";
import type { FolderNode, Project } from "../../lib/freeframe/types";
import { gradientFor } from "../../lib/freeframe/format";
import { IconChevronLeft, IconFolder, IconSearch } from "./Icons";

export interface UploadLocation {
  projectId: string;
  projectName: string;
  folderId: string | null;
  folderName: string;
}

const flatten = (nodes: FolderNode[], depth = 0): { node: FolderNode; depth: number }[] =>
  nodes.flatMap((node) => [
    { node, depth },
    ...flatten(node.children ?? [], depth + 1),
  ]);

export const LocationPicker = ({
  onSelect,
  onCancel,
}: {
  onSelect: (location: UploadLocation) => void;
  onCancel: () => void;
}) => {
  const { api } = useApp();
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.projects().then(setProjects).catch((e) => setError(String(e)));
  }, [api]);

  useEffect(() => {
    if (!project) return;
    setFolderId(null);
    api.folderTree(project.id).then(setFolders).catch(() => setFolders([]));
  }, [api, project]);

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((entry) => entry.name.toLowerCase().includes(needle));
  }, [projects, query]);

  const rows = useMemo(() => flatten(folders), [folders]);

  const confirm = () => {
    if (!project) return;
    const folder = rows.find((row) => row.node.id === folderId);
    onSelect({
      projectId: project.id,
      projectName: project.name,
      folderId,
      folderName: folder ? folder.node.name : "Assets",
    });
  };

  const dialog = (
    <div className="scrim picker-scrim" onClick={onCancel}>
      <div className="picker" onClick={(event) => event.stopPropagation()}>
        <div className="picker-head">
          {project && (
            <button className="icon-btn" onClick={() => setProject(null)} title="Back">
              <IconChevronLeft width={15} height={15} />
            </button>
          )}
          <div className="field">
            <IconSearch />
            <input
              type="search"
              placeholder={project ? `Find folder in ${project.name}` : "Find project"}
              value={query}
              autoFocus
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="picker-list">
          {!project &&
            visibleProjects.map((entry) => (
              <button
                key={entry.id}
                className="picker-row"
                onClick={() => {
                  setProject(entry);
                  setQuery("");
                }}
              >
                <span
                  className="swatch"
                  style={
                    entry.poster_url
                      ? { backgroundImage: `url(${entry.poster_url})` }
                      : { backgroundImage: gradientFor(entry.id) }
                  }
                />
                <span className="picker-name">{entry.name}</span>
                <span className="picker-chevron">›</span>
              </button>
            ))}

          {project && (
            <>
              <button
                className={`picker-row${folderId === null ? " on" : ""}`}
                onClick={() => setFolderId(null)}
              >
                <IconFolder width={14} height={14} />
                <span className="picker-name">Assets</span>
              </button>
              {rows
                .filter(
                  ({ node }) =>
                    !query.trim() ||
                    node.name.toLowerCase().includes(query.trim().toLowerCase())
                )
                .map(({ node, depth }) => (
                  <button
                    key={node.id}
                    className={`picker-row${folderId === node.id ? " on" : ""}`}
                    style={{ paddingLeft: `${10 + depth * 14}px` }}
                    onClick={() => setFolderId(node.id)}
                  >
                    <IconFolder width={14} height={14} />
                    <span className="picker-name">{node.name}</span>
                  </button>
                ))}
            </>
          )}
        </div>

        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button className="primary" disabled={!project} onClick={confirm}>
            Select
          </button>
        </div>
      </div>
    </div>
  );

  // ExportView animates with a CSS transform. Rendering this fixed-position
  // picker below that transformed element makes it briefly position itself
  // inside the export modal, then jump or disappear. A portal keeps it at the
  // panel root, above the export dialog.
  return typeof document === "undefined" ? dialog : createPortal(dialog, document.body);
};
