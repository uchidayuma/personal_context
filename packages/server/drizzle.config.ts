import { defineConfig } from 'drizzle-kit'

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://personal_context:personal_context@localhost:5432/personal_context'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: DATABASE_URL,
  },
})
