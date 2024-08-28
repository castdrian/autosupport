import { getResponseContent } from "@root/src/utils/autosupport";
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

			const intents = await witIntents(
				config.witAiServerToken[interaction.targetMessage.guildId],
			);

			const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				new StringSelectMenuBuilder().setCustomId("select_intent").addOptions(
					intents.map((intent) => ({
						label: intent.name,
						description: getResponseContent(
							intent.name,
							interaction.guildId,
						)?.slice(0, 100),
						value: intent.name,
					})),
				),
			);

			const res = await interaction.reply({
				components: [row],
				ephemeral: true,
			});

			const collectorFilter = (i: MessageComponentInteraction) =>
				i.user.id === interaction.user.id;
			try {
				const confirmation = await res.awaitMessageComponent({
					filter: collectorFilter,
					time: 20_000,
				});
				if (!confirmation.isStringSelectMenu()) return await res.delete();

				if (confirmation.customId === "select_intent") {
					const intent = intents.find(
						(intent) => intent.name === confirmation.values[0],
					);
					if (!intent) return await res.delete();

					await trainWitUtterance(
						interaction.targetMessage.content,
						config.witAiServerToken[interaction.targetMessage.guildId],
						intent.name,
					);
					await confirmation.update({
						content: "Training intent classifier with selected message.",
						components: [],
					});
				}
			} catch (ex) {
				await res.delete();
			}
		} catch (ex) {
			this.container.logger.error(ex);
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerContextMenuCommand((builder) =>
			builder //
				.setName("Train Phrase")
				.setType(ApplicationCommandType.Message)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		);
	}
}
