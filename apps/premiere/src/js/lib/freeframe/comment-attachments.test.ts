import { describe, expect, it } from "vitest";
import { imageFromClipboard, validateCommentAttachment } from "./comment-attachments";

describe("comment attachments", () => {
  it("rejects empty and oversized files before creating an attachment record", () => {
    expect(validateCommentAttachment(new File([], "empty.png", { type: "image/png" }))).toBe(
      "The selected file is empty."
    );
    expect(
      validateCommentAttachment(
        new File([new Uint8Array(100 * 1024 * 1024 + 1)], "large.bin")
      )
    ).toBe("Attachments must be 100 MB or smaller.");
  });

  it("accepts a normal image attachment", () => {
    expect(validateCommentAttachment(new File(["image"], "frame.png", { type: "image/png" }))).toBeNull();
  });

  it("gets an image file from the clipboard", () => {
    const image = new File(["image"], "clipboard.png", { type: "image/png" });
    const items = [{ kind: "file", type: "image/png", getAsFile: () => image }];

    expect(imageFromClipboard(items)).toBe(image);
    expect(imageFromClipboard([{ kind: "string", type: "text/plain", getAsFile: () => null }])).toBeNull();
  });
});
