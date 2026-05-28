# Onboarding Design

This document describes the design philosophy and specification of the onboarding session —
a one-time, voice-first flow that builds the skeleton of a user's personal context in approximately 5 minutes.

---

## Why onboarding exists

The regular interview session (3 questions, up to 2 follow-ups each) is designed as a daily habit.
But a habit requires something to build on. Without an initial foundation, the context takes too many
sessions to become useful — users feel no value and drop off before the system delivers.

The onboarding session solves the cold start problem.
After one 5-minute conversation, the user has enough context that the system is immediately useful.

**Trivy principle applied here:**
The system does the work of figuring out what's missing, not the user.
The user just talks. Deciding which categories are covered and which need filling is the system's job.

---

## Design philosophy: gap-driven, not question-driven

```
Regular session   : LLM picks the next question (question-driven)
Onboarding session: LLM identifies what's missing (gap-driven)
```

The difference matters because:
- Question-driven forces the user to go through a fixed sequence
- Gap-driven lets the user talk naturally, then fills only what's absent

**The rule: never ask about something the user already mentioned.**
If the user said "I left my corporate job at 30 to start a company," do not ask "Have you ever worked at a company?" The system tracks what's covered and skips it.

---

## Flow

### Step 1: One opening question

```
「あなたの人生で転機になったできごとを教えてください。
  複数あれば全部話してください。」
```

Why "turning points" and not "tell me about yourself":
- Too open → user freezes ("where do I even start?")
- "Turning points" gives a clear angle while staying broad
- Turning points naturally surface high-density information:
  | What user says | What system extracts |
  |---|---|
  | When it happened | life_timeline |
  | What they were doing | career_records / life_timeline |
  | How they felt | Vignette candidate |
  | What changed after | behavioral pattern |

- Turning points align with PHILOSOPHY.md — these are the moments where the body reacts most strongly

### Step 2: User speaks freely (~5 minutes via voice)

No interruptions. The system listens.
Voice is 3–5x faster than typing. 5 minutes of speech = enough to sketch a life story.

### Step 3: Gap analysis

After the user finishes, the LLM analyzes coverage across key categories:

| Category | Covered if... |
|---|---|
| Life timeline | At least 2–3 dated events mentioned |
| Career | Current or most recent role mentioned |
| Education | Any educational background mentioned |
| Turning points (emotional) | At least 1 scene with emotional texture |
| Current chapter | What they're doing / thinking about now |

### Step 4: Targeted follow-ups (2–3 questions maximum)

Only ask about uncovered categories. Examples:

- Career gap: 「今はどんな仕事をされていますか？」
- Timeline gap: 「だいたい何年ごろの話ですか？」
- Emotional gap: 「そのときどんな気持ちでしたか？」
- Current gap: 「今、一番頭を使っていることは何ですか？」

**Maximum 3 follow-up questions.** If categories are still uncovered after 3, leave them for regular sessions.
Incomplete is better than exhausting.

### Step 5: Extraction and storage

Same extraction pipeline as regular sessions, with one addition:
the onboarding conversation populates all layers simultaneously.

```
Onboarding conversation
    ↓
extractOnboardingData()
    ↓
    ├ life_timeline entries
    ├ career_records (if mentioned)
    ├ session_vignettes (turning point scenes)
    └ structured_facts (supporting facts)
```

---

## Technical notes

### Session type

A new `type` field on `sessions`: `'onboarding' | 'regular'`
The interview engine uses a different system prompt for onboarding mode.

### System prompt differences

| | Regular session | Onboarding session |
|---|---|---|
| Goal | Ask one question, explore deeply | Map the skeleton, fill gaps |
| Question count | Up to 3 + follow-ups | 1 opening + up to 3 gap-fillers |
| Follow-up style | Emotional depth | Only for uncovered categories |
| End condition | Question limit or exit intent | All critical categories covered OR 3 follow-ups done |

### Voice input dependency

The onboarding session is designed with voice input as the primary path.
Text input works but is significantly more effortful.
Voice input implementation (nodejs-whisper) is a prerequisite for the onboarding experience to feel effortless.

### One-time flag

Once onboarding is completed, the user should not be shown the onboarding flow again.
A `onboarding_completed_at` field on `users` table tracks this.

---

## Context preview: showing the skeleton immediately after onboarding

### Why this matters

Onboarding asks the user to give information with no immediate return.
Without seeing the output, it feels like writing into a void — motivation drops, and users don't come back.

The context preview closes the loop: "here's what we built from your 5 minutes."
It makes the value tangible before the user has to invest any more time.

### What to show

Three sections, minimal and digestible:

| Section | Content | Why |
|---|---|---|
| Life timeline | Events sorted by year | Makes the user feel "it understood me" |
| Key facts | Category + fact, top 5–8 | Shows the breadth of what was captured |
| One vignette | Quote + scene (first extracted) | The emotional texture — most memorable part |

### Flow

```
Onboarding chat ends (AI says "骨格ができました")
  ↓
Client shows "コンテキストを生成中..." (loading state)
  ↓
Server: extraction runs synchronously (awaited, not fire-and-forget)
  ↓
API responds with shouldEnd: true  ← extraction is complete at this point
  ↓
Client fetches GET /api/context-summary
  ↓
Preview screen appears with timeline + facts + vignette
  ↓
"インタビューを始める" button → regular interview
```

### Why extraction is synchronous for onboarding only

Regular sessions use fire-and-forget extraction because the user moves on immediately.
Onboarding is different: the user is waiting to see results, so blocking is acceptable and expected.
Waiting 5–15 seconds after a 5-minute conversation is natural — it signals that something real was processed.

### Implementation notes

- `processMessage` in `engine.ts`: when `shouldEndSession && session.type === 'onboarding'`, `await extractAndSaveFacts()` instead of `.catch(console.error)`
- New endpoint: `GET /api/context-summary` — returns `{ timeline, facts, vignette }`
- `Onboarding.tsx`: after `shouldEnd: true`, enter a loading state, fetch summary, render preview
- The preview is a one-time screen — navigating away is fine, the data persists in the DB

---

## What onboarding does NOT replace

- Regular sessions (daily habit, emotional depth)
- Résumé import (faster for career/education objective data)

Onboarding builds the skeleton. Regular sessions add flesh to the bones over time.
Résumé import can be done before or after onboarding — both paths feed the same tables.
