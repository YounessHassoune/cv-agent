import { NextResponse } from "next/server";
import { db } from "@/agent/lib/db.ts";
import { cloudinaryConfigured, photoPublicId, uploadBuffer } from "@/app/lib/cloudinary";
import { type CvPhoto, CvImportError, importCv } from "@/app/lib/cv-import";
import { getCurrentUser } from "@/app/lib/current-user";

/**
 * The photo is the one thing an import commits straight away, exactly as
 * picking one in the photo field does: Cloudinary keeps one asset per user, so
 * the alternative is a second orphan asset for every import a user abandons.
 * Nothing else here is persisted.
 */
async function storePhoto(userId: string, photo: CvPhoto): Promise<string | null> {
  if (!cloudinaryConfigured()) return null;

  try {
    const result = await uploadBuffer(photo.buffer, {
      public_id: photoPublicId(userId),
      overwrite: true,
      resource_type: "image",
      transformation: [
        { width: 512, height: 512, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });
    await db.profile.updateMany({ where: { userId }, data: { photoUrl: result.secure_url } });
    return result.secure_url;
  } catch {
    // A CV is worth importing without its photo; the user can add one by hand.
    return null;
  }
}

/**
 * Parses an uploaded CV and returns the fields it found. It deliberately does
 * not touch the profile itself: `PUT /api/profile` replaces the whole row, so
 * an extraction the user never saw could wipe real data. The editor prefills
 * from this response and the user saves it themselves.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a CV as `file`." }, { status: 400 });
  }

  try {
    const { profile, source, photo } = await importCv(file);
    const photoUrl = photo ? await storePhoto(user.userId, photo) : null;

    return NextResponse.json({ profile, source, photoUrl, filename: file.name });
  } catch (error) {
    if (error instanceof CvImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
