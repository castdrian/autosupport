import {
	ApplicationCommandRegistries,
	LogLevel,
	SapphireClient,
} from "@sapphire/framework";
import { config } from "@src/config";
import { db } from "@src/database/db";
import { ErrorReportingLogger } from "@utils/errorReportingLogger";
import { DefaultWebSocketManagerOptions, GatewayIntentBits } from "discord.js";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

const client = new SapphireClient({
	shards: "auto",
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
	logger: {
		instance: new ErrorReportingLogger(LogLevel.Info, config.errorWebhookUrl),
	},
});

// @ts-expect-error just for fun
DefaultWebSocketManagerOptions.identifyProperties.browser = "Discord iOS";

try {
	migrate(db, { migrationsFolder: "./src/database/drizzle" });
} catch (error) {
	console.error(
		`Failed to run database migrations against ${process.env.DATABASE_PATH ?? "autosupport.db"}:`,
	);
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
