import { getGuildSettingsIfExists } from "@src/database/db";
import type { Client } from "discord.js";
import { SnowflakeUtil } from "discord.js";

const STALE_THREAD_INACTIVITY_MS = 24 * 60 * 60 * 1000;

function lastActivityTimestamp(thread: {
	lastMessageId: string | null;
	createdTimestamp: number | null;
}): number {
	if (thread.lastMessageId) {
		return Number(SnowflakeUtil.timestampFrom(thread.lastMessageId));
	}
	return thread.createdTimestamp ?? 0;
}

export async function sweepStaleThreads(client: Client<true>): Promise<void> {
	for (const guild of client.guilds.cache.values()) {
		const settings = await getGuildSettingsIfExists(guild.id);
		if (!settings?.channelIds.length) continue;

		for (const channelId of settings.channelIds) {
			const channel = await guild.channels.fetch(channelId).catch(() => null);
			if (!channel?.isThreadOnly()) continue;

			const active = await channel.threads.fetchActive().catch(() => null);
			if (!active) continue;

			for (const thread of active.threads.values()) {
				if (thread.archived || thread.locked) continue;

				const inactiveFor = Date.now() - lastActivityTimestamp(thread);
				if (inactiveFor < STALE_THREAD_INACTIVITY_MS) continue;

				await thread
					.setArchived(true, "Inactive support thread")
					.catch(() => null);
			}
		}
	}
}
