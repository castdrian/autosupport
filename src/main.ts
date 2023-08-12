import { config } from 'dotenv';
import { GatewayIntentBits } from 'discord.js';
import { LogLevel, SapphireClient } from '@sapphire/framework';
import '@sapphire/plugin-logger/register';

config();

const client = new SapphireClient({
	shards: 'auto',
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
	logger: {
		level: LogLevel.Debug
	}
});

if (!process.env.DISCORD_TOKEN) process.exit(0);

await client.login();
