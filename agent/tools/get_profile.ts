import { defineTool } from "eve/tools";
import { z } from "zod";
import { resolveUserId } from "../lib/auth";
import { db } from "../lib/db";
import { allowedTerms } from "../lib/guard";

export default defineTool({
  description:
    "Fetch the connected user's master profile: contact info, skills, experiences (with truthful bullets and real tech stacks), projects, education, and languages. This is the single source of truth — the CV may only ever contain what this returns.",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const userId = resolveUserId(ctx);
    const profile = await db.profile.findUnique({
      where: { userId },
      include: {
        skills: { orderBy: { category: "asc" } },
        experiences: { orderBy: { start: "desc" } },
        projects: true,
      },
    });
    if (!profile) {
      return {
        profile: null,
        message:
          "No master profile exists for this user yet. Tell the user to fill in their profile (skills, experiences, projects) before a CV can be generated, and stop.",
      };
    }
    // JSON round-trip converts Dates to ISO strings (eve tool outputs must be JSON-serializable)
    return {
      profile: JSON.parse(JSON.stringify(profile)),
      // The exact vocabulary compile_pdf will accept in skill groups and stack
      // arrays. write_cv reads it from the database itself; shown here so the
      // agent can answer "what can my CV claim" without guessing.
      allowedTerms: allowedTerms(profile),
    };
  },
});
