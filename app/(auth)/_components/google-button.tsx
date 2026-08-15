import { googleConfigured } from "@/agent/lib/google-oauth.ts";

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
      <path
        d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.2a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.44-4.96 3.44-8.55z"
        fill="#4285F4"
      />
      <path
        d="M12 23.5c3.11 0 5.72-1.03 7.62-2.8l-3.72-2.89c-1.03.69-2.35 1.1-3.9 1.1-3 0-5.54-2.03-6.45-4.75H1.7v2.98A11.5 11.5 0 0 0 12 23.5z"
        fill="#34A853"
      />
      <path
        d="M5.55 14.16a6.9 6.9 0 0 1 0-4.32V6.86H1.7a11.51 11.51 0 0 0 0 10.28l3.85-2.98z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.77c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.28 15.1.25 12 .25 7.52.25 3.65 2.82 1.7 6.86l3.85 2.98C6.46 7.12 9 4.77 12 4.77z"
        fill="#EA4335"
      />
    </svg>
  );
}

/**
 * Renders nothing when Google credentials are absent, so a half-configured
 * deploy never shows a button that dead-ends on an error page.
 */
export function GoogleButton({ label }: { readonly label: string }) {
  if (!googleConfigured()) return null;

  return (
    <>
      <a
        className="inline-flex h-10 w-full items-center justify-center gap-2.5 rounded-md border bg-background font-medium text-sm shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50"
        href="/api/auth/google"
      >
        <GoogleMark />
        {label}
      </a>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-muted-foreground text-xs">or continue with email</span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}
