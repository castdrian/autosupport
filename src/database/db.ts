import { Database } from "bun:sqlite";
import * as schema from "@src/database/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

const sqlite = new Database(process.env.DATABASE_PATH ?? "autosupport.db");
sqlite.run("PRAGMA journal_mode = WAL;");
export const db = drizzle(sqlite, { schema });

export type GuildSettings = typeof schema.guildPreferences.$inferSelect;

// Read-only lookup that never creates a row. Use this over
// getOrCreateGuildSettings when the caller only needs to check existing
// settings (e.g. a periodic sweep across every guild) and shouldn't pay for
// an insert attempt — or leave behind a row — for guilds that never
// configured anything.
export async function getGuildSettingsIfExists(
	guildId: string,
): Promise<GuildSettings | undefined> {
	const [settings] = await db
		.select()
		.from(schema.guildPreferences)
		.where(eq(schema.guildPreferences.id, guildId))
		.limit(1);
	return settings;
}

export async function getOrCreateGuildSettings(guildId: string) {
	const newSettings: GuildSettings = {
		id: guildId,
		channelIds: [],
		knowledgeBaseVectorStoreId: null,
		knowledgeBaseHash: null,
	};

	await db
		.insert(schema.guildPreferences)
		.values(newSettings)
		.onConflictDoNothing();

	const [settings] = await db
		.select()
		.from(schema.guildPreferences)
		.where(eq(schema.guildPreferences.id, guildId))
		.limit(1);

	return settings;
}

export async function updateGuildSettings(
	guildId: string,
	newSettings: Partial<GuildSettings>,
) {
	// Ensure a row exists first — updating a guild with no row yet would
	// otherwise silently affect zero rows, and the fallback read below would
	// then return freshly-created defaults instead of the intended update.
	await getOrCreateGuildSettings(guildId);
	await db
		.update(schema.guildPreferences)
		.set(newSettings)
		.where(eq(schema.guildPreferences.id, guildId))
		.returning();
	return getOrCreateGuildSettings(guildId);
}

export async function addSupportChannelId(guildId: string, channelId: string) {
	const settings = await getOrCreateGuildSettings(guildId);
	if (settings.channelIds.includes(channelId)) return settings;
	const channelIds = [...settings.channelIds, channelId];
	return updateGuildSettings(guildId, { channelIds });
}

export async function removeSupportChannelId(
	guildId: string,
	channelId: string,
) {
	const settings = await getOrCreateGuildSettings(guildId);
	const channelIds = settings.channelIds.filter((id) => id !== channelId);
	return updateGuildSettings(guildId, { channelIds });
}

export async function deleteGuildSettings(guildId: string) {
	await db
		.delete(schema.guildPreferences)
		.where(eq(schema.guildPreferences.id, guildId));
}

export interface KnowledgeBaseState {
	vectorStoreId: string;
	contentHash: string;
}

export async function getKnowledgeBaseState(
	guildId: string,
): Promise<KnowledgeBaseState | undefined> {
	const settings = await getOrCreateGuildSettings(guildId);
	if (!settings.knowledgeBaseVectorStoreId || !settings.knowledgeBaseHash) {
		return undefined;
	}
	return {
		vectorStoreId: settings.knowledgeBaseVectorStoreId,
		contentHash: settings.knowledgeBaseHash,
	};
}

export async function setKnowledgeBaseState(
	guildId: string,
	state: KnowledgeBaseState,
) {
	await updateGuildSettings(guildId, {
		knowledgeBaseVectorStoreId: state.vectorStoreId,
		knowledgeBaseHash: state.contentHash,
	});
}

export async function clearKnowledgeBaseState(guildId: string) {
	await updateGuildSettings(guildId, {
		knowledgeBaseVectorStoreId: null,
		knowledgeBaseHash: null,
	});
}

function threadResponseKey(
	guildId: string,
	userId: string,
	threadId: string,
): string {
	return `${guildId}-${userId}-${threadId}`;
}

export async function getThreadResponseId(
	guildId: string,
	userId: string,
	threadId: string,
): Promise<string | undefined> {
	const [row] = await db
		.select()
		.from(schema.threadResponses)
		.where(
			eq(
				schema.threadResponses.key,
				threadResponseKey(guildId, userId, threadId),
			),
		)
		.limit(1);
	return row?.responseId;
}

export async function setThreadResponseId(
	guildId: string,
	userId: string,
	threadId: string,
	responseId: string,
): Promise<void> {
	const key = threadResponseKey(guildId, userId, threadId);
	await db
		.insert(schema.threadResponses)
		.values({ key, guildId, threadId, responseId })
		.onConflictDoUpdate({
			target: schema.threadResponses.key,
			set: { responseId },
		});
}

export async function deleteThreadResponsesForThread(
	threadId: string,
): Promise<void> {
	await db
		.delete(schema.threadResponses)
		.where(eq(schema.threadResponses.threadId, threadId));
}

export async function deleteThreadResponsesForGuild(
	guildId: string,
): Promise<void> {
	await db
		.delete(schema.threadResponses)
		.where(eq(schema.threadResponses.guildId, guildId));
}

export async function isThreadEscalated(threadId: string): Promise<boolean> {
	const [row] = await db
		.select()
		.from(schema.escalatedThreads)
		.where(eq(schema.escalatedThreads.threadId, threadId))
		.limit(1);
	return Boolean(row);
}

export async function setThreadEscalated(
	guildId: string,
	threadId: string,
): Promise<void> {
	await db
		.insert(schema.escalatedThreads)
		.values({ threadId, guildId })
		.onConflictDoNothing();
}

export async function clearThreadEscalated(threadId: string): Promise<void> {
	await db
		.delete(schema.escalatedThreads)
		.where(eq(schema.escalatedThreads.threadId, threadId));
}

export async function deleteEscalatedThreadsForGuild(
	guildId: string,
): Promise<void> {
	await db
		.delete(schema.escalatedThreads)
		.where(eq(schema.escalatedThreads.guildId, guildId));
}

export async function countEscalatedThreadsForGuild(
	guildId: string,
): Promise<number> {
	const rows = await db
		.select()
		.from(schema.escalatedThreads)
		.where(eq(schema.escalatedThreads.guildId, guildId));
	return rows.length;
}
