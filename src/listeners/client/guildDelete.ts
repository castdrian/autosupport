import { ApplyOptions } from "@sapphire/decorators";
import { Listener, type ListenerOptions } from "@sapphire/framework";
import { deleteGuildSettings } from "@src/database/db";
import { getOpenAIClient } from "@utils/autosupport";
import { deleteKnowledgeBaseFile } from "@utils/fileManager";
import { Events, type Guild } from "discord.js";

@ApplyOptions<ListenerOptions>({ event: Events.GuildDelete })
export class GuildDeleteListener extends Listener {
	public async run(guild: Guild) {
		// Clean up the knowledge base first: it waits for any in-flight build
		// to settle before deleting resources, and that build can resurrect a
		// guild_preferences row via getOrCreateGuildSettings. Deleting the DB
		// row last ensures it removes whatever ends up existing, including any
		// such resurrection, instead of racing with it.
		try {
			await deleteKnowledgeBaseFile(guild.id, getOpenAIClient());
		} catch (error) {
			this.container.logger.error(
				`Failed to delete knowledge base for guild ${guild.id}: ${error}`,
			);
		}

		try {
			await deleteGuildSettings(guild.id);
		} catch (error) {
			this.container.logger.error(
				`Failed to delete guild settings for ${guild.id}: ${error}`,
			);
		}

		this.container.logger.info(
			`Cleaned up resources for removed guild ${guild.id}`,
		);
	}
}
