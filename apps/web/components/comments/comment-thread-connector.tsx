"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const COMMENT_THREAD_AVATAR_ATTRIBUTE = "data-comment-thread-avatar";

interface CommentThreadConnectorProps {
  active: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Draws the reply rail between the actual centers of the first and last avatar.
 * Measuring the anchors keeps the rail correct when comment bodies wrap or
 * actions change the height of either row.
 */
export function CommentThreadConnector({
  active,
  children,
  className,
}: CommentThreadConnectorProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [rail, setRail] = React.useState({ left: 0, top: 0, height: 0 });

  const updateRail = React.useCallback(() => {
    const root = rootRef.current;
    if (!root || !active) {
      setRail({ left: 0, top: 0, height: 0 });
      return;
    }

    const anchors = root.querySelectorAll<HTMLElement>(
      `[${COMMENT_THREAD_AVATAR_ATTRIBUTE}]`,
    );
    if (anchors.length < 2) {
      setRail({ left: 0, top: 0, height: 0 });
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const firstRect = anchors[0].getBoundingClientRect();
    const lastRect = anchors[anchors.length - 1].getBoundingClientRect();
    const left = firstRect.left - rootRect.left + firstRect.width / 2;
    const top = firstRect.top - rootRect.top + firstRect.height / 2;
    const bottom = lastRect.top - rootRect.top + lastRect.height / 2;
    setRail({ left, top, height: Math.max(0, bottom - top) });
  }, [active]);

  React.useLayoutEffect(() => {
    updateRail();
    const root = rootRef.current;
    if (!root) return;
    const observer = new ResizeObserver(updateRail);
    observer.observe(root);
    window.addEventListener("resize", updateRail);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateRail);
    };
  }, [updateRail]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {active && rail.height > 0 && (
        <span
          className="pointer-events-none absolute z-0 w-px bg-border"
          style={{ left: rail.left, top: rail.top, height: rail.height }}
        />
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
