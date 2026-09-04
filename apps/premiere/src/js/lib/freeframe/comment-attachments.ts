import type { FreeFrameApi } from "./api";

const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024;

type ClipboardFileItem = Pick<DataTransferItem, "kind" | "type" | "getAsFile">;

export const validateCommentAttachment = (file: File): string | null => {
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_ATTACHMENT_SIZE) return "Attachments must be 100 MB or smaller.";
  return null;
};

/** Returns an image copied to the clipboard, leaving regular text pastes untouched. */
export const imageFromClipboard = (
  items: ArrayLike<ClipboardFileItem> | null | undefined
): File | null => {
  if (!items) return null;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (item.kind !== "file" || !item.type.startsWith("image/")) continue;

    return item.getAsFile();
  }

  return null;
};

/** Uploads a comment attachment through the API-issued, browser-reachable URL. */
export const uploadCommentAttachment = async (
  api: FreeFrameApi,
  commentId: string,
  file: File
) => {
  const contentType = file.type || "application/octet-stream";
  const upload = await api.createCommentAttachment(commentId, {
    file_name: file.name,
    file_size: file.size,
    content_type: contentType,
  });

  try {
    const response = await fetch(upload.upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!response.ok) throw new Error("Could not upload the attachment.");
  } catch (error) {
    await api.deleteCommentAttachment(commentId, upload.attachment_id).catch(() => undefined);
    throw error;
  }
};
