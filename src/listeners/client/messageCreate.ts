import { getOrCreateGuildSettings } from "@root/src/database/db";
import { Listener } from "@sapphire/framework";
import { getResponse } from "@src/autosupport";
import { config, responseCache } from "@src/config";
import type { Message } from "discord.js";

export class MessageListener extends Listener {
	public async run(message: Message) {
		if (!message.inGuild() || message.author.bot) return;
		const settings = await getOrCreateGuildSettings(message.guildId);
		if (!config.devGuildId && !settings.channelIds.includes(message.channelId)) return;
		if (settings.ignoreReplies && message.reference) return;
		if (message.member?.roles.cache.some((role) => settings.ignoredRoles.includes(role.id))) return;
		await getResponse(message);
	}
}
