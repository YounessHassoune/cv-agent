# Wellsuited PFE Defense

> Generated from `public/presentation/slides.json`. Edit the JSON, not this file.


---

<!-- Cover -->

*(Cover slide - see slides.json)*


---

<!-- Agenda -->

1. **The problem**
   - the hiring bottleneck
   - how an ATS reads a CV
   - the cost of doing it by hand
   - the problem statement

2. **Why not just use ChatGPT or Gemini?**
   - one prompt vs a pipeline
   - why fabrication disqualifies it
   - the market gap
   - the solution: Wellsuited

3. **What an AI agent is, and the solution**
   - a model alone vs an agent
   - how an agent works, one real turn
   - the solution

4. **Architecture, technologies, and how it works**
   - the architecture
   - the five tools
   - technologies
   - the truth guard
   - a full run
   - the service layer

5. **Scoring**
   - the formula
   - the required-skill coverage

6. **Demo**
   - the system running, end to end

7. **Questions**


---

<!-- Part 1 -->

## The problem

Why a qualified candidate never reaches a human reader?


---

<!-- 1 · The problem -->

### One posting. Hundreds of CVs. One program between them.

*[diagram: hiring-funnel]*

**A qualified candidate is filtered out before a human ever opens the file.** Not for lack of skill but for lack of the right words in the right structure.


---

<!-- 1 · The problem -->

### What the program actually does, in three stages

*[diagram: ats-funnel]*

**A relevant CV that is lexically or structurally misaligned is *invisible* .**


---

<!-- 1 · The problem -->

### And tailoring by hand does not scale

- **Per offer**: **20–40 minutes**
- **Repeated for**: **every application**
- **And again for**: **every target language**
- **15 serious applications**: **one full working day**

Read the ad, infer the real expectations, reorder experience, rephrase achievements in the role’s vocabulary, recompile. None of it creative.

**So people give up and send one generic document.**


---

<!-- 1 · Problem statement -->

**How can the adaptation of a CV to a job offer be automated so as to maximise its readability by ATS software and its relevance to a recruiter , while guaranteeing by construction that no untrue information is introduced, leaving the user in control, and making the service economically measurable?**

- **Optimisation**: maximise alignment with the offer
- **Truthfulness**: cannot be entrusted to the model itself
- **Governance**: the user arbitrates, not the machine
- **Sustainability**: measure what each application really costs


---

<!-- Part 2 -->

## Why not just use ChatGPT or Gemini?

The obvious answer, and the three things it cannot give you


---

<!-- 2 · Why not a chatbot -->

### Why a chatbot prompt is not enough

*[diagram: prompt-vs-pipeline]*

**What a prompt returns**

- **Fabrication**: adds the technologies named in the ad
- **No measurement**: *asserts* it improved the CV
- **No document**: text, not a parser-safe PDF
- **No memory**: every application starts from zero

**What the pipeline returns**

- **A checked draft**: facts matched against the profile
- **A number**: the same input always scores the same
- **A document**: single-column PDF, read back after render
- **A history**: profile, session and every version kept

> **These are not prompt problems.** A better prompt makes fabrication rarer, never impossible.


---

<!-- 2 · Why not a chatbot -->

### Why fabrication disqualifies the chatbot

A language model is optimised to satisfy the request. Asked to match a job offer, satisfying the request *means* claiming what the offer asks for.

**A CV is a binding document. Fabrication is not a style flaw but it is a fault.**


---

<!-- 2 · State of the art -->

### And the existing tools each solve only half of it

| Solution | Limitation for this problem |
|---|---|
| Jobscan | Analyses only. Does not write the CV, does not compile it |
| Teal | Adaptation mostly manual; no measured convergence loop |
| Rezi / Kickresume | AI content generation with **no truth guard**: nothing checks it against a persistent source of truth |
| ChatGPT / Gemini | Uncontrolled fabrication, no measurement, no compiled document, no persistence |
| Doing it by hand | Truthful, but expensive, not reproducible, no objective feedback |

**The market splits into tools that *measure* without writing, and tools that *write* without measuring or verifying.**


---

<!-- 2 · The solution -->

### The solution: **Wellsuited**

A SaaS platform built on an **AI agent**  not a prompt, not a script. The agent drives typed tools over one master profile. Deterministic code verifies every line before it reaches the page, and measures the result.


---

<!-- Part 3 -->

## What an AI agent is

The difference from a language model ? and why the solution is built on one


---

<!-- 3 · Foundations -->

### A model only writes text, an agent adds tools, rules and memory

*[diagram: llm-vs-agent]*

**Give a model “Tailor my CV to this offer”**

- **It returns**: a block of text that looks like a CV
- **It reads**: only what you pasted into the prompt
- **It may**: add Kubernetes because the offer asked for it
- **Afterwards**: nothing is saved, nothing is measured, there is no file

**Give an agent the same sentence**

- **It reads**: your master profile, from the database
- **It calls**: five tools in order, deciding which at runtime
- **It cannot**: name an employer the profile does not contain
- **Afterwards**: a PDF exists, a score exists, the cost is recorded


---

<!-- 3 · Foundations -->

### The model asks. The code checks, runs it, reports back.

*[diagram: agent-loop]*

**What the harness adds**

**A raw model is stateless**: it answers with text, then forgets. **The harness makes it a loop:** plan → run → check → repeat, until the job is done. The model is the passenger; the harness drives.

**The same loop, on your CV**

- **Plan**: “write the English version”
- **Run**: the draft is written and stored
- **Check**: PDF blocked: the draft claims Kubernetes, your profile never mentions it
- **Repeat**: it rewrites, the PDF is made → *“68 out of 100”*


---

<!-- 3 · The solution -->

### The solution: **Wellsuited**

One master profile is the only source of facts. An agent drives five typed tools over it; deterministic code verifies, measures and bounds everything the model produces.

- **One master profile**: experiences, projects, skills, education. Nothing else can become a fact on a CV.
- **A closed tool catalogue**: five business tools, typed, user-scoped; the generic ones disabled.
- **Model calls housed inside the tools**: the document goes straight to the database, never through the orchestrator.
- **Verification outside the model**: the truth guard and the score are code, not prompt instructions.
- **One bounded revision pass, then the user steers** in plain language.
- **A measured service**: every model call records what it cost.


---

<!-- Part 4 -->

## Architecture and technologies

What is built, what it is built with, and how a run actually unfolds


---

<!-- 4 · Architecture -->

### One repository, one origin, one database

*[diagram: architecture-flow]*


---

<!-- 4 · The agent -->

### Five tools, and nothing else

| Tool | Role |
|---|---|
| `get_profile` | Loads the master profile and the allowed vocabulary |
| `analyze_jd` | Consumes quota, analyses the offer, creates the **single** application |
| `write_cv` | Writes the CV for **one** language, saves the draft |
| `compile_pdf` | Guards, renders the PDF, **re-extracts its text** |
| `score_ats` | Scores the variant, returns the **stop decision** |

*Plus `ask_question`, which the interface renders as buttons, and as checkboxes when the options are not mutually exclusive.*

> **Eight generic tools disabled.** A CV-writing agent has no business reading the disk.


---

<!-- 4 · Technologies -->

### Technologies, and why each one

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript 6 | Strict typing end to end, from schema to component |
| Interface | Next.js 16 · React 19 · Tailwind 4 | UI, API routes and the agent runtime in one deployment |
| Agent runtime | eve 0.31 | Durable sessions, stream resumption, typed tools, runtime hooks |
| Models | Vercel AI Gateway (AI SDK 7) | One endpoint, several providers; the model is configuration, not code |
| Validation | Zod 4 | One schema shared by the tools, the structured outputs and the API routes |
| Persistence | Prisma 7 · PostgreSQL 17 | Versioned migrations, typed relations, `Json` columns for flexible fields |
| Documents | @react-pdf/renderer 4 | Declarative rendering, full control of a single-column layout |
| Payments | Stripe | No card data ever touches the application |


---

<!-- 4 · The truth guard -->

### Facts cannot change. Skills are only words.

*[diagram: guard-sets]*

****Facts** employers · titles · dates · projects**

If it is not in your profile, the CV cannot say it. **Not even if you ask.**

****Skills** the words you are allowed to use**

Your profile is never a complete list. A React developer obviously writes TypeScript, so the CV may say so **when the job asked for it**.

*Anything the CV claims that your profile does not back up is shown to you before you send it.*


---

<!-- 4 · The truth guard -->

### Two limits that keep it honest

**It may borrow six words at most**: words the job ad uses and your profile does not. More than six is padding, not tailoring, and the PDF is refused. Borrowing *none* is a failure too: then nothing was tailored.

***And if you insist on a word your profile does not have, it is measured before it is allowed:***

*[diagram: screen-axis]*


---

<!-- 4 · How it works -->

### One full run, end to end

```
turn.started ──▶ hook resets this turn's compile budget

analyze_jd     quota → model call → jdHash → ONE application created
               └─ writes UsageEvent + LlmUsage

write_cv ×N    every language in parallel, in one response

compile_pdf    GUARD → real dates reprinted → render → re-extract text

score_ats      hybrid score → action: revise | stop
               └─ revise: exactly ONE pass, then control returns

closing        six lines maximum, and never restates the score
```

Then **the user drives**. Every message opens a new turn with a fresh compile budget, running the same chain.


---

<!-- 4 · The service layer -->

### What makes it a service and not a demo

|   | Free | Pro | Max |
|---|---|---|---|
| Applications | **1 lifetime** | **30 / period** | **100 / period** |
| Agent turns | **15** | **800** | **2 500** |
| Languages | **1** | **3** | **6** |


---

<!-- Part 5 -->

## Scoring

How the result is measured: deterministically, and decomposably


---

<!-- 5 · Scoring -->

### Four measures out of 100, and one that can override them all

*[diagram: score-weights]*

**What the four measure**

- **Vocabulary · **35****: whether the CV names what the offer names
- **Meaning · **35****: whether it describes the same kind of work
- **Structure · **15****: whether a parser can read it as a CV at all
- **Fit · **15****: whether the title and the seniority correspond

**Why the requirements are not averaged**

An offer marks certain skills as indispensable. The four measures are combined, then **multiplied** by the proportion of those skills actually present: cover half, and the score is halved. A screening system discards a CV that lacks a required skill however well it reads, and the measure reproduces that rather than softening it.


---

<!-- Part 6 -->

## Demo

The system running, end to end


---

<!-- Thank you -->

## Thank you

I welcome your questions.

- Youness HASSOUNE
- ENSA Safi · Department IRT
- LPU-ICSI · Cora Tech
- Defended 19 September 2026
