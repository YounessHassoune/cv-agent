import { after, NextResponse } from "next/server";
import { ImportedProfileSchema } from "@/agent/lib/cv-import-schema.ts";
import { db } from "@/agent/lib/db.ts";
import { cloudinaryConfigured, photoPublicId, uploadBuffer } from "@/app/lib/cloudinary";
import { type CvPhoto, type Found, MAX_IMPORT_BYTES, CvImportError, importCv } from "@/app/lib/cv-import";
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
 * How long a parse may sit unfinished before it is written off. The work runs
 * in `after()`, which a redeploy or a crashed process takes with it, and a row
 * stuck on "running" would otherwise spin the editor's button forever.
 */
const RUNNING_TTL_MS = 5 * 60 * 1000;

/** Floor on how often streamed progress is written back. */
const FOUND_WRITE_MS = 1000;

/**
 * Accepts a CV, parks a `running` row, and parses it in `after()` — after the
 * response, so the work is no longer tied to a browser that may refresh or
 * navigate away a second later. The result lands in `CvImport`; the editor
 * collects it from `GET`, this call only says the parse started.
 *
 * It deliberately does not touch the profile itself: `PUT /api/profile`
 * replaces the whole row, so an extraction the user never saw could wipe real
 * data. The editor prefills from the parked result and saves that.
 */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a CV as `file`." }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "That file is over 10MB." }, { status: 400 });
  }

  // The bytes have to be copied out now: `request` is torn down with the
  // response, and the parse deliberately outlives both.
  const bytes = await file.arrayBuffer();
  const copy = new File([bytes], file.name, { type: file.type });
  const { userId } = user;

  const started = {
    filename: file.name,
    status: "running",
    stage: "reading",
    profile: {},
    photoUrl: null,
    error: null,
    createdAt: new Date(),
  };
  await db.cvImport.upsert({
    where: { userId },
    create: { userId, ...started },
    update: started,
  });

  after(async () => {
    // Each step announces itself so the editor can say which one is running
    // rather than spin for the whole minute. Fire-and-forget: a lost progress
    // write must not take the import down with it.
    const stage = (next: string) => {
      void db.cvImport.updateMany({ where: { userId }, data: { stage: next } }).catch((cause) => {
        // Never fatal, but never silent either: a swallowed progress write is
        // indistinguishable from a model that reports nothing.
        console.warn("cv-import: stage write failed", cause);
      });
    };

    // The model streams a few partials a second; the editor polls twice that
    // slowly, so anything finer than a write per second is wasted round trips.
    let wroteAt = 0;
    const found = (progress: Found) => {
      if (Date.now() - wroteAt < FOUND_WRITE_MS) return;
      wroteAt = Date.now();
      void db.cvImport.updateMany({ where: { userId }, data: { found: progress } }).catch((cause) => {
        console.warn("cv-import: progress write failed", cause);
      });
    };

    try {
      const { profile, photo } = await importCv(copy, stage, found);
      if (photo) stage("photo");
      const photoUrl = photo ? await storePhoto(userId, photo) : null;
      await db.cvImport.update({
        where: { userId },
        data: { status: "done", profile, photoUrl, error: null },
      });
    } catch (error) {
      const message =
        error instanceof CvImportError ? error.message : "Couldn't read that CV. Try another file.";
      await db.cvImport
        .update({ where: { userId }, data: { status: "error", error: message } })
        .catch(() => {
          // The user gets a timeout instead of a message; nothing else to do here.
        });
    }
  });

  return NextResponse.json({ status: "running", filename: file.name }, { status: 202 });
}

/**
 * Where the last import got to: still running, finished and waiting to be
 * collected, or failed. The editor polls this while a parse is in flight and
 * asks once on mount, so a refresh costs the wait rather than the import.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const row = await db.cvImport.findFirst({
    where: { userId: user.userId, createdAt: { gt: new Date(Date.now() - PENDING_TTL_MS) } },
  });
  if (!row) return NextResponse.json({ pending: null });

  const age = Date.now() - row.createdAt.getTime();
  if (row.status === "running") {
    if (age < RUNNING_TTL_MS) {
      return NextResponse.json({
        running: {
          filename: row.filename,
          stage: row.stage,
          startedAt: row.createdAt.getTime(),
          found: row.found,
        },
      });
    }
    // Nothing is coming: the process that was parsing this is gone.
    await db.cvImport.deleteMany({ where: { userId: user.userId } });
    return NextResponse.json({
      failed: { filename: row.filename, error: "That import stopped partway. Try uploading again." },
    });
  }

  if (row.status === "error") {
    await db.cvImport.deleteMany({ where: { userId: user.userId } });
    return NextResponse.json({
      failed: { filename: row.filename, error: row.error ?? "Couldn't read that CV." },
    });
  }

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
