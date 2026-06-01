# Technical Specification

## 1. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript | |
| Package manager | pnpm v10 (monorepo) | Pinned to v10 — v11's supply chain policy causes unstable Docker builds |
| DB client | @libsql/client + Drizzle ORM | `better-sqlite3` rejected: requires native compilation, breaks Docker builds |
| Database | SQLite (file-based) | |
| LLM | Vercel AI SDK + @ai-sdk/deepseek | Model switchable via env var. Default: DeepSeek Chat |
| Server | Hono + @hono/node-server | |
| Frontend | React + Vite | |
| i18n | react-i18next + i18next-browser-languagedetector | Supported: `ja` / `en` |
| Container | Docker (node:22-alpine) + docker-compose | docker-compose for local dev, ECS for production |

### LLM Model Compatibility

This system uses `generateObject` (Vercel AI SDK) for three operations:
- Interview response generation (`generateInterviewResponse`)
- Fact/vignette extraction after each session (`extractFactsFromConversation`)
- Document import parsing (`extractFromDocument`)

`generateObject` forces the model to return a JSON object matching a Zod schema. **The model must support structured output / function calling.** Models that return plain text will cause `AI_NoObjectGeneratedError` and the UI will show a configuration error banner.

| Model | Compatible | Notes |
|---|---|---|
| `deepseek-chat` (default) | ✅ | Recommended |
| `gpt-4o`, `gpt-4o-mini` | ✅ | Set `LLM_PROVIDER=openai` |
| `claude-3-haiku-*`, `claude-3-sonnet-*` | ✅ | Set `LLM_PROVIDER=anthropic` |
| `deepseek-v4-flash` | ❌ | Does not support structured output |
| Ollama models (varies) | ⚠️ | Only models with tool-use support work |

When an incompatible model is used, the server returns HTTP 422 with `code: "MODEL_NOT_SUPPORTED"` and a descriptive message. The chat UI displays this as a yellow warning banner.

### Monorepo structure

```
packages/
  server/   # Hono API server — DB, LLM integration, interview engine, export
  web/      # React frontend
  mcp/      # MCP server — Claude Code / Codex integration
docs/       # Design documents
```

---

## 2. Database Schema (SQLite)

SQLite is the single source of truth. Accessed via `@libsql/client`, schema managed with Drizzle ORM.

```sql
-- User management
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT,
    language TEXT NOT NULL DEFAULT 'ja',  -- UI and interview language
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Session management
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned')),
    questions_asked INTEGER NOT NULL DEFAULT 0,
    followup_count INTEGER NOT NULL DEFAULT 0,
    current_question_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Raw conversation logs
CREATE TABLE raw_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('system', 'assistant', 'user')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Base question master (stored in Japanese)
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- Question translations (i18n)
CREATE TABLE question_translations (
    question_id TEXT NOT NULL,
    language TEXT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (question_id, language),
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Per-user answered question tracking
CREATE TABLE user_questions (
    user_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    answered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, question_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- AI-extracted structured facts (append-only)
CREATE TABLE structured_facts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    category TEXT NOT NULL,
    fact TEXT NOT NULL,
    confidence_score REAL NOT NULL DEFAULT 0.8,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Fact-to-log evidence links
CREATE TABLE fact_evidences (
    fact_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    PRIMARY KEY (fact_id, log_id),
    FOREIGN KEY (fact_id) REFERENCES structured_facts(id) ON DELETE CASCADE,
    FOREIGN KEY (log_id) REFERENCES raw_logs(id) ON DELETE CASCADE
);

-- Life timeline
CREATE TABLE life_timeline (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    event_year INTEGER NOT NULL,
    event_month INTEGER,
    event_day INTEGER,
    age_at_event INTEGER,
    event_description TEXT NOT NULL,
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Timeline-to-log evidence links
CREATE TABLE timeline_evidences (
    timeline_id TEXT NOT NULL,
    log_id TEXT NOT NULL,
    PRIMARY KEY (timeline_id, log_id),
    FOREIGN KEY (timeline_id) REFERENCES life_timeline(id) ON DELETE CASCADE,
    FOREIGN KEY (log_id) REFERENCES raw_logs(id) ON DELETE CASCADE
);

-- Scene records extracted from sessions (Vignettes)
-- See docs/OUTPUT_DESIGN.md for design rationale
CREATE TABLE session_vignettes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    title TEXT NOT NULL,
    period TEXT NOT NULL,       -- e.g. "2022-03" or "2019"
    quote TEXT NOT NULL,        -- direct quote from the user's words
    scene TEXT NOT NULL,        -- scene description (3–5 sentences)
    insight TEXT NOT NULL,      -- what this scene reveals (1 assertive sentence)
    self_gap TEXT,              -- gap between self-image and behavior (null if absent)
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
```

-- Career history (objective layer)
CREATE TABLE career_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,           -- job title / role
    organization TEXT NOT NULL,   -- company or organization name
    period_start TEXT,            -- "2018-04"
    period_end TEXT,              -- "2022-03" / NULL if current
    is_current INTEGER NOT NULL DEFAULT 0,
    description TEXT,             -- key responsibilities and achievements
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Education and credentials (objective layer)
CREATE TABLE education_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    institution TEXT NOT NULL,    -- school or institution name
    degree TEXT,                  -- degree or certification name
    field TEXT,                   -- major or field of study
    year_end INTEGER,             -- graduation / completion year
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Skills (objective layer)
CREATE TABLE skill_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,       -- 'technical', 'domain', 'language', 'other'
    visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('public', 'private')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

### Local user ID

The OSS version has no authentication. On startup, a default user record (`id = 'local_default_user'`) is created automatically. The schema is multi-tenant ready — no code changes needed when moving to a hosted SaaS version.

### Migration strategy

**Current (OSS):** Managed idempotently inside `initDatabase()` using `CREATE TABLE IF NOT EXISTS`. Column additions to existing DBs are handled by checking `PRAGMA table_info` before running `ALTER TABLE`.

**Future (hosted):** Will migrate to drizzle-kit migration file management.

---

## 3. Interview Engine

### Session limits

```typescript
const MAX_QUESTIONS_PER_SESSION = 3   // max questions handled per session
const MAX_FOLLOWUPS_PER_QUESTION = 2  // max follow-up depth per question
```

### Flow

1. **Session start**
   - Fetch user language via `getUserLanguage()`
   - JOIN `questions` + `question_translations`, select one unanswered question ordered by priority DESC (`COALESCE` prefers translation over original)
   - Create new record in `sessions`
   - Transform selected question to coaching tone via LLM and present to user

2. **User response and follow-up**
   - While `followup_count < MAX_FOLLOWUPS`: LLM generates a follow-up question if the answer has more depth to explore
   - No follow-up needed or limit reached → advance to next question (`questions_asked + 1`)

3. **Session end** (whichever comes first)
   - `questions_asked >= MAX_QUESTIONS_PER_SESSION`
   - LLM detects exit intent (`shouldEndSession: true`)

4. **Post-session async processing**
   - Concatenate full conversation log in `[role]: content` format
   - LLM extracts `facts`, `timeline`, `vignettes` in one pass (`extractFactsFromConversation`)
   - Save to `structured_facts`, `life_timeline`, `session_vignettes`
   - Link to evidence tables (`fact_evidences`, `timeline_evidences`)

---

## 4. LLM Provider

Uses Vercel AI SDK. All LLM logic lives in `packages/server/src/llm/provider.ts`.

### Key functions

| Function | Purpose |
|---|---|
| `transformToCoachingTone(question, context, language)` | Rewrite a question in warm coaching tone |
| `generateInterviewResponse(systemPrompt, messages)` | Generate interview response — returns `response`, `askedFollowup`, `shouldEndSession` |
| `extractFactsFromConversation(conversation)` | Extract `facts`, `timeline`, `vignettes` from conversation in one LLM call |

### Environment variables

```
DEEPSEEK_API_KEY=...
LLM_MODEL=deepseek-chat  # default — change to switch models
```

---

## 5. Export

See `docs/OUTPUT_DESIGN.md` for design rationale.

### Output format

`exportToMarkdown(userId, includePrivate)` returns an `ExportFiles` object.

```typescript
interface ExportFiles {
  index: string               // _index.md
  lifeChapters: string        // life_chapters.md
  currentContext: string      // current_context.md
  professionalProfile: string // professional_profile.md
}
```

### API endpoints

```
GET /api/export?visibility=public  → public data only
GET /api/export?visibility=all     → public + private

Response: { files: ExportFiles }

POST /api/import/resume
Body: { text: string }  → raw résumé / CV text
Flow: LLM parses text → saves to career_records, education_records, skill_records
Response: { imported: { career: number, education: number, skills: number } }
```

---

## 6. Internationalization

### User language

Stored in `users.language` (default `'ja'`). UI language changes are persisted to the DB via `PATCH /api/user`.

### Question i18n

- Source text (Japanese) stored in `questions.content`
- Translations managed in `question_translations`
- On selection: `COALESCE(question_translations.content, questions.content)` — translation takes priority

### Interview language

`buildSystemPrompt()` generates an English or Japanese system prompt based on the user's language setting.

---

## 7. Security

### Supply chain

- `pnpm install --frozen-lockfile` — build fails on any lockfile mismatch
- `.npmrc` sets `minimum-release-age=0` — disables pnpm's same-day package policy which breaks Docker builds
- pnpm v10 pinned — v11's default `minimumReleaseAge` policy is incompatible with Docker build environments

### Encryption (future)

OSS version stores data as plaintext. When moving to a hosted version, an `EncryptionProvider` interface will be introduced to add encryption transparently without changing application logic.
