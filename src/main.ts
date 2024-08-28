import Database from "bun:sqlite";
import {
	ApplicationCommandRegistries,
	SapphireClient,
} from "@sapphire/framework";
import { config } from "@src/config";
import * as schema from "@src/database/schema";
import { DefaultWebSocketManagerOptions, GatewayIntentBits } from "discord.js";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const client = new SapphireClient({
	shards: "auto",
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

// @ts-expect-error just for fun
DefaultWebSocketManagerOptions.identifyProperties.browser = "Discord iOS";

const sqlite = new Database("autosupport.db");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: "./src/database/drizzle" });

ApplicationCommandRegistries.setDefaultGuildIds(
	config.devGuildId ? [config.devGuildId] : null,
);
await client.login();
