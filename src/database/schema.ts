import { integer, real, sqliteTable, text} from 'drizzle-orm/sqlite-core';

export const guildPreferences = sqliteTable('guild_preferences', {
	id: text('id').primaryKey(),
	minimumConfidence: real('minimum_confidence').notNull().default(0.80),
	ignoreReplies: integer('ignore_replies', { mode: 'boolean' }).notNull().default(true),
	channelIds: text('channel_ids', { mode: 'json' }).notNull().default('[]').$type<string[]>(),
	ignoredRoles: text('ignored_roles', { mode: 'json' }).notNull().default('[]').$type<string[]>(),
	confinementRoleId: text('confinement_role_id'),
});

export const inmates = sqliteTable('inmates', {
	id: text('id').primaryKey(),
	guildId: text('guild_id').notNull(),
	confinementRoleId: text('confinement_role_id').notNull(),
	releaseDate: integer('release_date', { mode: 'timestamp' }).notNull(),
});