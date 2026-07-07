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

const databasePath = process.env.DATABASE_PATH ?? "autosupport.db";
const sqlite = new Database(databasePath);
sqlite.run("PRAGMA journal_mode = WAL;");
const db = drizzle(sqlite, { schema });

try {
	migrate(db, { migrationsFolder: "./src/database/drizzle" });
} catch (error) {
	console.error(`Failed to run database migrations against ${databasePath}:`);
	console.error(error);
	process.exit(1);
}

ApplicationCommandRegistries.setDefaultGuildIds(
	config.devGuildId ? [config.devGuildId] : null,
);

try {
	await client.login();
} catch (error) {
	console.error(
		"Failed to log in to Discord. Check that DISCORD_TOKEN is set and valid:",
	);
	console.error(error);
	process.exit(1);
}
