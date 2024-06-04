import {
	ApplicationCommandRegistries,
	SapphireClient,
} from "@sapphire/framework";
import { config, responseCache } from "@src/config";
import { GatewayIntentBits } from "discord.js";

const client = new SapphireClient({
	shards: "auto",
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

ApplicationCommandRegistries.setDefaultGuildIds(config.devGuildId ? [config.devGuildId] : Array.from(responseCache.keys()));

await client.login();
