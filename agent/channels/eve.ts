import { type AuthFn, localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";
import { sessionFromRequest } from "../lib/session.ts";

/**
 * Resolves the signed app session cookie into a user principal. Every tool
 * scopes its queries by this principal's `userId` (see lib/auth.ts), so the
 * agent can only ever touch the connected user's data.
 */
function appSession(): AuthFn<Request> {
  return (request) => {
    const session = sessionFromRequest(request);
    if (!session) return null; // fall through to the next entry
    return {
      authenticator: "app",
      principalId: session.userId,
      principalType: "user",
      attributes: { userId: session.userId, email: session.email },
    };
  };
}

export default eveChannel({
  auth: [
    // Signed-in browser users come first.
    appSession(),
    // Lets the eve TUI and Vercel deployments reach the deployed agent.
    vercelOidc(),
    // Open on localhost for `eve dev` and the REPL only; ignored in production.
    // Falls back to the `local-dev` principal, which matches the seeded profile.
    localDev(),
  ],
});
