import { api } from "@/lib/api-client";

export const MEDIA_BUCKET = "salon-media";
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export function validateImage(file: File) {
  if (!ALLOWED.includes(file.type)) return "Please choose a JPG, PNG, WebP or AVIF image.";
  if (file.size > MAX_UPLOAD_BYTES) return "That image is larger than 5 MB. Please pick a smaller one.";
  return null;
}

/** Uploads to the salon's own folder and returns the stored object path. */
export async function uploadSalonImage(salonId: string, file: File, folder: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${salonId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await api.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function deleteSalonImage(path: string) {
  if (!path || /^https?:/i.test(path)) return;
  await api.storage.from(MEDIA_BUCKET).remove([path]);
}

const signedCache = new Map<string, { url: string; expires: number }>();

/** Turns a stored object path into a viewable URL (already-absolute URLs pass through). */
export async function resolveMediaUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const cached = signedCache.get(value);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data, error } = await api.storage.from(MEDIA_BUCKET).createSignedUrl(value, 3600);
  if (error || !data?.signedUrl) return null;
  signedCache.set(value, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

/* ---------------- user avatars ---------------- */

export const AVATAR_BUCKET = "avatars";

/** Uploads a profile photo to the user's own folder and returns the stored object path. */
export async function uploadAvatar(userId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await api.storage.from(AVATAR_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return path;
}

export async function deleteAvatar(path: string | null | undefined) {
  if (!path || /^https?:/i.test(path)) return;
  await api.storage.from(AVATAR_BUCKET).remove([path]);
}

const avatarCache = new Map<string, { url: string; expires: number }>();

/** Turns a stored avatar path into a viewable URL (already-absolute URLs pass through). */
export async function resolveAvatarUrl(value: string | null | undefined) {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const cached = avatarCache.get(value);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data, error } = await api.storage.from(AVATAR_BUCKET).createSignedUrl(value, 3600);
  if (error || !data?.signedUrl) return null;
  avatarCache.set(value, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}
