# Personal Context Engine

**Give AI a complete picture of who you are — once, and for any LLM.**

Answer a few interview questions each day. The engine quietly builds a structured knowledge base of you — exportable as plain Markdown to Claude, ChatGPT, Cursor, or any LLM you choose.

> For people who want sharper AI responses, or who want to capture themselves as a complete Markdown document.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-required-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

*日本語ドキュメント: [docs/](docs/)*

---

## The Problem

Every major LLM platform now has its own memory feature. But your context is trapped inside each one — you can't take your Claude memories to ChatGPT, or your ChatGPT history to Cursor.

Worse: even with memory, most LLMs don't truly *know* you. They store what you tell them, not who you actually are. The gap between "what you say about yourself" and "how you actually behave" is where the most important signal lives.

## The Solution

Personal Context Engine builds your context from the *outside in*:

1. **Passive interview** — The system asks questions. You just answer. No forms to fill out, no documents to write.
2. **Behavioral extraction** — Questions are designed to surface what you *do*, not what you *think*. How you spend money and time. What makes your body feel light. What drains you even when you succeed.
3. **Vignette-first output** — Instead of labels (`"values: freedom"`), the system captures scenes: *"Turned down a promotion. When asked why, said 'the Monday all-hands just felt wrong.'"* — one sentence that tells an LLM more than ten bullet points.
4. **Portable Markdown** — Export your entire context as plain Markdown files, one per context layer. Paste into any Gem, GPT, or system prompt. Your context, your rules — no cloud lock-in, no platform dependency.

---

## Quick Start

**Requirements**: Docker + Docker Compose

```bash
git clone https://github.com/uchidayuma/personal_context
cd personal_context

cp .env.example .env
```

Choose your LLM provider in `.env`:

```bash
# Option A: Ollama — fully local, no API key needed
LLM_PROVIDER=ollama
# OLLAMA_BASE_URL=http://localhost:11434/v1  # default

# Option B: OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...

# Option C: Anthropic
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Option D: DeepSeek
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=sk-...
```

```bash
docker compose up
```

Open `http://localhost:5173` — start your first interview session.

---

## How It Works

```
Interview session
    ↓
Raw conversation logs (SQLite)
    ↓
LLM extracts: facts + timeline + vignettes
    ↓
Export: one Markdown file per context layer
    ↓
Paste into any LLM — selectively, by topic
```

**Output files — one per context layer:**

| File | Zone | When to include |
|---|---|---|
| `_index.md` | — | Always — reading guide for the LLM |
| `L01_values.md` | CORE | Always |
| `L02_character.md` | CORE | Always |
| `L03_life_timeline.md` | SHAPE | Life decisions, turning points |
| `L04_professional.md` | SHAPE | Career topics |
| `L05_relationships.md` | SHAPE | People & relationships |
| `L06_opinions.md` | SHAPE | Discussions, decisions |
| `L07_fears.md` | SHAPE | Deep self-reflection (private) |
| `L08_patterns.md` | SHAPE | Behavioral patterns (private) |
| `L09_goals.md` | STATE | Current tasks and direction |
| `L10_preferences.md` | STATE | Session setup |
| `life_chapters.md` | — | Always — behavioral scenes |

CORE files go into every system prompt. SHAPE and STATE files are loaded selectively — pass only what the conversation needs.

---

## Design Philosophy

**How you felt reveals more truth than how you thought.**

Rational explanations are already filtered through social expectations and self-image. Physical reactions — the moment your body felt light, the Sunday dread, the excitement you didn't expect — are the raw signal. This is why every interview question is anchored in behavior and sensation, not introspection.

→ See [docs/vision/PHILOSOPHY.md](docs/vision/PHILOSOPHY.md) for the full design conviction.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 22, TypeScript, pnpm monorepo |
| Database | SQLite via `@libsql/client` + Drizzle ORM |
| LLM | Vercel AI SDK — Ollama / OpenAI / Anthropic / DeepSeek |
| Server | Hono |
| Frontend | React + Vite |
| Container | Docker (node:22-alpine) |

---

## Project Structure

```
packages/
  server/   # Hono API server — DB, LLM, interview engine, export
  web/      # React + Vite frontend
docs/
  vision/          # PHILOSOPHY.md, PRD.md, CONTEXT_LAYERS.md
  spec/            # SPEC.md, openapi.yml, TESTING_DESIGN.md
  design/          # OUTPUT_DESIGN.md, INTERVIEW_POLICY.md
  features/        # Per-feature design docs
  output_template/ # Markdown output templates (L01–L10)
```

---

## Contributing

Read [docs/vision/PHILOSOPHY.md](docs/vision/PHILOSOPHY.md) and [docs/design/OUTPUT_DESIGN.md](docs/design/OUTPUT_DESIGN.md) before contributing. This project has strong design convictions — understanding the *why* matters more than the *what*.

---

## License

MIT — see [LICENSE](LICENSE)
