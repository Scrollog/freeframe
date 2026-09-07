"use client";

import * as React from "react";
import { Check, Copy, Link2, Loader2, Plus, Search, Share2 } from "lucide-react";
import { cn, copyToClipboard } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useShareLinks } from "@/hooks/use-share-links";
import { ShareCreateDialog } from "@/components/projects/share-create-dialog";
import type { AssetResponse, ShareLinkListItem } from "@/types";

interface ShareDialogProps {
  assetId: string;
  assetName?: string;
  projectId?: string;
  asset?: AssetResponse | null;
}

/**
 * Adds an asset to an existing project share or opens the current share-link
 * creator. The former tabbed UI was replaced by ShareCreateDialog; this owns
 * only the review-page dropdown that remains in use.
 */
export function ShareDialog({ assetId, assetName, projectId, asset }: ShareDialogProps) {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [addingToToken, setAddingToToken] = React.useState<string | null>(null);
  const [addedToToken, setAddedToToken] = React.useState<string | null>(null);
  const [copiedToken, setCopiedToken] = React.useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const { shareLinks, isLoading, mutateShareLinks } = useShareLinks(projectId ?? "");
  const stableAssets = React.useMemo(() => (asset ? [asset] : []), [asset]);
  const emptyFolders = React.useMemo(() => [] as never[], []);
  const stablePreselectedItem = React.useMemo(
    () => asset
      ? { type: "asset" as const, id: asset.id, name: asset.name }
      : { type: "asset" as const, id: assetId, name: assetName || "Asset" },
    [asset, assetId, assetName],
  );

  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  React.useEffect(() => {
    if (!dropdownOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dropdownOpen]);

  const filteredLinks = React.useMemo(() => {
    if (!search.trim()) return shareLinks;
    const query = search.toLowerCase();
    return shareLinks.filter(
      (link) => link.title.toLowerCase().includes(query) || link.target_name.toLowerCase().includes(query),
    );
  }, [shareLinks, search]);

  async function handleAddToLink(link: ShareLinkListItem) {
    setAddingToToken(link.token);
    try {
      await api.post(`/share/${link.token}/add-asset/${assetId}`, {});
      setAddedToToken(link.token);
      mutateShareLinks();
      setTimeout(() => {
        setAddedToToken(null);
        setDropdownOpen(false);
      }, 1500);
    } catch {
      // The existing dropdown intentionally keeps the item available to retry.
    } finally {
      setAddingToToken(null);
    }
  }

  async function handleCopyLink(token: string, shortCode: string) {
    if (await copyToClipboard(`${window.location.origin}/s/${shortCode}`)) {
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    }
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className={cn(dropdownOpen && "bg-bg-hover")}
        >
          <Share2 className="h-4 w-4" />
          Share
        </Button>

        {dropdownOpen && (
          <div className={cn(
            "absolute right-0 top-full z-50 mt-1.5 w-80",
            "rounded-xl border border-border bg-bg-elevated shadow-xl",
            "animate-in fade-in-0 zoom-in-95 duration-150",
          )}>
            <div className="p-2">
              <button
                onClick={() => { setDropdownOpen(false); setCreateDialogOpen(true); }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90"
              >
                <Plus className="h-4 w-4" />
                New Share Link
              </button>
            </div>

            {projectId && (
              <div className="border-t border-border">
                <p className="px-3 pb-1.5 pt-2.5 text-xs font-medium text-text-tertiary">
                  Add to Existing Share Links
                </p>

                {shareLinks.length > 3 && (
                  <div className="px-2 pb-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                      <input
                        type="text"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={`Search ${shareLinks.length} Share Links`}
                        className="flex h-8 w-full rounded-md border border-border bg-bg-secondary pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                )}

                <div className="max-h-72 overflow-y-auto px-1 pb-1.5">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                    </div>
                  ) : filteredLinks.length === 0 ? (
                    <p className="py-4 text-center text-xs text-text-tertiary">
                      {search ? "No matching share links" : "No share links yet"}
                    </p>
                  ) : filteredLinks.map((link) => {
                    const isAdding = addingToToken === link.token;
                    const isAdded = addedToToken === link.token;
                    const isCopied = copiedToken === link.token;
                    return (
                      <div
                        key={link.id}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                          isAdded ? "bg-status-success/10" : "hover:bg-bg-hover",
                        )}
                      >
                        <button
                          onClick={() => handleAddToLink(link)}
                          disabled={isAdding || isAdded}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left disabled:opacity-70"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-bg-tertiary">
                            {isAdding ? <Loader2 className="h-4 w-4 animate-spin text-text-tertiary" />
                              : isAdded ? <Check className="h-4 w-4 text-status-success" />
                                : <Link2 className="h-4 w-4 text-text-tertiary" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-text-primary">{link.title || link.target_name}</p>
                            {isAdded && <p className="text-[10px] text-status-success">Asset added!</p>}
                          </div>
                        </button>
                        <button
                          onClick={() => handleCopyLink(link.token, link.short_code)}
                          className="rounded p-1.5 text-text-tertiary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
                          title="Copy link"
                          aria-label="Copy link"
                        >
                          {isCopied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {projectId && (
        <ShareCreateDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          projectId={projectId}
          currentFolderId={asset?.folder_id ?? null}
          assets={stableAssets}
          folders={emptyFolders}
          preselectedItem={stablePreselectedItem}
          onShareCreated={mutateShareLinks}
        />
      )}
    </>
  );
}
