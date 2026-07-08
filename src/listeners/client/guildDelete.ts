import { ApplyOptions } from "@sapphire/decorators";
import { Listener, type ListenerOptions } from "@sapphire/framework";
import {
	deleteEscalatedThreadsForGuild,
	deleteGuildSettings,
	deleteThreadResponsesForGuild,
} from "@src/database/db";
import { getOpenAIClient } from "@utils/autosupport";
import { deleteKnowledgeBaseFile } from "@utils/fileManager";
import { Events, type Guild } from "discord.js";

@ApplyOptions<ListenerOptions>({ event: Events.GuildDelete })
export class GuildDeleteListener extends Listener {
	public async run(guild: Guild) {
		try {
			await deleteKnowledgeBaseFile(guild.id, getOpenAIClient());
		} catch (error) {
			this.container.logger.error(
				`Failed to delete knowledge base for guild ${guild.id}: ${error}`,
			);
		}

		try {
			await deleteGuildSettings(guild.id);
			await deleteThreadResponsesForGuild(guild.id);
			await deleteEscalatedThreadsForGuild(guild.id);
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
