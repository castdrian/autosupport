import { Database } from 'bun:sqlite';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';

import * as schema from '@src/database/schema';

const sqlite = new Database('autosupport.db');
export const db = drizzle(sqlite, { schema });

export type GuildSettings = typeof schema.guildPreferences.$inferSelect;
export type Inmate = typeof schema.inmates.$inferSelect;

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
		minimumConfidence: 0.80,
		ignoreReplies: true,
		channelIds: [],
		ignoredRoles: [],
		confinementRoleId: null,
	};

	const createdSettings = await db.insert(schema.guildPreferences).values(newSettings).returning();
	return createdSettings[0];
}

export async function updateGuildSettings(guildId: string, newSettings: Partial<GuildSettings>) {
	await db.update(schema.guildPreferences).set(newSettings).where(eq(schema.guildPreferences.id, guildId)).returning();
	return getOrCreateGuildSettings(guildId);
}

export async function getMinimumConfidence(guildId: string) {
	const settings = await getOrCreateGuildSettings(guildId);
	return settings.minimumConfidence;
}

export async function setMinimumConfidence(guildId: string, minimumConfidence: number) {
	return updateGuildSettings(guildId, { minimumConfidence });
}

export async function setIgnoreReplies(guildId: string, ignoreReplies: boolean) {
	return updateGuildSettings(guildId, { ignoreReplies });
}

export async function addSupportChannelId(guildId: string, channelId: string) {
	const settings = await getOrCreateGuildSettings(guildId);
	const channelIds = [...settings.channelIds, channelId];
	return updateGuildSettings(guildId, { channelIds });
}

export async function removeSupportChannelId(guildId: string, channelId: string) {
	const settings = await getOrCreateGuildSettings(guildId);
	const channelIds = settings.channelIds.filter((id) => id !== channelId);
	return updateGuildSettings(guildId, { channelIds });
}

export async function addIgnoredRoleId(guildId: string, roleId: string) {
	const settings = await getOrCreateGuildSettings(guildId);
	const ignoredRoles = [...settings.ignoredRoles, roleId];
	return updateGuildSettings(guildId, { ignoredRoles });
}

export async function removeIgnoredRoleId(guildId: string, roleId: string) {
	const settings = await getOrCreateGuildSettings(guildId);
	const ignoredRoles = settings.ignoredRoles.filter((id) => id !== roleId);
	return updateGuildSettings(guildId, { ignoredRoles });
}

export async function getConfinementRoleId(guildId: string) {
	const settings = await getOrCreateGuildSettings(guildId);
	return settings.confinementRoleId;
}

export async function setConfinementRoleId(guildId: string, confinementRoleId: string) {
	return updateGuildSettings(guildId, { confinementRoleId });
}

export async function clearConfinementRoleId(guildId: string) {
	return updateGuildSettings(guildId, { confinementRoleId: null });
}

export async function getInmates() {
	const inmates = await db
		.select()
		.from(schema.inmates)

	return inmates;
}

export async function addInmate(inmate: Inmate) {
	const createdInmate = await db.insert(schema.inmates).values(inmate).returning();
	return createdInmate[0];
}

export async function removeInmate(inmateId: string) {
	await db.delete(schema.inmates).where(eq(schema.inmates.id, inmateId));
}