CREATE TABLE "anonymous_rate_limit" (
	"ip" text NOT NULL,
	"date" text NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "anonymous_rate_limit_ip_date_pk" PRIMARY KEY("ip","date")
);
--> statement-breakpoint
CREATE TABLE "demo_rate_limit" (
	"ip" text NOT NULL,
	"date" text NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "demo_rate_limit_ip_date_pk" PRIMARY KEY("ip","date")
);
--> statement-breakpoint
CREATE TABLE "fact_evidences" (
	"fact_id" text NOT NULL,
	"log_id" text NOT NULL,
	CONSTRAINT "fact_evidences_fact_id_log_id_pk" PRIMARY KEY("fact_id","log_id")
);
--> statement-breakpoint
CREATE TABLE "life_timeline" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_year" integer NOT NULL,
	"event_month" integer,
	"event_day" integer,
	"age_at_event" integer,
	"event_description" text NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"source" text DEFAULT 'interview' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professional_records" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"company_name" text NOT NULL,
	"role" text,
	"start_year" integer NOT NULL,
	"start_month" integer,
	"end_year" integer,
	"end_month" integer,
	"description" text,
	"skills" text,
	"source" text DEFAULT 'import' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "question_translations" (
	"question_id" text NOT NULL,
	"language" text NOT NULL,
	"content" text NOT NULL,
	CONSTRAINT "question_translations_question_id_language_pk" PRIMARY KEY("question_id","language")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"content" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session_quota" (
	"user_id" text NOT NULL,
	"date" text NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "session_quota_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "session_vignettes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" text NOT NULL,
	"title" text NOT NULL,
	"period" text NOT NULL,
	"quote" text NOT NULL,
	"scene" text NOT NULL,
	"insight" text NOT NULL,
	"self_gap" text,
	"visibility" text DEFAULT 'private' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text DEFAULT 'regular' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"questions_asked" integer DEFAULT 0 NOT NULL,
	"followup_count" integer DEFAULT 0 NOT NULL,
	"current_question_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "structured_facts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"subcategory" text,
	"fact" text NOT NULL,
	"confidence_score" real DEFAULT 0.8 NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"source" text DEFAULT 'interview' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_evidences" (
	"timeline_id" text NOT NULL,
	"log_id" text NOT NULL,
	CONSTRAINT "timeline_evidences_timeline_id_log_id_pk" PRIMARY KEY("timeline_id","log_id")
);
--> statement-breakpoint
CREATE TABLE "user_questions" (
	"user_id" text NOT NULL,
	"question_id" text NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL,
	"skipped_at" timestamp,
	CONSTRAINT "user_questions_user_id_question_id_pk" PRIMARY KEY("user_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"user_type" text DEFAULT 'free' NOT NULL,
	"email" text,
	"name" text,
	"language" text DEFAULT 'ja' NOT NULL,
	"onboarding_completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "fact_evidences" ADD CONSTRAINT "fact_evidences_fact_id_structured_facts_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."structured_facts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fact_evidences" ADD CONSTRAINT "fact_evidences_log_id_raw_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."raw_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_timeline" ADD CONSTRAINT "life_timeline_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professional_records" ADD CONSTRAINT "professional_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_translations" ADD CONSTRAINT "question_translations_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_logs" ADD CONSTRAINT "raw_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_logs" ADD CONSTRAINT "raw_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_quota" ADD CONSTRAINT "session_quota_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_vignettes" ADD CONSTRAINT "session_vignettes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_vignettes" ADD CONSTRAINT "session_vignettes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structured_facts" ADD CONSTRAINT "structured_facts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_evidences" ADD CONSTRAINT "timeline_evidences_timeline_id_life_timeline_id_fk" FOREIGN KEY ("timeline_id") REFERENCES "public"."life_timeline"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "timeline_evidences" ADD CONSTRAINT "timeline_evidences_log_id_raw_logs_id_fk" FOREIGN KEY ("log_id") REFERENCES "public"."raw_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_questions" ADD CONSTRAINT "user_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_questions" ADD CONSTRAINT "user_questions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;