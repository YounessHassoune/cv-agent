try {
  process.loadEnvFile();
} catch {}

import { readFileSync } from "node:fs";
import { Client, type MessageStreamEvent } from "eve/client";

const cookie = readFileSync(process.argv[2], "utf8").trim();
const client = new Client({
  host: "http://localhost:3000",
  headers: { cookie: `cv_session=${cookie}` },
});
const isBoundary = (e: MessageStreamEvent) =>
  e.type === "session.waiting" || e.type === "session.completed" || e.type === "session.failed";
const ts = () => new Date().toISOString().slice(11, 23);
const JD =
  "Senior Frontend Engineer (React/Next.js). We need 4+ years React, TypeScript, Next.js, GraphQL, testing with Jest and Cypress, CI/CD, and strong ownership. Fintech, remote in Europe.";
const { session, response } = await client.sessions.create({
  message: `Test run, follow these steps only: 1) get_profile. 2) call cv-writer once for language "en" with this JD and the profile (target profile: senior React engineer). Do NOT call analyze_jd, compile_pdf, score_ats or stage_application. 3) Reply with the single word done.\n\nJD:\n${JD}`,
});
const sessionId = session.state.sessionId;
console.log(ts(), "started", sessionId);
void response
  .result()
  .catch((e) => console.log(ts(), "owner result error", String(e).slice(0, 200)));

await new Promise((r) => setTimeout(r, 3000)); // like navigating to the app page a few seconds in
const follower = client.sessions.attach(sessionId);
const t0 = Date.now();
const snap = await follower.snapshot();
console.log(
  ts(),
  "snapshot",
  snap.events.length,
  "events in",
  Date.now() - t0,
  "ms; last",
  snap.events.at(-1)?.type,
);
let last = Date.now(),
  n = 0,
  ended = "boundary";
const guard = setTimeout(() => {
  console.log(ts(), "GIVE UP after 6 min");
  process.exit(3);
}, 360_000);
try {
  for await (const event of follower.stream({ startIndex: snap.events.length })) {
    n++;
    const gap = Date.now() - last;
    last = Date.now();
    if (event.type !== "message.appended" && event.type !== "reasoning.appended")
      console.log(
        ts(),
        `+${gap}ms`,
        event.type,
        (event as any).data?.actions?.map((a: any) => a.toolName).join(",") ?? "",
      );
    if (isBoundary(event)) break;
  }
} catch (e) {
  ended = `error: ${String(e).slice(0, 200)}`;
}
if (n === 0 || !ended.startsWith("boundary"))
  ended = ended === "boundary" ? "EARLY (iterator ended without boundary)" : ended;
clearTimeout(guard);
console.log(ts(), "follow ended:", ended, "after", n, "events");
process.exit(0);
