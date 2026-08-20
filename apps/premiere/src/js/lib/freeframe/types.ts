/** Subset of the FreeFrame API surface the panel consumes. */

export interface Tokens {
  access_token: string;
  refresh_token: string;
  token_type?: string;
  needs_password?: boolean;
}

export interface Me {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  is_superadmin?: boolean;
}

export interface Project {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  poster_url?: string | null;
  asset_count?: number;
  storage_bytes?: number;
  member_count?: number;
}

export interface FolderNode {
  id: string;
  name: string;
  parent_id: string | null;
  item_count?: number;
  children?: FolderNode[];
}

export type AssetType = "video" | "image" | "audio" | "document";

export interface MediaFile {
  id: string;
  version_id: string;
  original_filename: string;
  mime_type: string;
  duration_seconds: number | null;
  fps: number | null;
  width: number | null;
  height: number | null;
}

export interface AssetVersion {
  id: string;
  asset_id: string;
  version_number: number;
  processing_status: string;
  created_at: string;
  files: MediaFile[];
}

export interface Asset {
  id: string;
  project_id: string;
  name: string;
  asset_type: AssetType;
  status: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  latest_version: AssetVersion | null;
  thumbnail_url: string | null;
}

export interface Author {
  id: string;
  name: string;
  avatar_url?: string | null;
}

export interface Annotation {
  id: string;
  /** Fabric.js canvas JSON, authored against `_canvasWidth`/`_canvasHeight`. */
  drawing_data: Record<string, unknown>;
  frame_number?: number | null;
}

export interface Reaction {
  emoji: string;
  count: number;
  /** Whether the signed-in user is one of the reactors. */
  reacted: boolean;
}

export interface Comment {
  id: string;
  asset_id: string;
  version_id: string;
  parent_id: string | null;
  timecode_start: number | null;
  timecode_end: number | null;
  body: string;
  resolved: boolean;
  visibility: string;
  created_at: string;
  author: Author | null;
  guest_author: { id: string; name: string; email: string } | null;
  replies: Comment[];
  annotation?: Annotation | null;
  attachments?: unknown[];
  reactions?: Reaction[];
}

export interface InitiateUploadResponse {
  upload_id: string;
  s3_key: string;
  asset_id: string;
  version_id: string;
}
