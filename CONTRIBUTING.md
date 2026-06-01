# Contributing to Personal Context Engine

Thank you for your interest in contributing.

## Before You Start

Please read these two documents first:

- **[docs/vision/PHILOSOPHY.md](docs/vision/PHILOSOPHY.md)** — the design convictions behind this project
- **[docs/design/OUTPUT_DESIGN.md](docs/design/OUTPUT_DESIGN.md)** — why the output is structured the way it is

This project has strong opinions. Understanding the *why* before writing code will save you time.

## Design-First Rule

Every non-trivial change needs a design doc before implementation:

1. Write or update a doc in `docs/features/`
2. Open an issue or PR draft to discuss
3. Implement once the approach is agreed

## Development Setup

```bash
git clone https://github.com/uchidayuma/personal_context
cd personal_context
cp .env.example .env  # add your LLM API key
docker compose up
```

The app runs at `http://localhost:5173`.

## Project Structure

```
packages/server/   # Hono API — interview engine, LLM, export
packages/web/      # React + Vite frontend
docs/              # Design docs (read before contributing)
```

## What's Welcome

- Bug fixes with a clear reproduction case
- New LLM provider support (follow the pattern in `packages/server/src/llm/provider.ts`)
- Question quality improvements (see `packages/server/src/db/seed.ts`)
- Translations — add `src/i18n/<lang>.json` and a corresponding seed translation array

## What to Avoid

- Features that add noise to the interview flow
- UI changes that move away from the minimal aesthetic
- Breaking changes to the Markdown export format without a design doc

## Commit Style

```
feat: add X
fix: correct Y
docs: update Z
```

## License

By contributing, you agree that your code will be licensed under MIT.
