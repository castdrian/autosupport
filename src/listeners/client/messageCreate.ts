import { Listener } from "@sapphire/framework";
import { getResponse } from "@src/autosupport";
import { config, responseCache } from "@src/config";
import type { Message } from "discord.js";

export class MessageListener extends Listener {
	public async run(message: Message) {
		if (!message.inGuild() || message.author.bot) return;
		if (!config.devGuildId && !responseCache.get(message.guildId)?.channelIds?.includes(message.channelId)) return;
		if (responseCache.get(message.guildId)?.ignoreReplies && message.reference) return;
		if (message.member?.roles.cache.some((role) => responseCache.get(message.guildId)?.ignoredRoles?.includes(role.id))) return;
		await getResponse(message);
	}
}
