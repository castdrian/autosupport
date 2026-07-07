import { Database } from "bun:sqlite";
import * as schema from "@src/database/schema";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

const sqlite = new Database("autosupport.db");
sqlite.run("PRAGMA journal_mode = WAL;");
export const db = drizzle(sqlite, { schema });

export type GuildSettings = typeof schema.guildPreferences.$inferSelect;

export async function getOrCreateGuildSettings(guildId: string) {
	const newSettings: GuildSettings = {
		id: guildId,
		channelIds: [],
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
