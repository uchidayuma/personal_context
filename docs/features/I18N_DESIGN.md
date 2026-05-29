# I18N Design — Language Toggle (JA / EN)

## Overview

Language switching between Japanese and English across all UI text and interview content.

## What's Already in Place

This section documents the existing infrastructure so future contributors don't rediscover it.

| Layer | What exists |
|---|---|
| `users.language` column | Stores per-user language preference (`'ja'` default) |
| `questionTranslations` table | `(questionId, language) → content` — English translations for all seed questions |
| `packages/server/src/interview/engine.ts` | Already reads `users.language`, JOINs `questionTranslations`, and conditionally applies EN system prompts |
| `packages/server/src/db/seed.ts` | `EN_TRANSLATIONS` array covers all 41 seed questions |
| `PATCH /api/user` | Updates `users.language` |
| `react-i18next` | Already installed and initialized in `src/i18n/index.ts` |
| `src/i18n/ja.json` / `src/i18n/en.json` | Translation files |
| Language toggle buttons in `App.tsx` | JA/EN buttons call `PATCH /api/user` + `i18n.changeLanguage()` |

## Translation File Structure

```
src/i18n/
  index.ts     ← i18next initialization (LanguageDetector + react-i18next)
  ja.json      ← Japanese strings
  en.json      ← English strings
```

### Namespaces used in ja.json / en.json

| Key prefix | Covers |
|---|---|
| `app.*` | App title, nav labels, demo banner |
| `chat.*` | Chat UI, mic button tooltips, error messages |
| `dashboard.*` | Context dashboard, layer names (L1–L10), data counts |
| `voice.*` | Voice mode overlay labels |
| `import.*` | Import upload screen, zone descriptions |
| `onboarding.*` | Onboarding flow |
| `progress.*` | Progress header (ProgressHeader component) |
| `export.*` | Export view |

### Layer name translations

Layer names come from the server (`/api/progress` returns `layer.id` and `layer.name`). The frontend maps by ID using `t('dashboard.layers.L1')` etc. rather than using the server-provided name string. This keeps the server agnostic of locale.

## How the Language Switch Works

1. User clicks JA or EN button in the header
2. `switchLanguage(lang)` in `App.tsx`:
   - `PATCH /api/user { language: lang }` — persists to DB
   - `i18n.changeLanguage(lang)` — re-renders all `t()` consumers immediately
3. On next interview session, `engine.ts` reads `getUserLanguage()` from DB and:
   - Selects translated question from `questionTranslations` (or falls back to Japanese question)
   - Injects EN system prompt instruction when `lang === 'en'`

## Adding a New Language (e.g. Chinese)

1. Add `src/i18n/zh.json` with all keys from `en.json` translated
2. In `src/i18n/index.ts`, add `zh: { translation: zh }` to `resources`
3. Add `'zh'` to `supportedLngs`
4. In `App.tsx`, add `'zh'` to the language button array
5. In `packages/server/src/db/seed.ts`, add a `ZH_TRANSLATIONS` array and seed it
6. In `packages/server/src/interview/engine.ts`, add `lang === 'zh'` handling for system prompt language instruction
7. No DB schema changes needed — `questionTranslations` already supports any language string

## Design Decisions

### No custom LocaleContext — use react-i18next throughout

react-i18next is already installed and provides global re-render on `changeLanguage()`. A custom Context would duplicate this.

### Server returns layer names in Japanese; frontend translates by ID

Avoids breaking the API contract. The `layer.id` (L1–L10) is the stable key.

### Question templates are pre-translated in seed (not LLM-translated at runtime)

Pre-seeding all 41 questions in EN avoids per-call LLM translation overhead and produces more consistent question quality.

### Language preference persisted in `users.language` (DB)

Survives page reload and applies to the interview engine server-side. `i18next-browser-languagedetector` provides the browser default on first load before the user record is fetched.
