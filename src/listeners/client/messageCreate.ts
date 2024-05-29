import { Listener } from "@sapphire/framework";
import { getResponse } from "@src/autosupport";
import { config } from "@src/config";
import type { Message } from "discord.js";

export class MessageListener extends Listener {
	public async run(message: Message) {
		if (message.guildId !== config.guildId) return;
		if (message.channelId !== config.channelId) return;
		if (message.author.bot) return;
		await getResponse(message);
	}
}
