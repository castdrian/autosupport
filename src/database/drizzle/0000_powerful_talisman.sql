CREATE TABLE `guild_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`minimum_confidence` real DEFAULT 0.8 NOT NULL,
	`ignore_replies` integer DEFAULT true NOT NULL,
	`channel_ids` text DEFAULT '[]' NOT NULL,
	`ignored_roles` text DEFAULT '[]' NOT NULL,
	`confinement_role_id` text
);
--> statement-breakpoint
CREATE TABLE `inmates` (
	`id` text PRIMARY KEY NOT NULL,
	`guild_id` text NOT NULL,
	`confinement_role_id` text NOT NULL,
	`release_date` integer NOT NULL
);
