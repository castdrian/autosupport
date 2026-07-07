import { Database } from "bun:sqlite";
import * as schema from "@src/database/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

const sqlite = new Database("autosupport.db");
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
