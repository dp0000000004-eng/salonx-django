/**
 * Client-side image preparation: resize, compress and convert to WebP before upload
 * so large phone photos do not have to travel over slow mobile networks.
 */

export type CropArea = { x: number; y: number; width: number; height: number };

export const ASPECTS = {
  square: 1,
  cover: 16 / 6,
  card: 4 / 3,
  wide: 16 / 9,
} as const;

export type AspectName = keyof typeof ASPECTS;

const MAX_EDGE = 1600;

function supportsWebp() {
  if (typeof document === "undefined") return false;
  return document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That image could not be read. Please choose another file."));
    img.src = src;
  });
}

/** Crops (optional), resizes and compresses. Returns a small WebP/JPEG file ready to upload. */
export async function prepareImage(
  file: File,
  options: { crop?: CropArea | undefined; maxEdge?: number; quality?: number } = {},
): Promise<File> {
  const { crop, maxEdge = MAX_EDGE, quality = 0.82 } = options;
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const sx = crop?.x ?? 0;
    const sy = crop?.y ?? 0;
    const sw = crop?.width ?? img.naturalWidth;
    const sh = crop?.height ?? img.naturalHeight;

    const scale = Math.min(1, maxEdge / Math.max(sw, sh));
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);

    const type = supportsWebp() ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + (type === "image/webp" ? ".webp" : ".jpg");
    return new File([blob], name, { type });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function readableSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}
