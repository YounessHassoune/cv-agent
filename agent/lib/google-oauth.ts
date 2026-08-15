import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";

export const OAUTH_STATE_COOKIE = "cv_oauth_state";

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
};

/** Google sign-in stays optional: without credentials the button is hidden. */
export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set for Google sign-in.");
  }
  return { clientId, clientSecret };
}

/** The redirect URI must match the one registered in the Google console. */
export function redirectUri(request: Request): string {
  const base = process.env.APP_URL ?? new URL(request.url).origin;
  return new URL("/api/auth/google/callback", base).toString();
}

function stateSecret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET must be set to a random string of at least 16 characters.");
  }
  return value;
}

/** CSRF state: a random nonce signed with AUTH_SECRET, echoed via cookie. */
export function createState(): string {
  const nonce = randomBytes(16).toString("base64url");
  const signature = createHmac("sha256", stateSecret()).update(nonce).digest("base64url");
  return `${nonce}.${signature}`;
}

export function verifyState(fromQuery: string | null, fromCookie: string | undefined): boolean {
  if (!fromQuery || !fromCookie) return false;

  const queryBuffer = Buffer.from(fromQuery);
  const cookieBuffer = Buffer.from(fromCookie);
  if (queryBuffer.length !== cookieBuffer.length || !timingSafeEqual(queryBuffer, cookieBuffer)) {
    return false;
  }

  const [nonce, signature] = fromQuery.split(".");
  if (!nonce || !signature) return false;
  const expected = Buffer.from(
    createHmac("sha256", stateSecret()).update(nonce).digest("base64url"),
  );
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function authorizeUrl(request: Request, state: string): string {
  const { clientId } = credentials();
  const url = new URL(AUTH_ENDPOINT);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/** Exchanges the authorization code and reads the profile from userinfo. */
export async function exchangeCode(request: Request, code: string): Promise<GoogleProfile> {
  const { clientId, clientSecret } = credentials();

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(request),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Google token exchange failed (${tokenResponse.status}).`);
  }

  const { access_token: accessToken } = (await tokenResponse.json()) as { access_token?: string };
  if (!accessToken) throw new Error("Google token exchange returned no access token.");

  const userResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!userResponse.ok) {
    throw new Error(`Google userinfo request failed (${userResponse.status}).`);
  }

  const profile = (await userResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email) {
    throw new Error("Google account did not return an email address.");
  }

  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: profile.email_verified === true,
    name: profile.name,
    picture: profile.picture,
  };
}
