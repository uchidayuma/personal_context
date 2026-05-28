import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name'),
  language: text('language').notNull().default('ja'),
  onboardingCompletedAt: text('onboarding_completed_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['regular', 'onboarding'] }).notNull().default('regular'),
  status: text('status', { enum: ['active', 'completed', 'abandoned'] }).notNull().default('active'),
  questionsAsked: integer('questions_asked').notNull().default(0),
  followupCount: integer('followup_count').notNull().default(0),
  currentQuestionId: text('current_question_id'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  endedAt: text('ended_at'),
})

export const rawLogs = sqliteTable('raw_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['system', 'assistant', 'user'] }).notNull(),
  content: text('content').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const questions = sqliteTable('questions', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  content: text('content').notNull(),
  priority: integer('priority').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
})

export const questionTranslations = sqliteTable('question_translations', {
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  language: text('language').notNull(),
  content: text('content').notNull(),
}, (t) => [primaryKey({ columns: [t.questionId, t.language] })])

export const userQuestions = sqliteTable('user_questions', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  answeredAt: text('answered_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => [primaryKey({ columns: [t.userId, t.questionId] })])

export const STRUCTURED_FACT_CATEGORIES = [
  'childhood', 'education', 'career', 'values', 'goals', 'skills',
  'life_events', 'relationships',
  'character', 'opinions', 'fears', 'patterns', 'preferences',
] as const

export type StructuredFactCategory = typeof STRUCTURED_FACT_CATEGORIES[number]

export const structuredFacts = sqliteTable('structured_facts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  category: text('category').$type<StructuredFactCategory>().notNull(),
  fact: text('fact').notNull(),
  confidenceScore: real('confidence_score').notNull().default(0.8),
  visibility: text('visibility', { enum: ['public', 'private'] }).notNull().default('private'),
  source: text('source', { enum: ['import', 'interview'] }).notNull().default('interview'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const factEvidences = sqliteTable('fact_evidences', {
  factId: text('fact_id').notNull().references(() => structuredFacts.id, { onDelete: 'cascade' }),
  logId: text('log_id').notNull().references(() => rawLogs.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.factId, t.logId] })])

export const lifeTimeline = sqliteTable('life_timeline', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  eventYear: integer('event_year').notNull(),
  eventMonth: integer('event_month'),
  eventDay: integer('event_day'),
  ageAtEvent: integer('age_at_event'),
  eventDescription: text('event_description').notNull(),
  visibility: text('visibility', { enum: ['public', 'private'] }).notNull().default('private'),
  source: text('source', { enum: ['import', 'interview'] }).notNull().default('interview'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const timelineEvidences = sqliteTable('timeline_evidences', {
  timelineId: text('timeline_id').notNull().references(() => lifeTimeline.id, { onDelete: 'cascade' }),
  logId: text('log_id').notNull().references(() => rawLogs.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.timelineId, t.logId] })])

export const professionalRecords = sqliteTable('professional_records', {
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
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const sessionVignettes = sqliteTable('session_vignettes', {
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
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
})
