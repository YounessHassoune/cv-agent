import type { CvPhoto } from "@/agent/lib/pdf.ts";
import { isCloudinaryUrl } from "@/app/lib/cloudinary";

/** Photos are capped well under this by the upload transformation. */
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Loads the header photo as bytes. Fetched here rather than handed to
 * @react-pdf as a URL so a slow or unreachable Cloudinary cannot stall PDF
 * generation — on any failure the CV simply renders without the photo.
 *
 * Shared by the application PDF route and the CV builder's, which render the
 * same document from two different sources.
 */
export async function loadPdfPhoto(
  photoUrl: string | null | undefined,
): Promise<CvPhoto | undefined> {
  if (!photoUrl) return undefined;

  try {
    // Legacy inline photo from before uploads moved to Cloudinary.
    if (photoUrl.startsWith("data:image/")) {
      const [meta, base64] = photoUrl.split(",", 2);
      if (!base64) return undefined;
      return {
        data: Buffer.from(base64, "base64"),
        format: meta.includes("png") ? "png" : "jpg",
      };
    }
    if (!isCloudinaryUrl(photoUrl)) return undefined;

    const response = await fetch(photoUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_PHOTO_BYTES) return undefined;

    const type = response.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return undefined;
    // @react-pdf decodes only JPEG and PNG; Cloudinary may negotiate WebP/AVIF
    // for browsers, so anything else is skipped rather than corrupting a page.
    if (!/jpeg|jpg|png/.test(type)) return undefined;

    return {
      data: Buffer.from(buffer),
      format: type.includes("png") ? "png" : "jpg",
    };
  } catch {
    return undefined;
  }
}
