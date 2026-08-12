# CV Tailor Agent — Implementation Plan (eve framework)

> **Status (2026-08-08).** Phases 1–5 are built and verified; phase 6 is authored
> but unrun. Working today: Docker Postgres + Prisma migration + seeded sample
> profile, all five tools, the deterministic ATS engine, the PDF template, the
> anti-hallucination guard, the auth channel, and the full Next.js dashboard
> (chat/tailor, profile editor, applications list, review workspace with PDF
> preview). `pnpm verify` passes 8/8 offline checks. **The one thing left before
> the agent can actually tailor a CV is a model provider** — run `eve link` to
> pull Vercel AI Gateway credentials, or set `AI_GATEWAY_API_KEY` in `.env`.
> Without it `analyze_jd` silently falls back to heuristic keywords and the
> semantic 40% of the ATS score is skipped (weights redistribute 2/3 + 1/3).
>
> Quick start: `pnpm db:up && pnpm db:migrate && pnpm db:seed && pnpm dev`

Goal: paste a job description → the agent pulls the connected user's master profile,
tailors a CV for that specific JD, compiles an ATS-friendly PDF, scores it against
the JD, self-corrects until the score passes, then stages it for human review.

Built on **eve** (`eve@0.31.x`) + **Next.js** in a single Vercel project.

---

## 1. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  NEXT.JS APP (same repo, wrapped with withEve() in next.config.ts)   │
│  - /profile        Master Profile editor (CRUD forms)                │
│  - /apply          Paste JD + target language → send to agent        │
│  - /review/[id]    Split view: JD/keywords/score ⇆ live PDF preview  │
│  - useEveAgent()   Streams agent progress, renders approval prompts  │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ same-origin /eve/v1/* (no CORS)
┌───────────────────────────────▼──────────────────────────────────────┐
│  EVE AGENT  (agent/ directory — filesystem-first)                    │
│  instructions.md   identity, anti-hallucination rules, X-Y-Z bullets │
│  agent.ts          model: anthropic/claude-sonnet-5                  │
│  tools/            typed Zod tools (below)                           │
│  skills/           cv-writing rules, ats-formatting rules            │
│  lib/              cv-schema.ts, db.ts, ats.ts, shared state         │
│  channels/eve.ts   auth policy for the HTTP channel                  │
│  evals/            regression checks (no fabricated skills, score ≥) │
│                                                                      │
│  Built-in from eve: durable sessions, pause/resume HITL approvals,   │
│  ask_question, reconnectable streaming, defineState per-session mem  │
└───────────────────────────────┬──────────────────────────────────────┘
┌───────────────────────────────▼──────────────────────────────────────┐
│  DATA LAYER  — Postgres + Prisma                                     │
│  dev: Docker Postgres (pgvector image) · prod: Neon/Vercel Postgres  │
│  Profile / Experience / Project / Skill   (source of truth, per user)│
│  Application (jd, cvJson, atsReport, pdf, status lifecycle)          │
│  Embeddings: OpenAI text-embedding-3-small (or AI Gateway)           │
└──────────────────────────────────────────────────────────────────────┘
```

One deploy: `withEve()` writes the Vercel service config so the agent runtime and
the Next.js app ship together; locally `npm run dev` boots both.

---

## 2. Repo layout (matches eve's discovery rules)

```
cv-agent/
├── next.config.ts            withEve(nextConfig)
├── app/                      Next.js App Router UI
│   ├── profile/  apply/  review/[id]/
│   └── api/profile/…         plain REST for profile CRUD (no agent needed)
├── agent/
│   ├── agent.ts              defineAgent({ model: "anthropic/claude-sonnet-5" })
│   ├── instructions.md       identity + hard rules (see §5)
│   ├── channels/eve.ts       eveChannel({ auth: [...] })
│   ├── skills/
│   │   ├── cv-writing/SKILL.md      X-Y-Z bullet formula, tone, translation rules
│   │   └── ats-formatting/SKILL.md  section naming, layout constraints
│   ├── tools/                filename = tool name the model sees
│   │   ├── get_profile.ts
│   │   ├── analyze_jd.ts
│   │   ├── compile_pdf.ts
│   │   ├── score_ats.ts
│   │   └── stage_application.ts     ← approval-gated (HITL)
│   └── lib/
│       ├── cv-schema.ts      Zod schema for the tailored CV JSON
│       ├── db.ts             Prisma client
│       ├── ats.ts            deterministic scoring engine
│       ├── pdf.tsx           @react-pdf/renderer template
│       └── state.ts          defineState slots (draft, iteration count)
├── evals/
└── prisma/schema.prisma
```

Note: tool names are the **snake_case filenames** under `agent/tools/` — eve derives
the name from the path; no `name` field, no `session.ts` (durability is built in).

---

## 3. Database — Postgres (not MongoDB)

Postgres is the fit here: the schema is relational (`Profile → Experience/Project/
Skill` foreign keys, `Application` status lifecycle), Prisma's migrations and
relation queries are first-class on Postgres, flexible fields (contact, keywords,
ATS report) live happily in `Json` columns, and **pgvector** can store JD/CV
embeddings for the semantic score. MongoDB would force embedded documents or
join-less references and Prisma's weaker Mongo support (no migrations) for no
gain. Same engine in dev and prod keeps parity.

- **Dev**: Docker Postgres with pgvector baked in:

  ```yaml
  # docker-compose.yml
  services:
    db:
      image: pgvector/pgvector:pg17
      ports: ["5432:5432"]
      environment:
        POSTGRES_USER: cv
        POSTGRES_PASSWORD: cv
        POSTGRES_DB: cv_agent
      volumes: [pgdata:/var/lib/postgresql/data]
  volumes:
    pgdata:
  ```

  `docker compose up -d` → `DATABASE_URL=postgresql://cv:cv@localhost:5432/cv_agent`
  in `.env`; `prisma migrate dev` against it.
- **Prod**: Neon / Vercel Postgres (both support pgvector) — same `DATABASE_URL`
  env var, zero code changes.

## 3a. Data model (Prisma)

```prisma
model Profile {
  id           String  @id @default(cuid())
  userId       String  @unique        // ties profile to the authenticated user
  fullName     String
  headline     String?
  contact      Json                    // email, phone, links
  languages    Json                    // [{ lang, level }]
  skills       Skill[]
  experiences  Experience[]
  projects     Project[]
}

model Experience {
  id        String   @id @default(cuid())
  profileId String
  company   String
  role      String
  start     DateTime
  end       DateTime?
  bullets   String[]                   // raw, truthful bullet points
  stack     String[]                   // ONLY tech actually used (hallucination guard)
  profile   Profile  @relation(...)
}

model Project   { … same shape: title, description, bullets, stack, links }
model Skill     { … name, category, level }

model Application {
  id          String   @id @default(cuid())
  userId      String
  jdText      String
  jdKeywords  Json                     // extracted by analyze_jd
  language    String   @default("en")
  cvJson      Json                     // tailored CV snapshot (CvSchema)
  atsReport   Json                     // { total, keyword, semantic, structure, missing[] }
  pdfBytes    Bytes?                   // or Vercel Blob URL
  status      Status   @default(PENDING_REVIEW)
  createdAt   DateTime @default(now())
}
enum Status { DRAFT PENDING_REVIEW APPROVED APPLIED REJECTED }
```

The master profile — not old resumes — is the single source of truth. The agent may
only ever reference skills/stack items that exist in these tables.

---

## 4. Tools (typed, Zod-validated)

| Tool | Input → Output | Notes |
|---|---|---|
| `get_profile` | `{}` → full profile | Reads `ctx.session.auth.current` to resolve the connected user's `userId` — the agent can never ask for someone else's data. |
| `analyze_jd` | `{ jdText }` → `{ keywords: {term, weight, category}[], role, seniority, language }` | Deterministic extraction (tokenizer + a single structured-output model call inside the tool). Persists keywords for the review UI. |
| `compile_pdf` | `CvSchema` → `{ applicationId, pageCount, textLength }` | Input **is** the tailored CV JSON — Zod rejects malformed CVs before any PDF work. Renders single-column via `@react-pdf/renderer` (pure JS, no Puppeteer, serverless-safe), extracts text with `pdf-parse`, stores buffer + text on the draft row. Async-generator `yield`s let the UI show "rendering…" progress. |
| `score_ats` | `{ applicationId }` → `{ total, breakdown, missingKeywords[], suggestions[] }` | Deterministic hybrid engine in `lib/ats.ts` (see §6). Never LLM-judged, so the self-healing loop optimizes against a stable target. |
| `stage_application` | `{ applicationId }` → `{ status }` | **`approval: always()`** — eve durably parks the run and the review UI renders Approve / Request-changes buttons. Approving flips status to `APPROVED`; a text reply resumes the agent with revision instructions. |

Anti-hallucination enforcement lives in code, not just prompt: `compile_pdf`
cross-checks every skill/stack term in the submitted `CvSchema` against the
profile's known terms and **rejects the call** with the offending terms listed, so
the model must fix fabrications before a PDF ever exists.

---

## 5. Agent behavior

**Model cost-routing** — each sub-task runs on the cheapest tier that can do it,
all through one Vercel AI Gateway key (env-overridable):

| Task | Model | Why |
|---|---|---|
| Bullet rewriting, translation, agent loop | `anthropic/claude-sonnet-5` (`agent.ts`) | Premium reasoning where hallucination risk and tone matter |
| JD keyword extraction (`analyze_jd`) | `anthropic/claude-haiku-4.5` (`EXTRACTION_MODEL`) | Plain structured parsing — cheap tier, with a zero-cost heuristic fallback |
| ATS semantic similarity (`lib/ats.ts`) | `openai/text-embedding-3-small` (`EMBEDDING_MODEL`) | Fractions of a cent; JD embedding cached per application |
| Keyword + structure scoring | none — deterministic code | Free, and stable for the self-healing loop to optimize against |

**`agent/instructions.md`** (rewrite from the current placeholder):

- Identity: CV-tailoring specialist for the connected user.
- Hard rules: never invent skills, employers, dates, metrics, or tech; only reshape
  and re-emphasize what `get_profile` returned; write bullets as
  "Accomplished **X** as measured by **Y** by doing **Z**"; quantify where the
  profile provides numbers; translate faithfully into the requested language.
- Workflow contract (the self-healing loop):
  1. `get_profile` → 2. `analyze_jd` → 3. select the most relevant experiences and
     projects, rewrite bullets in the target language → 4. `compile_pdf` →
  5. `score_ats` → 6. if `total < 82` and iterations `< 4`: weave the
     `missingKeywords` you can *truthfully* claim into bullets/skills, then repeat
     4–5 → 7. `stage_application` and stop.
  - If a missing keyword is not truthfully claimable, list it in the summary
    instead of forcing it in.
- Iteration cap + current draft id tracked via `defineState` in `lib/state.ts`
  (`cv.loop` slot) so the loop is bounded even across retries/cold starts.
- Ambiguity (e.g. JD in one language, no target language given): use the built-in
  `ask_question` tool rather than guessing — it pauses durably and the frontend
  renders the choice.

**Skills** hold the long-form writing/formatting guidance so `instructions.md`
stays short; the model loads them on demand.

---

## 6. ATS scoring engine (`lib/ats.ts`, deterministic)

- **Keyword match — 40 %**: weighted token/phrase matching of `analyze_jd` keywords
  against the extracted PDF text (stemming + alias table, e.g. "JS" ≡ "JavaScript").
- **Semantic relevance — 40 %**: cosine similarity between PDF-text and JD
  embeddings (`text-embedding-3-small`, ~100 ms, negligible cost). Cache the JD
  embedding on the Application row so loop iterations only re-embed the CV.
- **Structure & metrics — 20 %**: standard section headers present
  (Experience / Education / Skills), single column, no tables/images in text
  layer, ratio of bullets containing a number/%/$.
- Output includes `missingKeywords` and concrete `suggestions` — this is the
  feedback signal the agent's loop consumes, and what the review UI displays.

---

## 7. Frontend (Next.js + Tailwind + shadcn/ui)

- **`next.config.ts`**: `export default withEve(nextConfig)` — agent routes mount
  same-origin at `/eve/v1/*`; `useEveAgent()` needs no URL config.
- **/profile**: CRUD over plain `app/api/profile` routes (no reason to route form
  saves through the agent).
- **/apply**: JD textarea + language select → `agent.sendMessage(...)`; stream tool
  events (`analyze_jd`, `compile_pdf` partials, `score_ats` results) as a live
  progress timeline.
- **/review/[id]**: left — JD summary, matched vs missing keywords, score
  breakdown, adjustment textbox; right — PDF preview (`<iframe>` over a
  `/api/applications/[id]/pdf` route serving the stored buffer). The pending
  `stage_application` approval renders here: **Approve** answers the approval and
  marks `APPROVED`; free-text feedback resumes the same durable session for
  another tailoring pass. Post-approval actions: Download PDF, "Mark as Applied".

## 8. Auth ("me or whatever user is connected")

- Add Auth.js (cookie sessions) to the Next.js app — cookies flow to the eve
  routes automatically under `withEve()`.
- `agent/channels/eve.ts`: replace the default with an auth chain that resolves
  the app session cookie to a principal carrying `userId`
  (+ keep `localDev()` for `eve dev`). Fail closed.
- Every tool scopes queries by `ctx.session.auth.current` — multi-user safe from
  day one (see eve's multi-tenant auth/approvals patterns docs).

---

## 9. Build order

1. **Foundation** — `docker-compose.yml` + Prisma schema migrated against local
   Docker Postgres; Auth.js; `withEve()` wiring;
   `channels/eve.ts` auth; seed your own profile. ✅ when `eve dev` + Next dev run together and `get_profile` returns your seeded data in the dev TUI.
2. **Generation core** — `cv-schema.ts`, `pdf.tsx` template, `compile_pdf`
   with hallucination guard; `analyze_jd`. ✅ when a hand-written CvSchema JSON produces a clean 1-page PDF.
3. **Scoring** — `lib/ats.ts` + `score_ats`; unit-test the scorer with fixture
   CVs/JDs so weights are stable before the agent depends on them.
4. **Agent loop** — rewrite `instructions.md`, add skills, `defineState` loop
   guard, `stage_application` with `approval: always()`. ✅ when pasting a real JD in the dev TUI yields a staged draft ≥ 82 within ≤ 4 iterations.
5. **Dashboard** — /apply streaming timeline, /review approval + PDF preview,
   /profile editor.
6. **Hardening** — `evals/`: no-fabricated-skills assertion (diff CvSchema terms
   vs profile), score-threshold case, translation case; then deploy to Vercel.

## 10. Dependencies to add

`@prisma/client` + `prisma`, `@react-pdf/renderer`, `pdf-parse`, `openai` (embeddings
only — or route through Vercel AI Gateway), `next`, `next-auth`, `tailwindcss`,
shadcn/ui. Before wiring any external service by hand, check
`eve registry search <query>` (e.g. a managed-Postgres connection) per AGENTS.md.
