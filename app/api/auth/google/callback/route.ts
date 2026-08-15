import { NextResponse } from "next/server";
import { db } from "@/agent/lib/db.ts";
import { exchangeCode, OAUTH_STATE_COOKIE, verifyState } from "@/agent/lib/google-oauth.ts";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/agent/lib/session.ts";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (error: string) =>
    NextResponse.redirect(new URL(`/signin?error=${error}`, request.url), 303);

  if (url.searchParams.get("error")) return fail("google_denied");

  const stateCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.slice(OAUTH_STATE_COOKIE.length + 1);

  if (!verifyState(url.searchParams.get("state"), stateCookie)) return fail("google_state");

  const code = url.searchParams.get("code");
  if (!code) return fail("google_code");

  let profile: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    profile = await exchangeCode(request, code);
  } catch {
    return fail("google_failed");
  }

  if (!profile.emailVerified) return fail("google_unverified");

  // Link by googleId first, then adopt an existing password account with the
  // same verified email so a user never ends up with two separate profiles.
  const existing =
    (await db.user.findUnique({ where: { googleId: profile.sub } })) ??
    (await db.user.findUnique({ where: { email: profile.email } }));

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: {
          googleId: profile.sub,
          name: existing.name ?? profile.name ?? null,
          image: profile.picture ?? existing.image,
        },
      })
    : await db.user.create({
        data: {
          email: profile.email,
          googleId: profile.sub,
          name: profile.name ?? null,
          image: profile.picture ?? null,
        },
      });

  const isNew = !existing;
  if (isNew) {
    await db.profile.create({
      data: {
        userId: user.id,
        fullName: profile.name ?? profile.email.split("@")[0],
        contact: { email: profile.email, links: [] },
      },
    });
  }

  const { token, maxAge } = signSession(user.id, user.email);
  const response = NextResponse.redirect(new URL(isNew ? "/profile" : "/", request.url), 303);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(maxAge));
  response.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
  return response;
}
