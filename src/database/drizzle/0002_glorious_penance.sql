CREATE TABLE `escalated_threads` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `thread_responses` (
	`key` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`response_id` text NOT NULL
);
