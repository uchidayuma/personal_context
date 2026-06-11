# Personal Context Engine

![alt](https://github.com/user-attachments/assets/cd8947da-df70-421d-b939-d46043d37034)


*日本語 README: [README.ja.md](README.ja.md)*

[Click here for final output example](https://github.com/uchidayuma/personal_context/tree/main/output_example/en)

**Record yourself in a form any AI can truly understand — your personal context engine, portable to any LLM.**

Personal Context solves two problems:

1. Understand yourself
2. Build a **personal file** — not locked to any AI service

Answer a few interview questions each day. The engine quietly builds a structured knowledge base of you — exportable as plain Markdown to Claude, ChatGPT, Cursor, or any LLM you choose.

## ⚡️ Live Demo

**Try it without installing anything:** [personal-context.fly.dev/](https://personal-context.fly.dev/)

> **Note:** Demo sessions are ephemeral — data is not persisted after you close the tab. Limited to 3 sessions per IP per day.

---

https://github.com/user-attachments/assets/9ab712f0-1af2-4b5f-9ca0-df786cd25fdb

> For people who want sharper AI responses, or who want to capture themselves as a complete Markdown document.

[![CI](https://github.com/uchidayuma/personal_context/actions/workflows/ci.yml/badge.svg)](https://github.com/uchidayuma/personal_context/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-required-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

---

## 3 core model
![image](https://github.com/user-attachments/assets/5e441797-33fa-4bc0-b97c-0bac972ae84a)

| Layer | Depth | What it captures | Output Files |
| :--- | :--- | :--- | :--- |
| CORE | Deepest | Immutable values, core beliefs, and innate temperament. The foundation of "you". | `L01`, `L02` |
| SHAPE | Medium | Acquired experiences, behavioral patterns, relationships, and distinct stances. | `L03` - `L08` |
| STATE | Surface | Current goals, active projects, and immediate preferences for the session. | `L09`, `L10` |

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

**Database**: The app uses PostgreSQL (automatically set up via Docker Compose). Data is persisted in a Docker volume.

Edit `.env` and pick one LLM provider:

```bash
# Pick one provider and uncomment the matching API key:

LLM_PROVIDER=ollama
# LLM_PROVIDER=openai
# LLM_PROVIDER=anthropic
# LLM_PROVIDER=deepseek

# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# DEEPSEEK_API_KEY=sk-...
# OLLAMA_BASE_URL=http://host.docker.internal:11434/v1  # when running via Docker (default for Docker)
```

**Estimated cost to build a complete context** (all L1–L10 layers, ~30–50 sessions):

| Provider | Model | Estimated Cost |
|---|---|---|
| Ollama | any local model | **Free** |
| OpenAI | gpt-4o-mini | ~$1 |
| DeepSeek | deepseek-chat | ~$1.5 |
| Anthropic | claude-haiku-3-5 | ~$5 |
| OpenAI | gpt-4o | ~$15 |
| Anthropic | claude-sonnet-3-5 | ~$20 |

> Estimates based on actual usage. Costs vary with session length and language. Ollama runs locally — no API key needed.

```bash
docker compose up
```

Open `http://localhost:5173` — start your first interview session.

### Optional: Enable Voice Dialogue Mode

If you want to use voice-based interview sessions (speak instead of typing), set up Google Cloud Text-to-Speech:

1. **Create a GCP project and enable the API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or use an existing one)
   - Enable **Cloud Text-to-Speech API** in API Library
   - **Free tier**: 1 million characters/month — enough for typical usage

2. **Create a service account and download credentials**
   - Go to **IAM & Admin → Service Accounts**
   - Create a service account with role: **Cloud Text-to-Speech Client** (or Editor for dev)
   - Generate a JSON key and download it

3. **Place the key file and configure Docker**
   ```bash
   # Place the key in project root
   mv ~/Downloads/your-key-*.json ./gcp-tts-key.json
   
   # Add to .gitignore (already included by default)
   echo "gcp-tts-key.json" >> .gitignore
   ```

4. **Restart Docker**
   ```bash
   docker compose down
   docker compose up
   ```

The voice dialogue button (🎧) will now be enabled in interview sessions. Without GCP credentials, the button remains disabled and text-only mode is used.

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

→ See [`output_example/`](output_example/) for real exported files.

---

## What is a Vignette?

A vignette is a behavioral scene — a specific moment where the person's character becomes visible through action.

Instead of abstract labels:
```
values: freedom, autonomy
```

The engine captures scenes:
```
title:   "Wings grew from my feet" — a moment at Narita Airport
quote:   "My body felt so light, like wings had grown from my feet.
          I thought, 'This is how I want to live.' That was the moment I decided."
scene:   Heading to Vietnam with just one backpack. The body felt astonishingly light.
         That physical sensation became the confirmation of a life decision.
insight: This person trusts bodily sensation as a compass for major life decisions.
         The body's verdict overrides rational deliberation.
```

One vignette like this tells an LLM more about a person than ten bullet points of traits.
Vignettes are stored in `life_chapters.md` and included in every context export.

---

## MCP Server — Use Your Context Anywhere

Build your context once, then connect it to any AI tool via the **MCP (Model Context Protocol) server**.

```bash
# Build the MCP server
pnpm --filter @personal-context/mcp build
```

### Claude Code

Add to `.claude/settings.json` in your project:

```json
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

### Cursor / Cline / Codex CLI

```json
{
  "mcpServers": {
    "personal_context": {
      "command": "node",
      "args": ["/path/to/personal_context/packages/mcp/dist/index.js"]
    }
  }
}
```

Once connected, any AI tool can call `get_context` to load your personal context. CORE layers load automatically — SHAPE/STATE layers are fetched as needed.

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
| Database | PostgreSQL 16 + Drizzle ORM |
| LLM | Vercel AI SDK — Ollama / OpenAI / Anthropic / DeepSeek |
| Server | Hono |
| Frontend | React + Vite |
| Container | Docker (node:22-alpine) |
| Deployment | fly.io (optional) |

---

## Project Structure

```
packages/
  server/   # Hono API server — DB, LLM, interview engine, export
  web/      # React + Vite frontend
  mcp/      # MCP server — Claude Code / Codex integration
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
