# Security model

What this app defends, where each control lives, and what is deliberately left
undone. The short version: **the model is never a security boundary.** Every
rule that matters is enforced by code the model cannot reach, and the prompt
rules exist to keep honest runs on the rails, not to stop an attacker.

## Trust boundaries

| Surface | Who controls it | Enforced by |
| --- | --- | --- |
| Session cookie | The app | `agent/lib/session.ts` — HMAC-SHA256 over the payload, constant-time compare, `httpOnly`, `sameSite=lax`, `secure` in production, 30-day expiry checked on every read |
| Agent tool calls | The model chooses, the code decides | `agent/lib/auth.ts` resolves the principal; every tool scopes its Prisma queries by that `userId` |
| Job description text | **A third party** | Fenced and labelled as data in `agent/lib/jd-analysis.ts`; the call can only return an `Extraction` |
| CV content | The model writes it | `agent/lib/guard.ts` rejects any employer, project or skill term the profile and the job do not support; `compile_pdf` is the only path onto a page |
| Billing state | Stripe | `app/api/billing/webhook/route.ts` — signature verified over raw bytes, one `StripeEvent` row per event id as the idempotency lock |
| Sandbox tools | Nobody — they are off | `agent/tools/{bash,read_file,write_file,glob,grep,web_fetch,web_search}.ts` all `disableTool()` |

## The prompt is not a secret, and is not a control

`agent/instructions.md` contains no credentials, no ids, and nothing whose
disclosure grants access. Its confidentiality section exists because a recited
prompt is a poor user experience and a map for someone probing the app — not
because leaking it would break anything. An attacker who reads the entire brief
still cannot add an employer to a CV, because `findFabrications` rejects it, and
still cannot see another user's profile, because every query is scoped by the
session's `userId`.

The rule to apply when adding a feature: **if breaking a rule costs money,
truth, or somebody else's data, that rule belongs in a tool, not in markdown.**

## Prompt injection

The job description is the one input to the pipeline an attacker controls end to
end — they write the ad, and the user pastes it in whole without reading what a
browser hides. Three things stand between an injected instruction and a
fabricated CV:

1. The JD is fenced and labelled as data, and both tool-side system prompts
   (`prompts/jd-analyst.ts`, `prompts/cv-writer.ts`) carry a matching rule.
2. Every model call in the pipeline returns structured output against a Zod
   schema. The only thing the analyst can produce is an `Extraction`.
3. `compile_pdf` runs `findFabrications` over the finished draft. An employer,
   a project or a skill term that neither the profile nor the job supports never
   reaches a page, whatever the model was persuaded to write.

`evals/safety/` asserts all of this: `no-prompt-disclosure` checks that the
agent does not recite its brief, `jd-injection` pastes a poisoned ad and asserts
the fabricated employer is absent from `compile_pdf`'s own output, and
`stays-in-scope` checks it declines unrelated work. The canary phrases live in
`evals/safety/canaries.ts` and must be kept in step with the instructions — a
reworded phrase detects nothing and the eval then passes for the wrong reason.

## Authentication and abuse

- Passwords: scrypt with a per-password salt, self-describing stored format, and
  a 200-character ceiling so an unauthenticated route cannot be used to spend
  CPU (`agent/lib/password.ts`).
- Sign-in answers the same way whether the account is missing, Google-only, or
  the password is wrong, so the route is not an account-existence oracle.
- Rate limits (`lib/rate-limit.ts`) on sign-in (per IP and per address),
  sign-up, verification resend, and password change. They are counted before any
  scrypt work happens.
- Google OAuth state is a signed nonce echoed through an `httpOnly` cookie and
  compared in constant time; an unverified Google email is refused.
- Verification links are stored only as a SHA-256 digest, expire in 24 hours,
  are single-use per account, and are rate limited to one a minute per account.
- Agent turns are metered in `proxy.ts`, in front of the route that starts them,
  so a hand-written `fetch` cannot walk around the paywall.

## HTTP headers

`next.config.ts` sets `X-Frame-Options`, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and HSTS
in production. The CSP is **report-only and deliberately has no `script-src`**:
Next injects inline bootstrap and hydration scripts, so a policy strict enough
to be worth enforcing needs a per-request nonce threaded through middleware.
Enforcing the current policy would buy little and break nothing quietly.

## Known gaps

These are understood and left open on purpose. Each needs a decision, not a
patch.

- **No session revocation.** The cookie is stateless, so signing out clears the
  browser's copy but a stolen token stays valid until it expires, and changing a
  password does not end sessions on other devices. Fixing it means either a
  per-user token epoch checked against the database on every request — a read on
  the hot path, against a connection pool currently capped at one — or a much
  shorter cookie lifetime with silent renewal.
- **Rate limits are per instance.** `lib/rate-limit.ts` counts in process
  memory, so on a serverless deployment a caller spread over many cold starts
  sees a higher effective ceiling. A hard limit needs a shared store (Redis, or
  a table with a unique index on the window).
- **Transitive advisories remain in the build chain** — postcss, deepmerge-ts,
  mysql2 and fast-uri, all reached through Tailwind's build and Prisma's dev
  tooling rather than by anything a request touches. `sharp` and `nanoid` were
  the two that runtime code reaches, and both are pinned past their advisories
  (`pnpm-workspace.yaml`, `package.json`).
- **No CSRF tokens.** `sameSite=lax` blocks the cross-site POST that would carry
  the session cookie, which covers the form routes as they are written today. A
  route that ever needs `sameSite=none` needs a token first.
