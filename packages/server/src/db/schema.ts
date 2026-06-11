import { pgTable, text, integer, real, primaryKey, timestamp, boolean } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  clerkId: text('clerk_id').unique(),
  userType: text('user_type', { enum: ['anonymous', 'free', 'premium'] }).notNull().default('free'),
  email: text('email').unique(),
  name: text('name'),
  language: text('language').notNull().default('ja'),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['regular', 'onboarding'] }).notNull().default('regular'),
  status: text('status', { enum: ['active', 'completed', 'abandoned'] }).notNull().default('active'),
  questionsAsked: integer('questions_asked').notNull().default(0),
  followupCount: integer('followup_count').notNull().default(0),
  currentQuestionId: text('current_question_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  endedAt: timestamp('ended_at'),
})

export const rawLogs = pgTable('raw_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['system', 'assistant', 'user'] }).notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const questions = pgTable('questions', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  content: text('content').notNull(),
  priority: integer('priority').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
})

export const questionTranslations = pgTable('question_translations', {
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),
  content: text('content').notNull(),
}, (t) => ({ pk: primaryKey({ columns: [t.questionId, t.language] }) }))

export const userQuestions = pgTable('user_questions', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  answeredAt: timestamp('answered_at').notNull().defaultNow(),
  skippedAt: timestamp('skipped_at'),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.questionId] }) }))

export const STRUCTURED_FACT_CATEGORIES = [
  'childhood', 'education', 'career', 'values', 'goals', 'skills',
  'life_events', 'relationships',
  'character', 'opinions', 'fears', 'patterns', 'preferences',
] as const

export type StructuredFactCategory = typeof STRUCTURED_FACT_CATEGORIES[number]

export const structuredFacts = pgTable('structured_facts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').$type<StructuredFactCategory>().notNull(),
  subcategory: text('subcategory'),
  fact: text('fact').notNull(),
  confidenceScore: real('confidence_score').notNull().default(0.8),
  visibility: text('visibility', { enum: ['public', 'private'] }).notNull().default('private'),
  source: text('source', { enum: ['import', 'interview'] }).notNull().default('interview'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const factEvidences = pgTable('fact_evidences', {
  factId: text('fact_id').notNull().references(() => structuredFacts.id, { onDelete: 'cascade' }),
  logId: text('log_id').notNull().references(() => rawLogs.id, { onDelete: 'cascade' }),
}, (t) => ({ pk: primaryKey({ columns: [t.factId, t.logId] }) }))

export const lifeTimeline = pgTable('life_timeline', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventYear: integer('event_year').notNull(),
  eventMonth: integer('event_month'),
  eventDay: integer('event_day'),
  ageAtEvent: integer('age_at_event'),
  eventDescription: text('event_description').notNull(),
  visibility: text('visibility', { enum: ['public', 'private'] }).notNull().default('private'),
  source: text('source', { enum: ['import', 'interview'] }).notNull().default('interview'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const timelineEvidences = pgTable('timeline_evidences', {
  timelineId: text('timeline_id').notNull().references(() => lifeTimeline.id, { onDelete: 'cascade' }),
  logId: text('log_id').notNull().references(() => rawLogs.id, { onDelete: 'cascade' }),
}, (t) => ({ pk: primaryKey({ columns: [t.timelineId, t.logId] }) }))

export const professionalRecords = pgTable('professional_records', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  role: text('role'),
  startYear: integer('start_year').notNull(),
  startMonth: integer('start_month'),
  endYear: integer('end_year'),
  endMonth: integer('end_month'),
  description: text('description'),
  skills: text('skills'),
  source: text('source', { enum: ['import', 'interview'] }).notNull().default('import'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const demoRateLimit = pgTable('demo_rate_limit', {
  ip: text('ip').notNull(),
  date: text('date').notNull(),
  sessionCount: integer('session_count').notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.ip, t.date] }) }))

export const sessionVignettes = pgTable('session_vignettes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  period: text('period').notNull(),
  quote: text('quote').notNull(),
  scene: text('scene').notNull(),
  insight: text('insight').notNull(),
  selfGap: text('self_gap'),
  visibility: text('visibility', { enum: ['public', 'private'] }).notNull().default('private'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// New tables for multi-user support
export const sessionQuota = pgTable('session_quota', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  date: text('date').notNull(), // ISO date string YYYY-MM-DD
  sessionCount: integer('session_count').notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.date] }) }))

export const anonymousRateLimit = pgTable('anonymous_rate_limit', {
  ip: text('ip').notNull(),
  date: text('date').notNull(), // ISO date string YYYY-MM-DD
  sessionCount: integer('session_count').notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.ip, t.date] }) }))
