import { ApplyOptions } from "@sapphire/decorators";
import { Listener, type ListenerOptions } from "@sapphire/framework";
import {
	clearThreadEscalated,
	deleteThreadResponsesForThread,
	getGuildSettingsIfExists,
	removeSupportChannelId,
} from "@src/database/db";
import {
	type DMChannel,
	Events,
	type NonThreadGuildBasedChannel,
} from "discord.js";

@ApplyOptions<ListenerOptions>({ event: Events.ChannelDelete })
export class ChannelDeleteListener extends Listener {
	public async run(channel: DMChannel | NonThreadGuildBasedChannel) {
		if (!channel.isThreadOnly()) return;

		try {
			const settings = await getGuildSettingsIfExists(channel.guildId);
			if (settings?.channelIds.includes(channel.id)) {
				await removeSupportChannelId(channel.guildId, channel.id);
			}
		} catch (error) {
			this.container.logger.error(
				`Failed to remove deleted channel ${channel.id} from guild ${channel.guildId} settings: ${error}`,
			);
		}

		const orphanedThreads = channel.client.channels.cache.filter(
			(cached) => cached.isThread() && cached.parentId === channel.id,
		);

		await Promise.all(
			[...orphanedThreads.values()].map((thread) =>
				Promise.all([
					clearThreadEscalated(thread.id),
					deleteThreadResponsesForThread(thread.id),
				]).catch((error) =>
					this.container.logger.error(
						`Failed to clean up thread state for ${thread.id} after parent channel ${channel.id} was deleted: ${error}`,
					),
				),
			),
		);
	}
}
