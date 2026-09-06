---
description: Load when rewriting CV bullets, summaries, or headlines, or when translating a CV into another language.
---

# CV writing rules

## Bullet formula (Google X-Y-Z)

Every experience/project bullet follows: **Accomplished X, as measured by Y, by doing Z** — adapted naturally to the target language.

- Start with a strong past-tense action verb (led, built, reduced, shipped, automated). No "responsible for", no first person.
- Y (the measure) comes only from the profile. If the profile has no number for that work, write a qualitative but concrete outcome instead — never invent a figure.
- Z names the concrete tech/method from the profile's stack for that entry.
- One line each, ideally under 25 words. 3–5 bullets for recent/relevant roles, 1–2 for older ones.

Example transformation:
- Profile raw: "worked on checkout, made it faster with caching"
- Tailored: "Cut checkout p95 latency by ~40% by introducing Redis-backed caching for pricing lookups" *(only if the 40% and Redis exist in the profile)*

**Every bullet gets rewritten, every time.** A profile bullet copied through unchanged is a failure — the bullets carry more relevance signal than the summary does, so they get at least as much tailoring. The facts (scope, numbers, technologies, outcomes) stay identical; the framing follows the JD.

The same underlying fact, aimed at three different jobs:
- Profile raw: "built the notifications service with NestJS and RabbitMQ, handles 50k messages/day"
- Backend-platform JD: "Designed an event-driven notifications service processing 50k messages/day, using RabbitMQ for asynchronous message delivery"
- Distributed-systems JD: "Built a decoupled, queue-backed service sustaining 50k messages/day with at-least-once delivery guarantees"
- Product-engineering JD: "Shipped the notifications service end-to-end, now delivering 50k messages/day to users"

Note what never changes: NestJS/RabbitMQ, the 50k figure, and the fact that it is a notifications service. Only the angle moves.

## Adapting to the role (transferable experience)

The CV is rewritten *for this role*, not filtered against it. When the JD's exact stack differs from the profile's, surface the shared capability in the JD's language — truthfully.

- Reframe at the capability level: "built APIs with NestJS" → "designed and developed scalable backend REST APIs and services (Node.js/NestJS)" for a backend role; "wrote React components" → "built accessible, performant user interfaces" for a frontend role. The profile's real tools stay named; the framing follows the JD's priorities.
- Mirror the JD's verbs and responsibility phrasing ("own", "design", "operate", "ship") in bullets describing genuinely matching work.
- Emphasize what transfers: API design, architecture, databases, authentication, testing, CI/CD, system design, domain knowledge — these matter more than a missing tool name.
- The boundary: transferable framing never names a technology the candidate hasn't used, and never upgrades "adjacent" to "expert in the JD's stack". When in doubt, describe the capability, not the tool.

## Selection and emphasis

- Include at most the 3–4 experiences and 2–3 projects most relevant to the JD; drop or compress the rest.
- Reorder each entry's bullets so the most JD-relevant achievement is first.
- The headline mirrors the JD's role title **only if** the profile genuinely supports it; otherwise use the nearest truthful title.
- The summary (2–3 sentences) connects the user's strongest verifiable experience to the JD's top requirements, naturally containing 3–5 top keywords.

## Translation

- Translate meaning, not words: use the target market's standard CV conventions and terminology (e.g. French CVs use "Expérience" section norms, formal register).
- Keep proper nouns, product names, and technology names untranslated.
- Dates in the target language's format ("Jan 2022" → "janv. 2022").
- Never let translation add or strengthen a claim; when in doubt, translate conservatively.
