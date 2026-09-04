import { describe, expect, it } from "vitest";
import type { Comment } from "./types";
import {
  commentTreeContains,
  EMPTY_REVIEW_FILTERS,
  filterAndSortComments,
  insertReplyIntoThread,
  markerSignatureFor,
  resolveSequenceLink,
  timestampedComments,
} from "./review";

const comment = (overrides: Partial<Comment>): Comment => ({
  id: "comment-1",
  asset_id: "asset-1",
  version_id: "version-1",
  parent_id: null,
  timecode_start: 0,
  timecode_end: null,
  body: "Hello",
  resolved: false,
  visibility: "public",
  created_at: "2026-01-01T00:00:00.000Z",
  author: { id: "user-1", name: "Alex" },
  guest_author: null,
  replies: [],
  ...overrides,
});

describe("review rules", () => {
  it("filters the marker source exactly like the visible comment list", () => {
    const visible = filterAndSortComments({
      comments: [
        comment({ id: "open", timecode_start: 12 }),
        comment({ id: "done", resolved: true, timecode_start: 4 }),
        comment({ id: "other", author: { id: "user-2", name: "Bia" }, timecode_start: 8 }),
      ],
      filters: { ...EMPTY_REVIEW_FILTERS, person: "Alex" },
      query: "",
      sort: "timecode",
      hideResolved: true,
    });

    expect(visible.map((item) => item.id)).toEqual(["open"]);
    expect(markerSignatureFor(visible)).toBe("open:0:12");
  });

  it("uses an In/Out segment offset over a direct sequence link", () => {
    const result = resolveSequenceLink({
      assetId: "asset-1",
      versionId: "version-1",
      link: {
        assetId: "asset-1",
        assetName: "Video",
        projectId: "project-1",
        projectName: "Project",
        offsetSeconds: 0,
      },
      segmentLinks: [
        {
          id: "segment-1",
          assetId: "asset-1",
          assetName: "Video",
          projectId: "project-1",
          projectName: "Project",
          versionId: "version-1",
          inPoint: 123.5,
          outPoint: 150,
        },
      ],
    });

    expect(result.isLinked).toBe(true);
    expect(result.offsetSeconds).toBe(123.5);
  });

  it("orders timestamp navigation independently from when comments were created", () => {
    const ordered = timestampedComments([
      comment({ id: "late", timecode_start: 30 }),
      comment({ id: "without-timecode", timecode_start: null }),
      comment({ id: "early", timecode_start: 4 }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["early", "late"]);
  });

  it("inserts a reply into its nested parent without duplicating it", () => {
    const root = comment({ id: "root", replies: [comment({ id: "child" })] });
    const reply = comment({ id: "reply" });
    const inserted = insertReplyIntoThread([root], "child", reply);

    expect(inserted[0].replies[0].replies).toEqual([reply]);
    expect(commentTreeContains(inserted, "reply")).toBe(true);
    expect(insertReplyIntoThread(inserted, "child", reply)[0].replies[0].replies).toHaveLength(1);
  });

  it("searches reply text and keeps untimed notes after timed notes", () => {
    const visible = filterAndSortComments({
      comments: [
        comment({ id: "untimed", timecode_start: null, body: "General note" }),
        comment({
          id: "reply-hit",
          timecode_start: 12,
          replies: [comment({ id: "reply", parent_id: "reply-hit", body: "Needs contrast" })],
        }),
        comment({ id: "timed", timecode_start: 5, body: "Framing" }),
      ],
      filters: EMPTY_REVIEW_FILTERS,
      query: "contrast",
      sort: "timecode",
      hideResolved: false,
    });

    expect(visible.map((item) => item.id)).toEqual(["reply-hit"]);

    const chronological = filterAndSortComments({
      comments: [
        comment({ id: "untimed", timecode_start: null }),
        comment({ id: "timed", timecode_start: 5 }),
      ],
      filters: EMPTY_REVIEW_FILTERS,
      query: "",
      sort: "timecode",
      hideResolved: false,
    });
    expect(chronological.map((item) => item.id)).toEqual(["timed", "untimed"]);
  });
});
