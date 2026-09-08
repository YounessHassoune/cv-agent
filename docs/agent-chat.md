# How the chat agent works

This is a map of the chat UI. The split is simple:

- **Components** decide what you see.
- **Hooks** decide what happens (send, stop, restore, follow a live turn).

The chat talks to **eve** (`useEveAgent`). Everything in `features/chat` is a thin layer around that.

```
Home page                         Application page
─────────                         ────────────────
AgentChat                         ResumableAgentChat
    │                                   │
    └── useAgentChat                    ├── useResumableSession  (restore / follow)
            │                           └── AgentChat
            ├── useEveAgent (eve)               └── useAgentChat
            └── useCancellation
```

Two screens use it:

| Where | Component | Why |
| --- | --- | --- |
| Home (`HomeView`) | `AgentChat` | New conversation. No saved session. |
| Application panel | `ResumableAgentChat` | Same conversation as before, even if a turn is still running. |

---

## 1. `AgentChat` — the screen

**File:** `features/chat/components/agent-chat.tsx`

This component does **no** sending or streaming. It calls `useAgentChat`, then paints whatever the hook returns.

### Two layouts (`variant`)

- **`page`** (home): empty state is a centred hero (title + chips + composer). Once there are messages, the transcript fills the middle and the composer sticks to the bottom.
- **`panel`** (application sidebar): empty state is a short intro above the composer. The transcript fills the panel; the composer stays at the bottom.

The composer is **never unmounted** when switching empty → not empty. That is why a draft in the input box survives the first send.

### What it renders

| Piece | When it shows |
| --- | --- |
| `ChatHeader` | Page layout only, and only after the first message |
| `ErrorBanner` | When send or cancel failed |
| `ChatTranscript` | When there is at least one message |
| Suggestion chips | Only while the thread is empty |
| `ChatComposer` | Always |

### Props that matter

| Prop | Meaning |
| --- | --- |
| `contextPrefix` | Extra text stuck on the **first** message in a panel, so the agent knows which application you are looking at |
| `initialEvents` / `initialSession` | Saved history, so a reload continues the same thread |
| `persistUrl` | Where to save the snapshot after a turn finishes |
| `liveMessages` | Messages from a turn this chat did **not** start (see `useResumableSession`) |
| `onResetThread` | “Start a fresh conversation” when the session is stuck |
| `footer` | Extra block under the empty home composer (recent applications) |

---

## 2. `useAgentChat` — the brain

**File:** `features/chat/hooks/use-agent-chat.ts`

This is the only hook `AgentChat` talks to. It owns:

1. The eve session (`useEveAgent`)
2. Stop / queue (`useCancellation`)
3. The application id the agent creates mid-turn
4. Submit, suggestions, and “respond to a prompt”

### Status flags it exposes

```
isEmpty              no messages yet
isBusy               submitted, streaming, or following a live turn
awaitingFirstToken   busy, but nothing new is on screen yet (“Thinking…”)
streamingIndex       which message is currently filling in
activityNote         human line: “Stopping…”, “Your message is queued…”
submitStatus         what the send/stop button should show
```

`isBusy` is true in three cases:

- eve status is `submitted` (message sent, nothing streamed yet)
- eve status is `streaming` (tokens / tools arriving)
- `liveMessages` is set (another page started the turn; we are only watching)

### Sending a message

```
User submits
    │
    ├─ empty? ignore
    ├─ following a live turn? ignore (composer is disabled)
    ├─ agent already busy?
    │     queue the text, then request cancel
    │     when the agent is free, send the queued text
    └─ otherwise: send now
```

`dispatch` is **not awaited**. `agent.send()` only resolves when the whole turn is done. If the composer waited for that, the user’s text would sit in the box for the entire run.

The first panel message is wrapped with `contextPrefix`. Later messages are sent as typed.

Files become a multi-part payload (`text` + `file` parts).

### Mid-turn application id

On the home page there is no application yet. The agent creates one when `analyze_jd` returns. `handleEvent` scans stream events for `"applicationId"` and:

- shows a “Your application is ready” link in the composer
- after the turn, saves the transcript to `/api/applications/{id}/chat`

### After a turn (`onFinish`)

1. `router.refresh()` so the server-rendered page around the chat (CV, score) updates.
2. Persist the event log to `persistUrl`, or to the application chat URL if one was discovered.

### `respond`

Used when a message in the transcript asks the user a question (approve, pick an option). It goes through `agent.respond`, not `send`.

---

## 3. `useCancellation` — stop the current run

**File:** `features/chat/hooks/use-cancellation.ts`

Cancellation is **cooperative**. The server only stops at the next step boundary. Two races are handled here so `AgentChat` only sees a state string.

### States

```
idle  →  requested  →  cancelling  →  idle
```

| State | Meaning |
| --- | --- |
| `idle` | Nothing to stop |
| `requested` | User hit stop (or sent while busy). Waiting for a turn id. |
| `cancelling` | Cancel was sent to eve, or we are waiting for a session id |

### Why it is racy

1. The user can hit stop **before** `send()` is accepted → no session id yet. `retryPending` fires when `onSessionChange` finally has one.
2. The turn id only exists after the server emits `turn.started`. `noteTurnStarted` records it, then cancels.
3. If the model is already in a long step, cancel waits. After **6 seconds** `isSlow` becomes true so the UI can say: *“Still finishing the step it had already started.”*

`reset()` runs at the start of every new send so a previous cancel does not leak into the next turn.

---

## 4. `useResumableSession` — restore and follow

**File:** `features/chat/hooks/use-resumable-session.ts`

`useEveAgent` only streams turns **it started**. If you start a tailor run on the home page, then open the application, that run is still going on the server — but a new `AgentChat` would not see it.

This hook:

1. Attaches to the eve session by `sessionId`.
2. Loads a live snapshot (the saved log is stale while a turn is running).
3. If a turn is still active, **follows** the stream and projects events with eve’s own reducer (`defaultMessageReducer`).
4. Those live messages are passed to `AgentChat` as `liveMessages`. The composer stays disabled (`isFollowing`).
5. When the turn ends: save the log, `router.refresh()`, then hand the full event list to `useEveAgent` so the next send continues the same session.

It retries the follow loop up to **5** times (idle reconnects can drop during a long silent step).

If there is no `sessionId`, it settles immediately and `AgentChat` starts a fresh thread.

---

## 5. `ResumableAgentChat` — wrapper for saved threads

**File:** `features/chat/components/resumable-agent-chat.tsx`

Tiny wrapper used on the application page:

```
if not settled yet → “Loading conversation…”
else → AgentChat with restored events/session
         + liveMessages while following
```

It remounts `AgentChat` (`key="following"` → `key="owned"`) when the followed turn ends, so `useEveAgent` rebuilds its store from the **complete** log, not the old prefix.

---

## 6. Pieces around the hooks

These are presentational. They do not own session logic.

| File | Job |
| --- | --- |
| `chat-composer.tsx` | Input box, send/stop, optional “open application” link, activity note |
| `chat-transcript.tsx` | Scrollable message list + “Thinking…” shimmer |
| `agent-message.tsx` | Renders one eve message (text, tools, files, questions) |
| `suggestion-chips.tsx` | One-tap starters; empty list after the first message |
| `chat-error.tsx` | Error banner; “fresh conversation” if the session is stuck |
| `status-dot.tsx` | Tiny live/idle/error indicator in the page header |

Helpers:

| File | Job |
| --- | --- |
| `lib/messages.ts` | `isBetweenSteps` — true when the agent is quiet between tools/tokens |
| `lib/stream.ts` | Turn active/boundary, find `applicationId`, persist snapshot |
| `lib/errors.ts` | Cancel error text; detect a stuck empty-response thread |

---

## 7. One turn, start to finish (home page)

```
1. User pastes a JD and hits send
2. useAgentChat.dispatch → agent.send()
3. status = submitted → “Thinking…”
4. turn.started → cancellation can now target this turn
5. analyze_jd returns → applicationId appears → link in composer
6. More tools / text stream into the last assistant message
7. Between steps, awaitingFirstToken shows “Thinking…” again
8. Turn ends → persist snapshot, router.refresh()
9. User can open /applications/{id} and keep chatting
   (ResumableAgentChat + useResumableSession)
```

If they type again while step 5–7 is running:

```
message is queued → cancel requested → turn stops at next step
→ agent free → queued message sends automatically
```

---

## 8. What each hook is for (cheat sheet)

| Hook | One sentence |
| --- | --- |
| `useEveAgent` | eve’s hook: send, stream, messages, status |
| `useAgentChat` | App logic on top of eve: queue, context, persist, application id |
| `useCancellation` | Stop a running turn, including “stop before we even have an id” |
| `useResumableSession` | Reload a saved chat and keep watching a turn started elsewhere |

If you are changing **how it looks**, stay in `agent-chat.tsx` and the `components/` files.

If you are changing **when it sends, stops, or saves**, stay in the hooks.
