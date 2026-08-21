/**
 * Export jobs, owned above the export dialog.
 *
 * A render can outlive the modal that started it — Media Encoder takes minutes
 * and the upload follows — so the job list, the AME listeners and the upload
 * loop all live here, in the provider, rather than inside the dialog.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { listenTS } from "../utils/bolt";
import {
  encodeActiveSequence,
  getScratchPath,
  listAllMarkers,
  renderInPremiere,
  upsertSegmentLink,
} from "./host";
import { uploadFile } from "./upload";
import type { FreeFrameApi } from "./api";
import { fs, path } from "../cep/node";

export type ExportPhase =
  | "queued"
  | "rendering"
  | "uploading"
  | "done"
  | "failed"
  | "cancelled";

export interface ExportRequest {
  name: string;
  projectId: string;
  projectName: string;
  folderId: string | null;
  /** Set to upload as a new version of an existing asset. */
  assetId?: string;
  presetPath: string;
  range: number;
  markersAsComments: boolean;
  keepLocalCopy: boolean;
  exportDir: string;
  sequenceName: string;
  /** "ame" queues Media Encoder; "premiere" renders in-process. */
  renderMode: "ame" | "premiere";
  /** Set for an In/Out delivery that should be remembered on this timeline. */
  segment?: { id: string; inPoint: number; outPoint: number };
}

export interface ExportJob extends ExportRequest {
  /** Local id; `jobID` is Media Encoder's, learned once it accepts the render. */
  id: string;
  jobID?: string;
  phase: ExportPhase;
  progress: number;
  error?: string;
  outputPath?: string;
  uploadedAssetId?: string;
  startedAt: string;
  finishedAt?: string;
}

/** What survives a panel restart: the assets this machine has exported. */
export interface ExportHistoryEntry {
  assetId: string;
  name: string;
  projectId: string;
  projectName: string;
  sequenceName: string;
  uploadedAt: string;
  segmentId?: string;
}

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

/**
 * Deletes the render once it is safely uploaded.
 *
 * On Windows the encoder often still holds the handle for a moment after it
 * reports the job complete, so a single unlink silently leaves the file behind.
 * Retry a few times before giving up, and tell the caller either way.
 */
const removeRender = async (filePath: string): Promise<boolean> => {
  const delays = [0, 700, 2500, 6000];
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      if (!fs.existsSync(filePath)) return true;
      fs.unlinkSync(filePath);
      return true;
    } catch (e) {
      // Still locked — wait and try again.
    }
  }
  return false;
};

export const useExportJobs = (
  api: FreeFrameApi,
  onFinished: (entry: ExportHistoryEntry) => void
) => {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  // Checked between upload parts; a render already handed to AME can't be
  // recalled, so cancelling there only stops this side of the work.
  const cancelled = useRef<Set<string>>(new Set());
  // The AME callbacks fire outside React and need the live list.
  const jobsRef = useRef<ExportJob[]>([]);
  jobsRef.current = jobs;
  // Media Encoder can emit a completion callback more than once. A job is
  // allowed to enter the upload pipeline exactly once.
  const uploadStarted = useRef<Set<string>>(new Set());
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;

  const patch = useCallback((id: string, changes: Partial<ExportJob>) => {
    setJobs((current) =>
      current.map((job) => (job.id === id ? { ...job, ...changes } : job))
    );
  }, []);

  const upload = useCallback(
    async (job: ExportJob, outputPath: string) => {
      patch(job.id, { phase: "uploading", progress: 0, outputPath });
      try {
        const { assetId, versionId } = await uploadFile({
          api,
          filePath: outputPath,
          projectId: job.projectId,
          folderId: job.folderId,
          assetId: job.assetId,
          assetName: job.name,
          onProgress: (progress) => patch(job.id, { progress }),
          isCancelled: () => cancelled.current.has(job.id),
        });

        if (job.markersAsComments) {
          const markers = await listAllMarkers();
          for (const marker of markers) {
            if (
              job.segment &&
              (marker.start < job.segment.inPoint || marker.start > job.segment.outPoint)
            )
              continue;
            const body = [marker.name, marker.comment]
              .map((part) => (part || "").replace(/\[ff:[^\]]*\]/g, "").trim())
              .filter(Boolean)
              .join(" — ");
            if (!body) continue;
            try {
              await api.createComment(assetId, {
                version_id: versionId,
                body,
                timecode_start: job.segment
                  ? marker.start - job.segment.inPoint
                  : marker.start,
              });
            } catch (e) {
              // One rejected marker shouldn't abandon the rest.
            }
          }
        }

        if (job.segment) {
          const saved = await upsertSegmentLink({
            id: job.segment.id,
            inPoint: job.segment.inPoint,
            outPoint: job.segment.outPoint,
            assetId,
            assetName: job.name,
            projectId: job.projectId,
            projectName: job.projectName,
            versionId,
          });
          if (!saved.ok) {
            throw new Error(`Could not save this timeline segment: ${saved.error ?? "unknown error"}`);
          }
        }

        let leftover = false;
        if (!job.keepLocalCopy) {
          leftover = !(await removeRender(outputPath));
        }

        patch(job.id, {
          phase: "done",
          progress: 100,
          uploadedAssetId: assetId,
          finishedAt: new Date().toISOString(),
          error: leftover
            ? `Uploaded, but the render is still on disk at ${outputPath} — the encoder had it locked.`
            : undefined,
        });
        finishedRef.current({
          assetId,
          name: job.name,
          projectId: job.projectId,
          projectName: job.projectName,
          sequenceName: job.sequenceName,
          uploadedAt: new Date().toISOString(),
          segmentId: job.segment?.id,
        });
      } catch (e) {
        if (cancelled.current.has(job.id)) {
          patch(job.id, { phase: "cancelled", finishedAt: new Date().toISOString() });
          return;
        }
        patch(job.id, {
          phase: "failed",
          error: e instanceof Error ? e.message : String(e),
          finishedAt: new Date().toISOString(),
        });
      }
    },
    [api, patch]
  );

  // The listener callbacks retain no render-specific values: refs provide the
  // current job list and upload implementation.
  const uploadRef = useRef(upload);
  uploadRef.current = upload;

  useEffect(() => {
    const find = (jobID: string) =>
      jobsRef.current.find((job) => job.jobID === jobID);

    const unlistenProgress = listenTS("encodeProgress", ({ jobID, progress }) => {
      const job = find(jobID);
      if (job) patch(job.id, { phase: "rendering", progress: Math.round(progress * 100) });
    });
    const unlistenError = listenTS("encodeError", ({ jobID, message }) => {
      const job = find(jobID);
      if (job) {
        patch(job.id, {
          phase: "failed",
          error: `Media Encoder failed: ${message}`,
          finishedAt: new Date().toISOString(),
        });
      }
    });
    const unlistenComplete = listenTS("encodeComplete", ({ jobID, outputPath }) => {
      const job = find(jobID);
      if (!job || uploadStarted.current.has(job.id)) return;
      uploadStarted.current.add(job.id);
      uploadRef.current(job, outputPath);
    });
    return () => {
      unlistenProgress();
      unlistenError();
      unlistenComplete();
    };
  }, [patch]);

  const start = useCallback(
    async (request: ExportRequest) => {
      const id = `${Date.now()}`;
      const job: ExportJob = {
        ...request,
        id,
        phase: "queued",
        progress: 0,
        startedAt: new Date().toISOString(),
      };
      setJobs((current) => [job, ...current]);

      const dir = request.exportDir || (await getScratchPath());
      const safeName = (request.name || request.sequenceName || "sequence").replace(
        /[\\/:*?"<>|]/g,
        "_"
      );
      const outputPath = path.join(dir, `${safeName}_${stamp()}.mp4`);

      if (request.renderMode === "premiere") {
        // Blocking: Premiere renders in-process and returns once the file is
        // written, so there are no progress events to wait on.
        patch(id, { phase: "rendering", outputPath, progress: 0 });
        const direct = await renderInPremiere(
          request.presetPath,
          outputPath,
          request.range
        );
        if (!direct.ok) {
          patch(id, {
            phase: "failed",
            error: `Premiere could not render: ${direct.error}`,
            finishedAt: new Date().toISOString(),
          });
          return;
        }
        const started = { ...job, outputPath };
        await uploadRef.current(started, outputPath);
        return;
      }

      const result = await encodeActiveSequence(
        request.presetPath,
        outputPath,
        request.range
      );
      if (!result.ok || !result.jobID) {
        patch(id, {
          phase: "failed",
          error:
            result.error === "no_encoder"
              ? "Media Encoder is not available from this Premiere version."
              : `Could not queue the render: ${result.error}`,
          finishedAt: new Date().toISOString(),
        });
        return;
      }
      patch(id, { jobID: result.jobID, phase: "rendering", outputPath });
    },
    [patch]
  );

  /**
   * Stops an upload in flight — the next part boundary aborts it and the
   * server-side multipart upload is discarded. A render already queued in
   * Media Encoder keeps going there; only its row leaves the panel.
   */
  const cancel = useCallback(
    (id: string) => {
      cancelled.current.add(id);
      const job = jobsRef.current.find((entry) => entry.id === id);
      if (job && job.phase === "uploading") {
        patch(id, { phase: "cancelled", finishedAt: new Date().toISOString() });
        return;
      }
      setJobs((current) => current.filter((entry) => entry.id !== id));
    },
    [patch]
  );

  return { jobs, startExport: start, cancelExport: cancel };
};
