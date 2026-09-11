import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "./db.ts";
import { emailConfigured, sendVerificationEmail } from "./email.ts";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
/** A new link may be requested at most this often, per account. */
const RESEND_COOLDOWN_MS = 1000 * 60;

/** Only the digest is stored, so the table is useless to whoever reads it. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function verificationLink(request: Request, token: string): string {
  const base = process.env.APP_URL ?? new URL(request.url).origin;
  const url = new URL("/api/auth/verify", base);
  url.searchParams.set("token", token);
  return url.toString();
}

export type IssueResult =
  | { status: "sent" }
  | { status: "auto_verified" }
  | { status: "cooldown" }
  | { status: "failed" };

/**
 * Mints a fresh link and mails it. The previous link for the account is deleted
 * first, so only the newest one works.
 *
 * With no `RESEND_API_KEY` the account is marked verified instead: a local
 * deploy without mail credentials would otherwise create accounts that can
 * never sign in. This shortcut is refused in production.
 */
export async function issueVerification(
  request: Request,
  user: { id: string; email: string; name: string | null },
): Promise<IssueResult> {
  if (!emailConfigured()) {
    if (process.env.NODE_ENV === "production") return { status: "failed" };
    await db.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } });
    return { status: "auto_verified" };
  }

  const latest = await db.verificationToken.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    return { status: "cooldown" };
  }

  const token = randomBytes(32).toString("base64url");
  await db.verificationToken.deleteMany({ where: { userId: user.id } });
  await db.verificationToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  try {
    await sendVerificationEmail({
      to: user.email,
      name: user.name,
      link: verificationLink(request, token),
    });
  } catch {
    // Leaving the row behind would let a "resend" call hit the cooldown for a
    // link that never arrived.
    await db.verificationToken.deleteMany({ where: { userId: user.id } });
    return { status: "failed" };
  }

  return { status: "sent" };
}

export type ConsumeResult =
  | { status: "ok"; user: { id: string; email: string } }
  | { status: "invalid" }
  | { status: "expired" };

/**
 * Checks a link's token and, on success, burns it and marks the address
 * verified. Single use: the row is gone before this returns.
 */
export async function consumeVerification(token: string | null): Promise<ConsumeResult> {
  if (!token) return { status: "invalid" };

  const digest = hashToken(token);
  const record = await db.verificationToken.findUnique({
    where: { tokenHash: digest },
    select: { id: true, expiresAt: true, tokenHash: true, user: { select: { id: true, email: true } } },
  });
  if (!record) return { status: "invalid" };

  // The lookup above already matched on equality; this guards the comparison
  // itself against a timing side channel on future lookup changes.
  const stored = Buffer.from(record.tokenHash);
  const actual = Buffer.from(digest);
  if (stored.length !== actual.length || !timingSafeEqual(stored, actual)) {
    return { status: "invalid" };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await db.verificationToken.delete({ where: { id: record.id } });
    return { status: "expired" };
  }

  await db.verificationToken.delete({ where: { id: record.id } });
  await db.user.update({ where: { id: record.user.id }, data: { emailVerified: new Date() } });

  return { status: "ok", user: record.user };
}
