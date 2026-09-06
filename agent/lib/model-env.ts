/**
 * Model ids come exclusively from env vars — no hardcoded fallbacks. Agent
 * modules are evaluated at eve compile time, so a missing var fails the build
 * loudly instead of silently running the wrong model.
 */
export function requireModelEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Set it in .env (e.g. ${name}=openai/gpt-5-mini) — model ids are never hardcoded.`,
    );
  }
  return value;
}
