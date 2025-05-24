import { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sqlite";

import * as schema from "@src/database/schema";

const sqlite = new Database("autosupport.db");
export const db = drizzle(sqlite, { schema });

export type GuildSettings = typeof schema.guildPreferences.$inferSelect;

export async function getOrCreateGuildSettings(guildId: string) {
	const existingSettings = await db
		.select()
		.from(schema.guildPreferences)
		.where(eq(schema.guildPreferences.id, guildId))
		.limit(1);

	if (existingSettings.length > 0) {
		return existingSettings[0];
	}

	const newSettings: GuildSettings = {
		id: guildId,
		channelIds: [],
	};

	const createdSettings = await db
		.insert(schema.guildPreferences)
		.values(newSettings)
		.returning();
	return createdSettings[0];
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
