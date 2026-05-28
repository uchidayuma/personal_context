FROM node:22-alpine AS base
RUN npm install -g pnpm@10
WORKDIR /app

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc tsconfig.base.json ./
COPY packages/server/package.json ./packages/server/
COPY packages/web/package.json ./packages/web/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# server (tsx — hot reload only if WATCH=true)
FROM base AS server
COPY packages/server ./packages/server
EXPOSE 3001
CMD ["sh", "-c", "if [ \"$WATCH\" = 'true' ]; then pnpm --filter @personal-context/server dev; else pnpm --filter @personal-context/server dev:stable; fi"]

# web (Vite dev server)
FROM base AS web
COPY packages/web ./packages/web
EXPOSE 5173
CMD ["pnpm", "--filter", "web", "dev", "--", "--host"]
