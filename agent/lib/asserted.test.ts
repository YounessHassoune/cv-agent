/**
 * Self-check for the term the user insisted on. `node agent/lib/asserted.test.ts`.
 * If this breaks, the app is either refusing terms its own user demanded, or
 * printing another trade's vocabulary onto their CV.
 */
import assert from "node:assert/strict";
import { screenAssertedTerms } from "./asserted.ts";
import type { JdKeyword } from "./ats.ts";

const keywords: JdKeyword[] = [
  { term: "Power BI", weight: 3, aliases: [], category: "tool" },
  { term: "Databricks", weight: 2, aliases: [], category: "tool" },
  { term: "Azure Synapse", weight: 2, aliases: ["Synapse"], category: "tool" },
];
const jdText = "We are hiring a Data Analyst in Immenstadt. Snowflake experience is a plus.";

const base = {
  jdText,
  keywords,
  profileTerms: ["Python", "SQL"],
  role: "Data Analyst",
  // Nothing here should need embeddings; a call means the cheap path missed.
  embed: async () => {
    throw new Error("should not embed a term the job or the profile already names");
  },
};

// A JD keyword, one of its aliases, a profile term, and a word only the JD
// prose mentions: all free, all accepted.
{
  const { accepted, rejected, unscreened } = await screenAssertedTerms(
    ["Databricks", "Synapse", "Python", "Snowflake"],
    base,
  );
  assert.deepEqual(accepted, ["Databricks", "Synapse", "Python", "Snowflake"]);
  assert.deepEqual(rejected, []);
  assert.equal(unscreened, false);
}

// Case and stray whitespace are the user typing, not a different term.
{
  const { accepted } = await screenAssertedTerms(["  databricks  ", "databricks"], base);
  assert.deepEqual(accepted, ["databricks"], "deduplicated, in the user's own spelling");
}

/*
 * The embedded path. Vectors stand in for the real model: the domain is [1,0],
 * off-domain prose is [0,1], and each term sits somewhere between. The floor
 * is the control's similarity to the domain (0), so the line is the margin.
 */
const vectors: Record<string, number[]> = {
  __domain: [1, 0],
  __control: [0, 1],
  dbt: [0.9, 0.44], // ~0.90 similarity: a tool of this trade
  Carpenter: [0.03, 1], // ~0.03: another trade entirely
};
const fake = {
  ...base,
  embed: async (text: string) => {
    if (text.startsWith("Data Analyst")) return vectors.__domain;
    if (text.startsWith("Sourdough")) return vectors.__control;
    return vectors[text] ?? null;
  },
};

{
  const { accepted, rejected } = await screenAssertedTerms(["dbt", "Carpenter"], fake);
  assert.deepEqual(accepted, ["dbt"], "a term of the field the JD happens not to name");
  assert.deepEqual(rejected, ["Carpenter"], "a term from another trade stays off the CV");
}

// No embedding provider: the user asked by name, so the terms go on the CV and
// the caller is told the check could not run.
{
  const { accepted, rejected, unscreened } = await screenAssertedTerms(["Carpenter"], {
    ...base,
    embed: async () => null,
  });
  assert.deepEqual(accepted, ["Carpenter"]);
  assert.deepEqual(rejected, []);
  assert.equal(unscreened, true);
}

// Nothing asked for, nothing to do — and no model call to pay for.
assert.deepEqual(await screenAssertedTerms([], base), {
  accepted: [],
  rejected: [],
  unscreened: false,
});

console.log("asserted.test.ts ok");
