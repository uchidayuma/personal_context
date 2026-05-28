# Output Design

This document describes the **design philosophy and specification** of the Markdown files the system generates.
Recording the reasoning behind each decision keeps future contributions consistent with the original intent.

---

## 0. The dual-layer model

Good personal context requires two dimensions. Neither alone is sufficient.

```
Subjective layer — who you are inside
  └ Vignettes: how you felt, how you acted
  └ Behavioral patterns, emotional reactions, values

Objective layer — where you stand in society
  └ Life timeline: turning points and life events
  └ Professional profile: career history, education, skills
```

**Subjective only:** An LLM understands your patterns but can't ground advice in reality.
*"Someone who felt free when traveling"* — but what field are they in? What can they actually do?

**Objective only:** An LLM knows your résumé but doesn't know who you really are.
*"10 years in marketing"* — but do they love it or hate it? What drains them?

Both layers together produce context that is both **honest** and **actionable**.

### The distinction within the objective layer

| | Life timeline | Professional profile |
|---|---|---|
| What it records | Life turning points and events | Career history, education, skills |
| Time axis | Strong (year/month) | Moderate (tenure periods) |
| Connection to emotion | **Strong** — links to Vignettes | Weak — pure factual record |
| How it's collected | Interview (emotional mode) | Résumé import or career interview |

Life timeline emerges naturally from interview conversations — it's intertwined with emotion.
Professional profile is pure objective data collected separately.

---

## 1. Why a list of labels is not enough

The first version of the export looked like this:

```markdown
## Core Facts
### values
- Values freedom
- Values autonomy
### career
- Changed jobs twice
```

This is structurally identical to a LinkedIn profile. An LLM reading this only learns "here is how this person describes themselves."

**The core problem:** structured labels classify a person *from the outside*. An LLM builds deep understanding from *concrete scenes seen from the inside*.

> ❌ `values: freedom`
>
> ✅ *"Turned down a job offer with a ¥1.5M salary increase. When asked why, said 'I don't know, just felt off.' What surfaced later in the conversation: 'Any company that does a mandatory all-hands on Monday mornings just isn't right for me.' The trigger for this person's decisions is not money or career — it's sensitivity to small, daily constraints."*

The second version doesn't tell the LLM this person "values freedom." It shows the LLM the exact shape of what freedom means for *this specific person*.

---

## 2. Use cases and visibility

The output files are designed for two distinct use cases.

### Private (personal Gems)
- Audience: yourself
- Purpose: life design, side project decisions, honest self-reflection
- Visibility: all data — `public` + `private`
- Characteristic: includes raw truth, failures, and contradictions

### Public (GPTs / Gems for others)
- Audience: team members, clients, readers
- Purpose: "CEO's right hand AI," "professional alter ego" for client work
- Visibility: `public` data only
- Characteristic: decision criteria, thinking patterns, communication style — without inner struggles or failures

**Key principle:** the private and public versions are different cuts of the same person, not different personas.
The depth accumulated in the private version is always the foundation for the public one.

---

## 3. What is a Vignette?

**Definition:** A concrete scene extracted from interview conversation logs where the person's true character becomes visible.

The focus is on **behavioral fact** ("did this," "reacted this way") rather than self-declaration ("I think I'm like this").
This carries the "behavior-first" principle from the interview layer all the way through to the output layer.

### Structure

```
title    : Short scene title (5–10 words)
period   : When it happened — e.g. "2022-03" or "2019"
quote    : 1–2 sentences in the person's own words from the conversation
scene    : What happened, what was chosen or avoided, how they acted (3–5 sentences)
insight  : What this scene reveals — one assertive sentence
self_gap : If there's a gap between stated self-image and actual behavior — one sentence. null if absent.
```

### What scenes to extract

Only extract scenes where at least one of the following is present:

| Type | Example |
|---|---|
| Something they *didn't* choose | Turned down an offer, a role, an opportunity |
| Strong emotional reaction | "I absolutely didn't want that" / "I got unexpectedly excited" |
| Unconscious habit | Something they do without being asked, without realizing it |
| Gap between words and actions | Says "I want to grow" but has consistently avoided change |

### Extraction rules

- **0–3 vignettes per session.** Not every session produces one. Never force a shallow scene.
- **The quote must be the user's own words.** No AI-written summaries or paraphrases in the quote field.
- **Insight uses assertive form.** No "might be" or "seems like." If there's enough evidence to write it, write it as fact.
- **Self-gap only when the contradiction is clear.** Never infer a gap from speculation.

### How Vignettes differ from facts and timeline

| | `structured_facts` | `life_timeline` | `session_vignettes` |
|---|---|---|---|
| What it stores | Objective fact labels | Chronological events | Scenes where character becomes visible |
| Granularity | Short, bulleted | Short, bulleted | Multi-sentence narrative |
| Person's own words | No | No | **Always (quote field)** |
| Primary use | Reference / search | Chronological overview | **LLM character understanding** |

---

## 4. One file per layer

### Why not one file?

Dumping all context into one file forces the LLM to read everything even when only one layer is relevant.
A career question needs L4. A relationship question needs L5 and L7. A task needs L9.
One file per layer makes selective loading practical — pass only what the current conversation needs.

### Why not three files (the previous design)?

The previous design grouped layers arbitrarily: `life_chapters.md` held L3 + Vignettes, `current_context.md` held a snapshot of recent facts. This was convenient to implement but made it impossible to say "load L1 and L2 always, load L4 only for career topics." The grouping obscured the CORE/SHAPE/STATE distinction that is the whole point of the model.

### File structure

Templates live in `docs/output_template/`. The canonical file set:

| File | Zone | Update frequency | Visibility |
|---|---|---|---|
| `_index.md` | — | Per export | public |
| `L01_values.md` | CORE | Rare | public |
| `L02_character.md` | CORE | Rare | public |
| `L03_life_timeline.md` | SHAPE | Yearly | public |
| `L04_professional.md` | SHAPE | Per job change | public |
| `L05_relationships.md` | SHAPE | Yearly | public |
| `L06_opinions.md` | SHAPE | Quarterly | public |
| `L07_fears.md` | SHAPE | Yearly | **private** |
| `L08_patterns.md` | SHAPE | Yearly | **private** |
| `L09_goals.md` | STATE | Monthly | public |
| `L10_preferences.md` | STATE | Per session setup | public |
| `life_chapters.md` | — | Accumulative (append-only) | public / private per vignette |

### `_index.md` — always included

Reading guide for the LLM: who this person is, how to use the files, what priority to give each source.
Without this, the LLM has no frame for why it's reading the other files.

### `life_chapters.md` — accumulative, never rewritten

All vignettes in chronological order. New scenes are appended after each session.
This accumulation *is* the personal context — the behavioral record that labels cannot replace.

---

## 5. How to use the output files

### Selection rule: CORE / SHAPE / STATE

| Zone | When to include | Files |
|---|---|---|
| CORE | Always | `_index.md`, `L01_values.md`, `L02_character.md`, `life_chapters.md` |
| SHAPE | By topic | L03–L08 — choose the file(s) that match the conversation topic |
| STATE | Per task | `L09_goals.md`, `L10_preferences.md` — inject when context changes |

### Embedding in a Gem / GPT system prompt

```
Please read all of the following files.

[_index.md]
---
[L01_values.md]
---
[L02_character.md]
---
[life_chapters.md]
---
[+ any SHAPE / STATE files relevant to this conversation]
```

### Recommended framing (already written into `_index.md`)

- This context was built from behavioral facts, not self-declarations
- Ground any advice in specific scenes from `life_chapters.md`
- Reference the person as "someone who has done X" rather than "someone who is X"

---

## 6. `L04_professional.md` — the objective anchor

### Purpose

Provides the LLM with an objective anchor: who this person is in the eyes of society.
Without this, subjective context floats without grounding. With it, advice becomes actionable.

### Structure

```markdown
# Professional Profile

## Current Position
[Current role, industry, organization type and scale]

## Career History
| Period | Role | Organization | Key responsibilities |
|---|---|---|---|

## Education
| Year | Degree / Field | Institution |
|---|---|---|

## Skills & Expertise
### Domain expertise
### Technical / practical skills
### Languages
```

### Multiple input paths — one storage layer

The tables don't care how data arrived. All paths feed the same place.

```
Path A: Résumé / CV paste
    └ Raw text → LLM extracts structure ──────────┐
                                                   ↓
Path B: Career history interview (factual mode)  career_records
    └ Conversation → LLM extracts ──────────────→ education_records
                                                   skill_records
Path C: (future) Manual input form ───────────────┘
                                                   ↓
                                        L04_professional.md
```

**Path A** is for people who already have a résumé — paste and done.
**Path B** is for people without one — a dry, factual interview mode collects the same data through conversation.

### Career interview mode vs. emotional interview mode

The interview engine has two distinct modes. The question style is deliberately different.

| Mode | Example question | Output |
|---|---|---|
| Emotional mode | "When did your body feel light in that job?" | Vignette |
| Factual mode | "What's your current role, and since when?" | career_records |

Factual mode is dry and direct. No follow-up depth. No emotional probing. Just filling in the record.

---

## 7. Future extensions

### Public export (not yet implemented)
Private-first for now. Future considerations:
- Auto-generate a file set containing only `visibility: 'public'` data
- Per-vignette visibility control is already in place at the DB layer

### Vignette editing and deletion (not yet implemented)
When AI extraction doesn't match the person's intent, they need a way to correct it.
The ideal flow: AI extracts, human approves.

### Fact deduplication (not yet implemented)
`structured_facts` is currently append-only.
As facts accumulate, duplicates will appear. A periodic merge/consolidation pass is needed.
