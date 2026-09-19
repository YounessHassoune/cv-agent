# Wellsuited — Defense Speaking Script

**Target: 20 minutes of speech + 5 minutes demo.** Timings in brackets are cumulative.
Bold lines are cues, not words to read. Everything else is meant to be said out loud.

---

## Slide 1 — Cover [0:00 – 1:00]

> Good morning. Mr ECHCHADI, Mr OUJAOURA, thank you for accepting to sit on this jury
> and for the time you are giving this work today.
>
> I would like to thank my academic supervisor for the guidance and the corrections
> throughout this project, and CoraTech, my host company, for trusting me with a real
> subject and giving me the freedom to build it properly.
>
> My name is Youness HASSOUNE. I am presenting my final year project for the
> Professional Bachelor's Degree in Information Systems Engineering and Design:
> the design and implementation of an AI agent SaaS platform for automated CV tailoring
> to job offers. The platform is called **Wellsuited**.

**Pause. Breathe. Do not rush the next slide.**

---

## Slide 2 — Agenda [1:00 – 1:40]

> The presentation is in seven parts.
>
> First the problem: why a qualified candidate never reaches a human reader.
> Second, the obvious objection — why not just use ChatGPT — and why it does not hold.
> Third, what an AI agent actually is, because the whole solution rests on that word.
> Fourth, the architecture and the technologies. Fifth, how the result is measured.
> Then a demonstration, and your questions.

**Do not read the sub-bullets. Just the seven headings.**

---

# Part 1 — The problem

## Slide 3 — Part title [1:40 – 2:10]

> A competent candidate can send sixty applications over four months and receive two
> refusals and no interview. The natural conclusion is that they are not good enough.
> It is very often the wrong conclusion.
>
> The real question is the one on this slide: why does a qualified candidate never reach
> a human reader?

---

## Slide 4 — The hiring bottleneck [2:10 – 3:10]

> Here is what happens to the CV. One job posting today receives hundreds of applications.
> No recruiting team reads hundreds of CVs. Between the candidate and the human there is a
> program — an Applicant Tracking System — and it filters first.
>
> So the candidate is not competing against the other candidates yet. They are competing
> against a parser. And a qualified candidate is filtered out before anyone opens the file
> — not for lack of skill, but for lack of the right words in the right structure.

---

## Slide 5 — How an ATS reads your CV [3:10 – 4:20]

> Concretely the program does three things.
>
> It **extracts** the text — and a two-column template, with icons and a sidebar, is read
> in the wrong order or partly lost.
>
> It **matches** the vocabulary of the offer against the vocabulary of the CV. A CV that
> says "web development" and an offer that says "React" and "REST APIs" describe the same
> work, but the words are not there, so the match is low.
>
> It **ranks**, and a recruiter looks at the top of the list.
>
> A relevant CV that is lexically or structurally misaligned is not badly ranked. It is
> invisible.

---

## Slide 6 — Tailoring by hand does not scale [4:20 – 5:20]

> The obvious answer is to tailor each CV to each offer. That is the right answer, and it
> does not scale.
>
> Reading the description, inferring the real expectations, reordering the experience,
> rephrasing the achievements in the vocabulary of the role, recompiling the document — that
> is between twenty and forty minutes per offer. For every application. And again for every
> target language, since most candidates here apply in French and in English.
>
> Fifteen serious applications is a full working day. So people give up and send one generic
> document to everyone.
>
> And none of that work is creative. It is mechanical and repetitive — exactly the kind of
> work that should be automated.

---

## Slide 7 — Problem statement [5:20 – 6:30]

> This gives the problem statement of the project.
>
> **How can the adaptation of a CV to a job offer be automated, so as to maximise its
> readability by ATS software and its relevance to a recruiter, while guaranteeing by
> construction that no untrue information is introduced, leaving the user in control, and
> making the service economically measurable?**

**Then walk the four rows, one sentence each — this is the contract the rest of the talk answers.**

> Four constraints. **Optimisation**: maximise the alignment with the offer.
> **Truthfulness**: and note the wording — *by construction*. Not "ask the model to be honest".
> **Governance**: the user arbitrates, not the machine.
> **Sustainability**: every application has a real cost, and it must be measured.

---

# Part 2 — Why not just use ChatGPT?

## Slide 8 — Part title [6:30 – 6:50]

> At this point the obvious objection: ChatGPT already exists and it is free. Why build
> anything?
>
> It is a fair objection, and I want to answer it seriously rather than dismiss it.

---

## Slide 9 — One prompt vs a tool pipeline [6:50 – 8:00]

> Paste the CV, paste the offer, ask for a tailored version. A very convincing answer comes
> back in twenty seconds.
>
> Four things are missing. The model **fabricates**: it quietly adds the technologies named
> in the ad, because that is what makes the answer look good. There is **no measurement** —
> it asserts that the CV is improved; nothing verifies it. There is **no document** — the
> output is text, which still has to go into a template the parser may not read. And there
> is **no memory** — the next offer starts from zero.
>
> On the right is what a pipeline returns instead: a draft checked against the profile, a
> reproducible number, a single-column PDF whose text is read back after rendering, and a
> history.
>
> And the important point: these are not prompt problems. A better prompt makes fabrication
> rarer. It never makes it impossible.

---

## Slide 10 — Why fabrication disqualifies it [8:00 – 8:40]

> Why insist on fabrication? Because it is structural, not accidental.
>
> A language model is optimised to satisfy the request. When you ask it to match a job offer,
> satisfying the request *means* claiming what the offer asks for. The model is not lying;
> it is doing its job.
>
> But a CV is a binding document. Walking into an interview with Kubernetes on the CV and
> never having touched it is not a style flaw. It is a fault — and it costs the candidate
> more than the silence did.

---

## Slide 11 — The market [8:40 – 9:40]

> Existing tools each solve half of it.
>
> Jobscan analyses and scores, but does not write the CV and does not compile it.
> Teal keeps the adaptation manual, with no measured convergence loop.
> Rezi and Kickresume do generate content with AI, but with no truth guard — nothing checks
> the output against a persistent source of truth.
> ChatGPT and Gemini: everything we just said.
> And doing it by hand is truthful, but expensive and not reproducible.
>
> The market splits in two: tools that **measure** without writing, and tools that **write**
> without measuring or verifying. Nothing closes the loop.

---

## Slide 12 — The solution: Wellsuited [9:40 – 10:10]

> Wellsuited closes it. A SaaS platform built on an **AI agent** — not a prompt, not a script.
> The agent drives typed tools over one master profile, and deterministic code verifies every
> line before it reaches the page, then measures the result.
>
> Since everything rests on the word "agent", let me define it precisely.

---

# Part 3 — What an AI agent is

## Slide 13 — Part title [10:10 – 10:20]

> What an AI agent is, and why the solution is built on one rather than on a model call.

---

## Slide 14 — An LLM alone vs an agent [10:20 – 11:20]

> The same sentence — "tailor my CV to this offer" — given to a model, and given to an agent.
>
> The **model** returns a block of text that looks like a CV. It only knows what was pasted.
> It may add Kubernetes because the offer asked for it. And afterwards nothing is saved,
> nothing is measured, there is no file.
>
> The **agent** reads the master profile from the database — not from a paste. It calls five
> tools, in an order it decides at runtime. It *cannot* name an employer the profile does not
> contain — that is not a rule in a prompt, it is code. And afterwards a PDF exists, a score
> exists, and the cost of the run is recorded.
>
> An agent is a model plus tools, plus rules, plus memory.

---

## Slide 15 — How an agent works [11:20 – 12:20]

> Mechanically it is a loop. A raw model is stateless: it answers with text and forgets.
> The harness around it turns that into plan, run, check, repeat — until the job is done.
> The model is the passenger. The harness drives.
>
> One real turn: it **plans** — write the English version. It **runs** — the draft is written
> and stored. It **checks** — and here the PDF is blocked, because the draft claims Kubernetes
> and the profile never mentions it. It **repeats** — it rewrites without the claim, the PDF
> is produced, and the score comes back: sixty-eight out of a hundred.
>
> That blocked step is the heart of the project. The model proposed something false and the
> code refused it. Not a warning — a refusal.

---

## Slide 16 — The solution [12:20 – 13:20]

> So, the solution in six points.
>
> **One master profile** — experiences, projects, skills, education. Nothing outside it can
> become a fact on a CV.
> **A closed tool catalogue** — five business tools, typed and user-scoped. The generic ones
> are disabled.
> **The model calls live inside the tools**, so the document goes straight to the database and
> never transits through the orchestrator.
> **Verification lives outside the model**: the truth guard and the score are code, not prompt
> instructions.
> **One bounded revision pass**, then the user steers, in plain language.
> And **a measured service**: every model call records what it cost.

---

# Part 4 — Architecture and technologies

## Slide 17 — Part title [13:20 – 13:30]

> What is built, what it is built with, and how a run actually unfolds.

---

## Slide 18 — Architecture [13:30 – 14:10]

**Trace the diagram with your hand, left to right. One pass, no detours.**

> One repository, one origin, one database. The browser talks to the Next.js application,
> which hosts both the interface and the agent runtime. The agent calls its tools; the tools
> call the models through a single gateway and write to PostgreSQL through Prisma. The PDF is
> rendered server-side. There is no second service to keep in sync.

---

## Slide 19 — The five tools [14:10 – 15:10]

> The five tools, and nothing else.
>
> `get_profile` loads the master profile and the allowed vocabulary.
> `analyze_jd` consumes quota, analyses the offer and creates one — and only one — application.
> `write_cv` writes the CV for one language and saves the draft.
> `compile_pdf` guards, renders the PDF, then re-extracts its text — we read back what the
> parser will actually see, instead of trusting the renderer.
> `score_ats` scores the variant and returns the stop decision.
>
> Plus `ask_question`, which the interface renders as buttons, or checkboxes when the options
> are not exclusive.
>
> And eight generic tools are disabled. A CV-writing agent has no business reading the disk.
> The smaller the surface, the smaller the thing that can go wrong.

---

## Slide 20 — Technologies [15:10 – 16:00]

**Do not read the table. Pick four lines.**

> TypeScript end to end, so the same types run from the database schema to the component.
> The agent runtime is **eve**, which gives durable sessions and typed tools — if the user
> closes the tab mid-run, the run survives.
> Models go through the Vercel AI Gateway: one endpoint, several providers, so the model is
> configuration and not code — I can change it without touching the pipeline.
> Zod validates one schema shared by the tools, the structured outputs and the API routes.
> And Stripe for payments, so no card data ever touches the application.

---

## Slide 21 — The truth guard [16:00 – 17:00]

> The truth guard. It rests on one distinction.
>
> **Facts** — employers, job titles, dates, projects. If it is not in the profile, the CV
> cannot say it. Not even if the user asks for it. This set is closed.
>
> **Skills** are different: they are words. A profile is never a complete list of what someone
> can do. Somebody who ships React obviously writes TypeScript, even if they never wrote the
> word down. So the CV may use the word — but only when the offer asked for it.
>
> And anything the CV claims that the profile does not back up is shown to the user before
> they send it. The user is the one who signs the document.

---

## Slide 22 — Borrow budget and screening [17:00 – 17:50]

> That permission needs a limit, otherwise it becomes fabrication with extra steps.
>
> The CV may borrow **six words at most** — words the offer uses and the profile does not.
> Past six, this is padding, not tailoring, and the PDF is refused. And borrowing **zero** is
> also a failure: it means nothing was tailored at all. The correct behaviour is bounded, in
> both directions.
>
> And if the user insists on a word their profile does not contain, the distance is measured
> before it is allowed — that is the axis on the slide.

---

## Slide 23 — One full run [17:50 – 18:40]

**Read the trace top to bottom, calmly. It is the summary of the whole architecture.**

> A full run. The turn starts and a hook resets the compile budget for that turn.
> `analyze_jd` checks quota, calls the model, hashes the job description so the same offer
> cannot create two applications, and writes the usage events.
> `write_cv` runs every requested language in parallel, in one response.
> `compile_pdf` runs the guard, reprints the real dates from the profile, renders, and
> re-extracts the text.
> `score_ats` produces the hybrid score and returns the decision: revise, or stop. If it
> revises, it gets exactly one pass — then control returns to the user.
>
> And then the user drives. Every message opens a new turn with a fresh budget, running the
> same chain. The agent is bounded; the human is not.

---

## Slide 24 — From prototype to product [18:40 – 19:10]

> What makes it a service and not a demo: quotas, plans and metering. A free tier with one
> application for life, and two paid plans bounded on applications, agent turns and languages.
>
> These numbers are not arbitrary — every model call records its cost, so a plan is priced
> against measured consumption. That was the fourth constraint of the problem statement.

---

# Part 5 — Scoring

## Slide 25 — Part title [19:10 – 19:20]

> Last part before the demo: how the result is measured.

---

## Slide 26 — How the score is made [19:20 – 20:30]

> Four measures out of a hundred. **Vocabulary**, thirty-five: does the CV name what the offer
> names. **Meaning**, thirty-five: does it describe the same kind of work, beyond the keywords.
> **Structure**, fifteen: can a parser read it as a CV at all. **Fit**, fifteen: do the title
> and the seniority correspond.
>
> And then the part I want to insist on. An offer marks certain skills as indispensable.
> Those are not averaged in. The four measures are combined, and then **multiplied** by the
> proportion of required skills actually present. Cover half of them and the score is halved.
>
> Why multiply rather than average? Because that is what the real system does. A screening
> system discards a CV that lacks a required skill, however well the rest reads. An average
> would hide that behind a comfortable seventy-five. The measure reproduces the brutality of
> the filter instead of softening it.
>
> On the offers I tested, a generic CV scores in the forties and the tailored version comes
> back in the high seventies. Same facts, same person, nothing invented — only the alignment
> changed.

---

## Slide 27 — Demo [20:30 – 25:00]

**Say what they are about to see before you click. If something fails, narrate it and move on.**

> I will now show the system end to end: a real job offer, the analysis, the CV written, the
> guard, the PDF, and the score.

**Demo order: paste offer → analysis → generation → open PDF → score → ask for one change in
plain language → show it applied.**

---

## Slide 28 — Thank you [end]

> That is the work. To summarise it in one sentence: the problem was not that a model cannot
> write a CV — it is that nothing was verifying it. Wellsuited puts the writing inside an
> agent, and the verification outside the model.
>
> Thank you for your attention. I am at your disposal for your questions.

---

## Likely jury questions — prepared answers

**"Why an agent and not a simple sequence of scripted calls?"**
Because the number of languages, the need to revise, and the free-form conversation afterwards
are decided at runtime. A fixed script would have to enumerate every path. The agent chooses
the tools; the code keeps the choice bounded.

**"How do you know the score is meaningful?"**
It is deterministic and decomposable: the same input always gives the same number, and every
point is traceable to one of four components plus the required-skill coverage. It is a proxy
for a screening system, not a promise of an interview — and I present it as such.

**"What stops the model from bypassing the guard?"**
The guard is not an instruction to the model. It runs in `compile_pdf`, after generation,
before rendering. If it fails, no PDF exists. The model cannot argue with it.

**"Is skill borrowing not fabrication?"**
Facts are closed and never borrowed. Only vocabulary is, capped at six words, only when the
offer uses them, and everything borrowed is shown to the user before they send it.

**"What are the limits of the work?"**
The score is a proxy, not a real ATS. The guard depends on the completeness of the profile.
And evaluation is on a limited set of offers — a larger corpus and an A/B test on real
callback rates are the natural next step.

**"Why these models / why a gateway?"**
So the model stays configuration. The pipeline, the guard and the score do not change when the
model does — which is the only sane assumption in this field.

**"What is a quota?"**
A quota is a countable allowance: how many times a user may do a costly action inside a
given time window. In Wellsuited the costly action is not a page view — it is a model call.
So three things are metered: **applications** (one tailored CV for one offer), **agent turns**
(one message in the conversation), and **CV imports** (filling the profile from a PDF).
Free allows 1 application, 15 turns, 1 language, counted over the lifetime of the account;
Pro and Max allow 30 and 100 applications, over the Stripe billing period.

Four points if they push further:

- **Where it is spent.** In `analyze_jd`, at the exact line where an application comes into
  existence — not in the interface. A gate in the UI is a suggestion; a gate in the tool is
  the rule, because the tool is the only path to the model.
- **What counts as the receipt.** Not the `Application` row, but a separate `UsageEvent` row.
  If I counted applications, deleting one would give the user their quota back — a free-tier
  reset button. The model call already happened; the receipt must outlive the object.
- **Why turns are metered at all.** Every turn resends the whole conversation to the model,
  so the cost of a thread grows with the square of its length. An unmetered chat is the one
  thing in this product that can cost ten times its estimate.
- **Why the window is Stripe's period and not the calendar month.** Someone subscribing on
  the 28th with a reset on the 1st would get two full allowances in four days.

And a refund path exists: `refundApplication`. The quota is spent *before* the application
row is written, because the quota is what decides whether the row may exist. If that insert
is then refused — a duplicate offer caught by the unique constraint — the usage event is
deleted and any credit given back. A user is never charged for an application they did not get.

**"What is an agent turn?"**
One turn is one user message and everything the agent does in response to it, until it stops
and gives control back. So a turn is *not* one model call and *not* one tool call — a single
turn can contain five tool calls, three model calls, a guard rejection and a rewrite. The user
sends "tailor my CV to this offer"; the agent analyses, writes, compiles, scores, maybe revises
once — that is one turn.

Why the turn and not the model call is the unit:

- **It is the only unit the user controls.** They decide when to send a message. They do not
  decide how many tool calls that costs.
- **It is where the cost really is.** Every turn resends the whole conversation to the model,
  so the *n*-th turn is more expensive than the first. Cost grows with the square of the
  thread's length, not with its length — which is why the budget caps turns and not calls.
- **It is the natural boundary for state.** A `turn.started` hook resets the per-turn compile
  budget, so the agent may not recompile endlessly on its own initiative, but the user's next
  message always gets a fresh budget. The agent is bounded inside a turn; the user is not
  bounded across turns.

Technically the turn is counted in the proxy, before the run starts — a user already over
budget never opens another one — and `LlmUsage` records the real token cost of every model
call inside it, which is what lets a plan be priced against measured consumption.
