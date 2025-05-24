import { Listener } from "@sapphire/framework";
import { config } from "@src/config";
import { getOrCreateGuildSettings } from "@src/database/db";
import { getResponse } from "@utils/autosupport";
import type { Message } from "discord.js";

export class MessageListener extends Listener {
	public async run(message: Message) {
		if (!message.inGuild() || message.author.bot) return;
		const settings = await getOrCreateGuildSettings(message.guildId);
		if (!config.devGuildId && !settings.channelIds.includes(message.channelId))
			return;
		await getResponse(message);
	}
}
