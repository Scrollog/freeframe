"use client";

import * as React from "react";
import useSWR, { mutate } from "swr";
import { api } from "@/lib/api";
import { bytesToGb, gbToBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StorageUsage } from "@/components/shared/storage-usage";
import type { InstanceSettings } from "@/types";

export function InstanceSettingsTab() {
  const { data } = useSWR<InstanceSettings>(
    "/instance/settings",
    () => api.get<InstanceSettings>("/instance/settings"),
  );

  const [gb, setGb] = React.useState<string>("");
  const [shareTitle, setShareTitle] = React.useState("");
  const [shareDescription, setShareDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState("");

  // Depend on storage_limit_bytes only — NOT the whole `data` object, whose volatile
  // storage_used_bytes changes on every SWR revalidation and would clobber an in-progress edit.
  React.useEffect(() => {
    if (data) setGb(data.storage_limit_bytes > 0 ? String(bytesToGb(data.storage_limit_bytes)) : "");
  }, [data?.storage_limit_bytes]);

  React.useEffect(() => {
    if (!data) return;
    setShareTitle(data.share_metadata_title);
    setShareDescription(data.share_metadata_description);
  }, [data?.share_metadata_title, data?.share_metadata_description]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const value = gb.trim() === "" ? 0 : gbToBytes(Number(gb));
      const updates: Record<string, string | number> = { storage_limit_bytes: value };
      if (shareTitle.trim() !== data?.share_metadata_title) {
        updates.share_metadata_title = shareTitle.trim();
      }
      if (shareDescription.trim() !== data?.share_metadata_description) {
        updates.share_metadata_description = shareDescription.trim();
      }
      await api.put("/instance/settings", updates);
      mutate("/instance/settings");
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-6 max-w-md">
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-text-primary">Instance storage</h2>
      {data && (
        <StorageUsage used={data.storage_used_bytes} limit={data.storage_limit_bytes} variant="panel" />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="storage-limit-gb" className="text-sm font-medium text-text-secondary">
          Storage limit (GB)
        </label>
        <Input
          id="storage-limit-gb"
          type="number"
          min={0}
          value={gb}
          onChange={(e) => setGb(e.target.value)}
          placeholder="0 = unlimited"
        />
        <p className="text-xs text-text-tertiary">Leave blank or 0 for unlimited.</p>
      </div>
      </div>
      <div className="space-y-3 border-t border-border pt-5">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Share link preview</h2>
          <p className="mt-1 text-xs text-text-tertiary">Shown when a public share link is sent to another app.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="share-metadata-title" className="text-sm font-medium text-text-secondary">Title</label>
          <Input
            id="share-metadata-title"
            maxLength={255}
            value={shareTitle}
            onChange={(e) => setShareTitle(e.target.value)}
            placeholder="FreeFrame"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="share-metadata-description" className="text-sm font-medium text-text-secondary">Description</label>
          <textarea
            id="share-metadata-description"
            rows={3}
            maxLength={2000}
            value={shareDescription}
            onChange={(e) => setShareDescription(e.target.value)}
            placeholder="Collaborative media review and approval platform"
            className="flex w-full resize-none rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-focus"
          />
        </div>
      </div>
      {error && <p className="text-xs text-status-error">{error}</p>}
      {saved && <p className="text-xs text-status-success">Saved.</p>}
      {/* disabled until settings load, so a click before the fetch resolves can't PUT 0 and wipe an existing cap */}
      <Button size="sm" onClick={handleSave} loading={saving} disabled={!data}>Save</Button>
    </section>
  );
}
