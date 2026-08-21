import { api } from "@shared/routes";

export type UploadResult = {
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  filename: string;
};

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Uploads a file straight to object storage.
 *
 * The server only mints a short-lived signed URL; the bytes go directly from
 * the browser to R2, so a large stem never passes through our process. XHR is
 * used rather than fetch because it reports upload progress.
 */
export async function uploadFile(
  file: File,
  folder: "submissions" | "files" | "avatars",
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`Files must be under ${formatBytes(MAX_UPLOAD_BYTES)}`);
  }

  const contentType = file.type || "application/octet-stream";

  const presignRes = await fetch(api.uploads.presign.path, {
    method: api.uploads.presign.method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      filename: file.name,
      contentType,
      sizeBytes: file.size,
      folder,
    }),
  });
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({ message: "Upload could not start" }));
    throw new Error(err.message || "Upload could not start");
  }
  const { key, uploadUrl } = (await presignRes.json()) as {
    key: string;
    uploadUrl: string;
  };

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed — check your connection"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(file);
  });

  onProgress?.(100);
  return { storageKey: key, contentType, sizeBytes: file.size, filename: file.name };
}
