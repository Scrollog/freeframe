import { useCallback, useEffect, useState } from "react";
import type { FreeFrameApi } from "../../lib/freeframe/api";
import type { Comment } from "../../lib/freeframe/types";

const DEFAULT_POLL_MS = 15_000;

interface UseReviewCommentsOptions {
  api: FreeFrameApi;
  assetId: string;
  versionId: string;
  onError: (message: string) => void;
  pollMs?: number;
}

/**
 * Loads the active version's discussion and refreshes it while the review
 * screen is open. Keeping this lifecycle outside AssetView prevents polling
 * concerns from being mixed with the review UI and action handlers.
 */
export const useReviewComments = ({
  api,
  assetId,
  versionId,
  onError,
  pollMs = DEFAULT_POLL_MS,
}: UseReviewCommentsOptions) => {
  const [comments, setComments] = useState<Comment[]>([]);

  const refreshComments = useCallback(async (): Promise<Comment[] | null> => {
    if (!versionId) {
      setComments([]);
      return null;
    }

    try {
      const list = await api.comments(assetId, versionId);
      setComments(list);
      return list;
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, [api, assetId, versionId, onError]);

  useEffect(() => {
    void refreshComments();
    // The API has no comment stream yet, so the panel polls while it is open.
    const timer = setInterval(refreshComments, pollMs);
    return () => clearInterval(timer);
  }, [pollMs, refreshComments]);

  return { comments, setComments, refreshComments };
};
