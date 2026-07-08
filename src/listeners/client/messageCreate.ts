import { Listener } from "@sapphire/framework";
import { config } from "@src/config";
import { getGuildSettingsIfExists } from "@src/database/db";
import { getResponse } from "@utils/autosupport";
import type { Message } from "discord.js";

export class MessageListener extends Listener {
	public async run(message: Message) {
		if (!message.inGuild() || message.author.bot) return;
		if (!message.channel.isThread()) return;
		if (!config.devGuildId && message.channel.parentId) {
			const settings = await getGuildSettingsIfExists(message.guildId);
			if (!settings?.channelIds.includes(message.channel.parentId)) return;
		}
		await getResponse(message);
	}
}
