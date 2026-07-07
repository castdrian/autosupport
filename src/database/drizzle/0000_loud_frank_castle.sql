CREATE TABLE `escalated_threads` (
	`thread_id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guild_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_ids` text DEFAULT '[]' NOT NULL,
	`knowledge_base_vector_store_id` text,
	`knowledge_base_hash` text
);
--> statement-breakpoint
CREATE TABLE `thread_responses` (
	`key` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`response_id` text NOT NULL
);
