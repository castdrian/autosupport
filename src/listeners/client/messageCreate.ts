import { getOrCreateGuildSettings } from "@src/database/db";
import { Listener } from "@sapphire/framework";
import { getResponse } from "@utils/autosupport";
import { config } from "@src/config";
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
