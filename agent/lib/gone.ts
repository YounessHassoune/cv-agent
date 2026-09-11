import { cvLoop } from "./state";

/**
 * What every tool says when the application it was handed is not in the
 * database any more.
 *
 * The user can delete an application from the list while the run that created
 * it is still going. Every tool used to *throw* on the missing row, which the
 * orchestrator reads as a step that went wrong — so it routed around it,
 * called `analyze_jd` again and created a second application for a job the
 * user had just thrown away. A result, not an error, is what ends a run
 * cleanly: there is nothing to route around.
 */
export function applicationGone(applicationId: string) {
  // Nothing downstream should keep pointing at a row that no longer exists.
  if (cvLoop.get().applicationId === applicationId) {
    cvLoop.update((loop) => ({ ...loop, applicationId: null }));
  }

  return {
    blocked: "deleted" as const,
    applicationId,
    message:
      "This application no longer exists — the user deleted it. Stop this run now. Do not retry this step, do not call analyze_jd, and do not create a replacement: the deletion is the user's decision, not a failure to work around. Tell them in one line that the application was deleted and that you stopped, then end the turn.",
  };
}
