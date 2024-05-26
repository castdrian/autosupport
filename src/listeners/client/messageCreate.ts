import { getResponse } from '@src/autosupport';
import { Listener } from '@sapphire/framework';
import { Message } from 'discord.js';
import { config } from '@src/config';

export class MessageListener extends Listener {
	public async run(message: Message) {
		if (message.guildId !== config.guildId) return;
		if (message.channelId !== config.channelId) return;
		if (message.author.bot) return;
		if (!message.content.length) return;

		const response = await getResponse(message);
		if (!response) return;

		await message.reply({ content: response, allowedMentions: { repliedUser: true } });
	}
}
