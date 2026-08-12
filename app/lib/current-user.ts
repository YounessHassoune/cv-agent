import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { type AppSession, SESSION_COOKIE, verifySession } from "@/agent/lib/session.ts";

/** The signed-in user, or null. In `eve dev` there is a local fallback so the
 * seeded profile is reachable without signing in. */
export async function getCurrentUser(): Promise<AppSession | null> {
  const store = await cookies();
  const session = verifySession(store.get(SESSION_COOKIE)?.value);
  if (session) return session;

  if (process.env.NODE_ENV !== "production") {
    return { userId: "local-dev", email: "local-dev@example.com", exp: 0 };
  }
  return null;
}

export async function requireUser(): Promise<AppSession> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  return user;
}
