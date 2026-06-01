CREATE TABLE IF NOT EXISTS `demo_rate_limit` (
	`ip` text NOT NULL,
	`date` text NOT NULL,
	`session_count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`ip`, `date`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `fact_evidences` (
	`fact_id` text NOT NULL,
	`log_id` text NOT NULL,
	PRIMARY KEY(`fact_id`, `log_id`),
	FOREIGN KEY (`fact_id`) REFERENCES `structured_facts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`log_id`) REFERENCES `raw_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `life_timeline` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_year` integer NOT NULL,
	`event_month` integer,
	`event_day` integer,
	`age_at_event` integer,
	`event_description` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`source` text DEFAULT 'interview' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `professional_records` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`company_name` text NOT NULL,
	`role` text,
	`start_year` integer NOT NULL,
	`start_month` integer,
	`end_year` integer,
	`end_month` integer,
	`description` text,
	`skills` text,
	`source` text DEFAULT 'import' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `question_translations` (
	`question_id` text NOT NULL,
	`language` text NOT NULL,
	`content` text NOT NULL,
	PRIMARY KEY(`question_id`, `language`),
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`content` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `raw_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `session_vignettes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`title` text NOT NULL,
	`period` text NOT NULL,
	`quote` text NOT NULL,
	`scene` text NOT NULL,
	`insight` text NOT NULL,
	`self_gap` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text DEFAULT 'regular' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`questions_asked` integer DEFAULT 0 NOT NULL,
	`followup_count` integer DEFAULT 0 NOT NULL,
	`current_question_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `structured_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category` text NOT NULL,
	`subcategory` text,
	`fact` text NOT NULL,
	`confidence_score` real DEFAULT 0.8 NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`source` text DEFAULT 'interview' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `timeline_evidences` (
	`timeline_id` text NOT NULL,
	`log_id` text NOT NULL,
	PRIMARY KEY(`timeline_id`, `log_id`),
	FOREIGN KEY (`timeline_id`) REFERENCES `life_timeline`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`log_id`) REFERENCES `raw_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_questions` (
	`user_id` text NOT NULL,
	`question_id` text NOT NULL,
	`answered_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`user_id`, `question_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`language` text DEFAULT 'ja' NOT NULL,
	`onboarding_completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
