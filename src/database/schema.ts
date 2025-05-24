import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guildPreferences = sqliteTable("guild_preferences", {
	id: text("id").primaryKey(),
	channelIds: text("channel_ids", { mode: "json" })
		.notNull()
		.default("[]")
		.$type<string[]>(),
});
