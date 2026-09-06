import { type UploadApiOptions, type UploadApiResponse, v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary credentials come from env only — the secret must never reach the
 * browser, so uploads are proxied through our own route rather than posted
 * from the client with an unsigned preset.
 */
export function cloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

export function getCloudinary() {
  if (!cloudinaryConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.",
    );
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

/**
 * Uploads raw bytes. `uploader.upload` only accepts a path or a data URI, so
 * using it would mean base64-encoding the buffer first — a 33% larger payload
 * and a second copy of the image held as a string. `upload_stream` takes the
 * bytes as they are.
 */
export function uploadBuffer(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = getCloudinary().uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("Cloudinary returned no result."));
    });
    stream.end(buffer);
  });
}

/** Where profile photos live, so they are easy to find and purge per user. */
export const PHOTO_FOLDER = "applyflow/profile-photos";

/**
 * One photo per user, addressed by a deterministic public id: re-uploading
 * overwrites the previous image instead of leaving orphans behind, and
 * removing the photo has an exact target to destroy.
 */
export function photoPublicId(userId: string): string {
  return `${PHOTO_FOLDER}/${userId}`;
}

/** Hosts we will store as a profile photo URL. */
export function isCloudinaryUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith("res.cloudinary.com");
  } catch {
    return false;
  }
}
