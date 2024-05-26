import { Listener } from "@sapphire/framework";
import { getResponse } from "@src/autosupport";
import { config } from "@src/config";
import type { Message } from "discord.js";

export class MessageListener extends Listener {
	public async run(message: Message) {
		if (message.guildId !== config.guildId) return;
		if (message.channelId !== config.channelId) return;
		if (message.author.bot) return;
		if (!message.content.length) return;

		const response = await getResponse(message);
		if (!response) return;

		await message.reply({
			content: response,
			allowedMentions: { repliedUser: true },
		});
	}
}
