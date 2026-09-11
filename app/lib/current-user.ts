import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/agent/lib/db.ts";
import { type AppSession, SESSION_COOKIE, verifySession } from "@/agent/lib/session.ts";

export type CurrentUser = AppSession & {
  name: string | null;
  image: string | null;
};

/**
 * The signed-in user, or null. Set `CV_DEV_FALLBACK=1` to skip sign-in during
 * local development — that resolves to the `local-dev` principal the seed
 * script writes, and it is ignored in production.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE)?.value);

  if (session) {
    const account = await db.user.findUnique({
      where: { id: session.userId },
      select: { name: true, image: true, email: true, emailVerified: true },
    });
    // A deleted account leaves a still-valid cookie behind; treat it as signed
    // out. So is an unverified one — no route mints a session before the link
    // is clicked, and this makes that hold even for a cookie issued earlier.
    if (!account?.emailVerified) return null;
    return {
      ...session,
      email: account.email,
      name: account.name,
      image: account.image,
    };
  }

  if (process.env.NODE_ENV !== "production" && process.env.CV_DEV_FALLBACK === "1") {
    return {
      userId: "local-dev",
      email: "local-dev@example.com",
      exp: 0,
      name: "Local Dev",
      image: null,
    };
  }
  return null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}

/** Initials for avatar fallbacks — "Ada Lovelace" → "AL", else the email. */
export function initialsOf(user: { name?: string | null; email: string }): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").concat(parts[1]?.[0] ?? "").toUpperCase();
}
