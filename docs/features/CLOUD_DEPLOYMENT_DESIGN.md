# Cloud Deployment Design - PostgreSQL Migration & Multi-User Authentication

## Overview

Enable public cloud deployment on fly.io with:
- Multi-user authentication (Clerk)
- PostgreSQL for production / SQLite for local
- User tiers: Anonymous (20min TTL), Free (3 sessions/day), Premium (future)

## Architecture

### Database Strategy

| Environment | Database | Use Case |
|-------------|----------|----------|
| Local (OSS) | SQLite | Self-hosted, single user |
| Cloud (fly.io) | PostgreSQL | Multi-user production |

Controlled by `DATABASE_TYPE=sqlite|postgres` environment variable.

### User Tiers

| Tier | Authentication | Data Retention | Rate Limit |
|------|---------------|----------------|------------|
| Anonymous | UUID (sessionStorage) | 20 minutes | 3 sessions/day (IP-based) |
| Free | Email + password (Clerk) | Permanent | 3 sessions/day |
| Premium | Email + password (Clerk) | Permanent | Unlimited (future) |

## Implementation Details

### 1. Database Adapter Factory

**File Structure:**
```
packages/server/src/db/
  ├── client.ts           # Factory (chooses adapter based on env)
  ├── client.sqlite.ts    # SQLite setup
  ├── client.postgres.ts  # PostgreSQL setup
  └── schema.ts           # Shared schema
```

**Key Changes:**
- Replace `sqliteTable` with conditional table creators
- Timestamp: SQLite (text) → PostgreSQL (timestamp)
- Boolean: SQLite (integer 0/1) → PostgreSQL (native boolean)

### 2. Authentication (Clerk)

**Dependencies:**
- `@clerk/clerk-sdk-node` (server)
- `@clerk/clerk-react` (web)

**Flow:**
1. User signs up → Clerk sends verification email
2. Email verified → Can create sessions
3. Middleware validates JWT → Sets userId in context
4. Unverified users see "Please verify your email"

**Middleware:**
```typescript
// 1. Validate Clerk JWT
app.use('/api/*', clerkMiddleware())

// 2. Extract user context
app.use('/api/*', async (c, next) => {
  const auth = getAuth(c)
  
  if (auth.userId) {
    // Registered user
    const user = await getOrCreateUserFromClerk(db, auth.userId)
    c.set('userId', user.id)
    c.set('userType', user.userType)
  } else {
    // Anonymous user (X-User-Id header)
    const xUserId = c.req.header('X-User-Id')
    if (xUserId) {
      await ensureAnonymousUser(db, xUserId)
      c.set('userId', xUserId)
      c.set('userType', 'anonymous')
    } else {
      return c.json({ error: 'Unauthorized' }, 401)
    }
  }
  
  await next()
})
```

### 3. Schema Changes

**users table:**
```typescript
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  clerkId: text('clerk_id').unique(),  // NEW
  userType: text('user_type', { 
    enum: ['anonymous', 'free', 'premium'] 
  }).notNull().default('free'),  // NEW
  email: text('email').unique(),  // NEW
  name: text('name'),
  language: text('language').notNull().default('ja'),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

**New tables:**
```typescript
// Free user rate limiting
export const sessionQuota = pgTable('session_quota', {
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  sessionCount: integer('session_count').notNull().default(0),
}, (table) => ({ pk: primaryKey({ columns: [table.userId, table.date] }) }))

// Anonymous user rate limiting (IP-based)
export const anonymousRateLimit = pgTable('anonymous_rate_limit', {
  ip: text('ip').notNull(),
  date: date('date').notNull(),
  sessionCount: integer('session_count').notNull().default(0),
}, (table) => ({ pk: primaryKey({ columns: [table.ip, table.date] }) }))
```

### 4. Rate Limiting

**Free Users (3 sessions/day):**
```typescript
async function checkFreeUserRateLimit(db: Db, userId: string) {
  const today = new Date().toISOString().split('T')[0]
  const [quota] = await db.select()
    .from(sessionQuota)
    .where(and(
      eq(sessionQuota.userId, userId),
      eq(sessionQuota.date, today)
    ))
  
  if (quota && quota.sessionCount >= 3) {
    throw new Error('Daily session limit reached (3/day for free users)')
  }
  
  await db.insert(sessionQuota)
    .values({ userId, date: today, sessionCount: 1 })
    .onConflictDoUpdate({
      target: [sessionQuota.userId, sessionQuota.date],
      set: { sessionCount: sql`${sessionQuota.sessionCount} + 1` }
    })
}
```

**Anonymous Users (5 sessions/day per IP):**
```typescript
async function checkAnonymousRateLimit(db: Db, ip: string) {
  const today = new Date().toISOString().split('T')[0]
  const [limit] = await db.select()
    .from(anonymousRateLimit)
    .where(and(
      eq(anonymousRateLimit.ip, ip),
      eq(anonymousRateLimit.date, today)
    ))
  
  if (limit && limit.sessionCount >= 5) {
    throw new Error('Daily session limit reached (5/day for anonymous users)')
  }
  
  await db.insert(anonymousRateLimit)
    .values({ ip, date: today, sessionCount: 1 })
    .onConflictDoUpdate({
      target: [anonymousRateLimit.ip, anonymousRateLimit.date],
      set: { sessionCount: sql`${anonymousRateLimit.sessionCount} + 1` }
    })
}
```

### 5. Cleanup Jobs

**Anonymous User Cleanup (every 5 minutes):**
```typescript
setInterval(async () => {
  await db.delete(users).where(
    and(
      eq(users.userType, 'anonymous'),
      sql`${users.createdAt} < NOW() - INTERVAL '20 minutes'`
    )
  )
}, 5 * 60 * 1000)
```

**Session Quota Cleanup (daily):**
```typescript
// Delete records older than 7 days
await db.delete(sessionQuota).where(
  sql`${sessionQuota.date} < CURRENT_DATE - INTERVAL '7 days'`
)
await db.delete(anonymousRateLimit).where(
  sql`${anonymousRateLimit.date} < CURRENT_DATE - INTERVAL '7 days'`
)
```

### 6. fly.io Deployment

**PostgreSQL Setup:**
```bash
fly postgres create --name personal-context-db --region nrt --initial-cluster-size 1
fly postgres attach personal-context-db --app personal-context
```

**fly.toml:**
```toml
app = "personal-context"
primary_region = "nrt"

[build]
  dockerfile = "Dockerfile"

[env]
  DATABASE_TYPE = "postgres"
  NODE_ENV = "production"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = false
  min_machines_running = 1
```

## Migration Path

### Phase 1: Database Abstraction
1. Add PostgreSQL driver (`pg`)
2. Create adapter factory (`client.ts`, `client.sqlite.ts`, `client.postgres.ts`)
3. Update schema to support both dialects
4. Test both databases locally

### Phase 2: Authentication
1. Add Clerk dependencies
2. Update middleware for auth + anonymous users
3. Add `<ClerkProvider>` to web app
4. Add sign-up/sign-in UI

### Phase 3: Rate Limiting
1. Add new schema tables (`session_quota`, `anonymous_rate_limit`)
2. Implement rate limit checks in session routes
3. Add cleanup jobs

### Phase 4: Deployment
1. Create fly.io app
2. Set up PostgreSQL
3. Configure environment variables
4. Deploy and test

## Testing

### Local (SQLite)
```bash
docker compose up
# Visit http://localhost:5173 → Should work unchanged
```

### Cloud (PostgreSQL)
```bash
fly deploy
# Test anonymous user (5 sessions/day limit)
# Test registered user (email verification, 3 sessions/day limit)
```

## Open Questions

- Premium tier pricing and features (future)
- Payment integration (Stripe?) (future)
- Data export for anonymous users before TTL expires? (not planned)

## References

- Clerk Documentation: https://clerk.com/docs
- fly.io PostgreSQL: https://fly.io/docs/postgres/
- Drizzle ORM Multi-Dialect: https://orm.drizzle.team/docs/overview
