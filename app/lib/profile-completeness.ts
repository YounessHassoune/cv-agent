/**
 * The app-side name for the profile scorer. It lives under `agent/lib` so the
 * agent's tools can import it too — the chat has to refuse a thin profile with
 * the same number the banner shows, or the two contradict each other.
 */
export * from "@/agent/lib/profile-completeness";
