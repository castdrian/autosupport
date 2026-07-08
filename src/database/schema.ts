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

// Tracks OpenAI response continuity per user, per thread, so conversations
// survive a restart. Keyed the same way the in-memory cache used to be:
// `${guildId}-${userId}-${threadId}`.
export const threadResponses = sqliteTable("thread_responses", {
	key: text("key").primaryKey(),
	guildId: text("guild_id").notNull(),
	threadId: text("thread_id").notNull(),
	responseId: text("response_id").notNull(),
});

// Tracks which threads have requested human assistance (AI responses
// disabled) so escalation survives a restart.
export const escalatedThreads = sqliteTable("escalated_threads", {
	threadId: text("thread_id").primaryKey(),
	guildId: text("guild_id").notNull(),
});
