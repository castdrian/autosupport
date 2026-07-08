import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const guildPreferences = sqliteTable("guild_preferences", {
	id: text("id").primaryKey(),
	channelIds: text("channel_ids", { mode: "json" })
		.notNull()
		.default("[]")
		.$type<string[]>(),
	knowledgeBaseVectorStoreId: text("knowledge_base_vector_store_id"),
	knowledgeBaseHash: text("knowledge_base_hash"),
});

export const threadResponses = sqliteTable("thread_responses", {
	key: text("key").primaryKey(),
	guildId: text("guild_id").notNull(),
	threadId: text("thread_id").notNull(),
	responseId: text("response_id").notNull(),
});

export const escalatedThreads = sqliteTable("escalated_threads", {
	threadId: text("thread_id").primaryKey(),
	guildId: text("guild_id").notNull(),
});
