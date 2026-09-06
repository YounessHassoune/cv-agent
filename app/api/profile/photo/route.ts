import { NextResponse } from "next/server";
import { db } from "@/agent/lib/db.ts";
import {
  cloudinaryConfigured,
  getCloudinary,
  photoPublicId,
  uploadBuffer,
} from "@/app/lib/cloudinary";
import { getCurrentUser } from "@/app/lib/current-user";

/** The editor downscales to a 320px square JPEG, so this is pure headroom. */
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/**
 * Uploads one profile photo to Cloudinary and returns its delivery URL. The
 * browser never sees the API secret, and the stored profile keeps a short URL
 * instead of a multi-hundred-KB base64 blob.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (!cloudinaryConfigured()) {
    return NextResponse.json(
      { error: "Photo uploads are unavailable — Cloudinary is not configured on the server." },
      { status: 503 },
    );
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach an image as `file`." }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "That file is not an image." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "That image is over 8MB." }, { status: 413 });
  }

  try {
    const result = await uploadBuffer(Buffer.from(await file.arrayBuffer()), {
      public_id: photoPublicId(user.userId),
      overwrite: true,
      resource_type: "image",
      // Square, face-aware crop at delivery size — the CV header shows it as
      // a small circle, so anything larger is wasted bandwidth.
      transformation: [
        { width: 512, height: 512, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    // Persist immediately: the photo is uploaded on pick, but the profile form
    // is saved separately, and an upload the user never saves would otherwise
    // leave an image in Cloudinary that nothing points at.
    await db.profile.updateMany({
      where: { userId: user.userId },
      data: { photoUrl: result.secure_url },
    });

    return NextResponse.json({ url: result.secure_url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** Removes the stored photo and the Cloudinary asset behind it. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  if (cloudinaryConfigured()) {
    await getCloudinary()
      .uploader.destroy(photoPublicId(user.userId), { resource_type: "image" })
      // A missing or already-deleted asset must not block clearing the field.
      .catch(() => undefined);
  }

  await db.profile.updateMany({
    where: { userId: user.userId },
    data: { photoUrl: null },
  });

  return NextResponse.json({ ok: true });
}
