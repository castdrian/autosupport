import { GatewayIntentBits } from 'discord.js';
import { ApplicationCommandRegistries, SapphireClient } from '@sapphire/framework';
import { config } from '@src/config';

const client = new SapphireClient({
	shards: 'auto',
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

ApplicationCommandRegistries.setDefaultGuildIds([config.guildId]);

await client.login();
