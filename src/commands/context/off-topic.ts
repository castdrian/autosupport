import { Command } from "@sapphire/framework";
import { config, responseCache } from "@src/config";
import { trainWitUtterance, witIntents } from "@utils/wit";
import {
	ActionRowBuilder,
	ApplicationCommandType,
	Message,
	type MessageComponentInteraction,
	type MessageContextMenuCommandInteraction,
	PermissionFlagsBits,
	StringSelectMenuBuilder,
} from "discord.js";

export class UtteranceCommand extends Command {
	public override async contextMenuRun(
		interaction: MessageContextMenuCommandInteraction,
	) {
		try {
			if (
				!interaction.isMessageContextMenuCommand &&
				!(interaction.targetMessage instanceof Message)
			)
				return;
			if (!interaction.inGuild() || !interaction.targetMessage.inGuild())
				return;
			if (!config.devGuildId && !responseCache.has(interaction.guildId)) return;

			await trainWitUtterance(
				interaction.targetMessage.content,
				config.witAiServerToken[interaction.targetMessage.guildId],
			);
			await interaction.reply({
				content:
					"Training intent classifier with selected message as off-topic utterance.",
				ephemeral: true,
			});
		} catch (ex) {
			this.container.logger.error(ex);
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerContextMenuCommand((builder) =>
			builder //
				.setName("Train phrase to be ignored")
				.setType(ApplicationCommandType.Message)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		);
	}
}
