import { getResponse } from '#src/autosupport';
import { Listener } from '@sapphire/framework';
import { Message } from 'discord.js';

const { GUILD_ID, CHANNEL_ID } = process.env;

export class MessageListener extends Listener {
	public async run(message: Message) {
		if (message.guildId !== GUILD_ID) return;
		if (message.channelId !== CHANNEL_ID) return;
		if (message.author.bot) return;
		if (!message.content.length) return;

		const response = await getResponse(message);
		if (!response) return;

		await message.reply({ content: response, allowedMentions: { repliedUser: true } });
	}
}
