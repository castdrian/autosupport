DROP TABLE `inmates`;--> statement-breakpoint
ALTER TABLE `guild_preferences` ADD `knowledge_base_vector_store_id` text;--> statement-breakpoint
ALTER TABLE `guild_preferences` ADD `knowledge_base_hash` text;--> statement-breakpoint
ALTER TABLE `guild_preferences` DROP COLUMN `minimum_confidence`;--> statement-breakpoint
ALTER TABLE `guild_preferences` DROP COLUMN `ignore_replies`;--> statement-breakpoint
ALTER TABLE `guild_preferences` DROP COLUMN `ignored_roles`;--> statement-breakpoint
ALTER TABLE `guild_preferences` DROP COLUMN `confinement_role_id`;--> statement-breakpoint
ALTER TABLE `guild_preferences` DROP COLUMN `developer_role_id`;