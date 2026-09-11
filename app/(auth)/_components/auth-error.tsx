import { AlertCircleIcon } from "lucide-react";

const messages: Record<string, string> = {
  invalid: "Enter your email address and password.",
  credentials: "That email and password combination doesn't match an account.",
  email: "Enter a valid email address.",
  password: "Password must be at least 8 characters and include a letter and a number.",
  exists: "An account with that email already exists. Sign in instead.",
  google_unconfigured: "Google sign-in isn't configured on this deployment.",
  google_denied: "Google sign-in was cancelled.",
  google_state: "That sign-in link expired. Please try again.",
  google_code: "Google didn't return an authorization code. Please try again.",
  google_failed: "Couldn't complete Google sign-in. Please try again.",
  google_unverified: "Your Google email address isn't verified.",
  unverified: "Confirm your email address before signing in.",
  expired: "That confirmation link has expired. Request a new one below.",
  bad_token: "That confirmation link is no longer valid. Request a new one below.",
  send_failed:
    "Your account was created, but the confirmation email couldn't be sent. Try again below.",
};

export function AuthError({ code }: { readonly code?: string }) {
  if (!code) return null;

  return (
    <div
      className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm"
      role="alert"
    >
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      <p className="text-foreground">{messages[code] ?? "Something went wrong. Please try again."}</p>
    </div>
  );
}
