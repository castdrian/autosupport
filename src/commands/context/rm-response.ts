import { Command } from "@sapphire/framework";
import { config, responseCache } from "@src/config";
import {
	ApplicationCommandType,
	Message,
	type MessageContextMenuCommandInteraction,
} from "discord.js";

export class ResponseCommand extends Command {
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
			if (
				interaction.targetMessage.author.id !== this.container.client.user?.id
			)
				return interaction.reply({
					content: "You can only delete autosupport responses",
					ephemeral: true,
				});
			if (!interaction.targetMessage.deletable)
				return interaction.reply({
					content:
						"autosupport does not have permission to delete messages in this channel",
					ephemeral: true,
				});

			await interaction.targetMessage.delete();
			await interaction.reply({ content: "Response deleted", ephemeral: true });
		} catch (ex) {
			this.container.logger.error(ex);
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerContextMenuCommand((builder) =>
			builder //
				.setName("Delete Response")
				.setType(ApplicationCommandType.Message),
		);
	}
}
