import { NextResponse } from "next/server";
import { ImportedProfileSchema } from "@/agent/lib/cv-import-schema.ts";
import { db } from "@/agent/lib/db.ts";
import { cloudinaryConfigured, photoPublicId, uploadBuffer } from "@/app/lib/cloudinary";
import { type CvPhoto, CvImportError, importCv } from "@/app/lib/cv-import";
import { getCurrentUser } from "@/app/lib/current-user";

/**
 * How long a result nobody collected stays worth offering. Long enough to
 * survive closing the laptop, short enough that a CV imported last week does
 * not resurface as a surprise banner.
 */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

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
 *
 * The result is also parked in `CvImport`, because a user who refreshes or
 * navigates away never receives this response while the parse runs on
 * regardless — see `GET`.
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

    const row = { filename: file.name, profile, photoUrl, createdAt: new Date() };
    await db.cvImport.upsert({
      where: { userId: user.userId },
      create: { userId: user.userId, ...row },
      update: row,
    });

    return NextResponse.json({ profile, source, photoUrl, filename: file.name });
  } catch (error) {
    if (error instanceof CvImportError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

/**
 * The last import whose response never reached a browser. The editor asks on
 * mount and offers to fill the form from it, so a refresh mid-parse costs the
 * wait rather than the whole import.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const row = await db.cvImport.findFirst({
    where: { userId: user.userId, createdAt: { gt: new Date(Date.now() - PENDING_TTL_MS) } },
  });
  if (!row) return NextResponse.json({ pending: null });

  // A row written before a schema change would arrive as fields the editor
  // cannot render; drop it rather than hand the form something broken.
  const parsed = ImportedProfileSchema.safeParse(row.profile);
  if (!parsed.success) {
    await db.cvImport.deleteMany({ where: { userId: user.userId } });
    return NextResponse.json({ pending: null });
  }

  return NextResponse.json({
    pending: { filename: row.filename, profile: parsed.data, photoUrl: row.photoUrl },
  });
}

/** Collected or waved away — either way the editor is done with it. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await db.cvImport.deleteMany({ where: { userId: user.userId } });
  return new NextResponse(null, { status: 204 });
}
