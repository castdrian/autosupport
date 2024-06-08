import { Listener } from "@sapphire/framework";
import { getResponse } from "@src/autosupport";
import { config, responseCache } from "@src/config";
import type { Message } from "discord.js";

export class MessageListener extends Listener {
	public async run(message: Message) {
		if (!message.inGuild()) return;
		if (message.author.bot) return;
		if (!config.devGuildId && !responseCache.has(message.guildId)) return;
		if (!config.devGuildId && !responseCache.get(message.guildId)?.channelIds?.includes(message.channelId)) return;
		await getResponse(message);
	}
}
