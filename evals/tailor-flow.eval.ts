import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

const JD = `Senior Full-Stack Engineer

We need a senior engineer to own our commerce platform.

Requirements:
- Strong TypeScript and React experience, ideally with Next.js
- Node.js backend services at scale
- PostgreSQL, including query optimization and indexing
- Redis or similar caching layers
- Docker and CI/CD pipelines; AWS experience preferred
- Automated testing (Playwright or Cypress)
- Experience mentoring engineers and leading migrations

Nice to have: Terraform, Kubernetes, GraphQL.`;

/**
 * Requires a seeded profile (`pnpm db:seed`) and a model provider.
 */
export default defineEval({
  description: "The agent walks the full tailoring workflow and stops for approval.",
  async test(t) {
    await t.send(`Tailor my CV for this job. Write it in English.\n\n${JD}`);

    // The workflow contract in agent/instructions.md, asserted step by step.
    t.calledTool("get_profile");
    t.calledTool("analyze_jd");
    t.calledTool("compile_pdf");
    t.calledTool("score_ats");

    // stage_application is approval-gated, so the run must park for a human
    // rather than silently finishing.
    t.calledTool("stage_application");
  },
});
