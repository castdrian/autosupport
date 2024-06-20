import { Command } from "@sapphire/framework";
import { config, responseCache } from "@src/config";
import { witIntents } from "@utils/wit";
import {
	ActionRowBuilder,
	ApplicationCommandType,
	Collection,
	Message,
	type MessageComponentInteraction,
	type MessageContextMenuCommandInteraction,
	StringSelectMenuBuilder,
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
			if (!interaction.inGuild() || !interaction.targetMessage.inGuild()) return;
			if (!config.devGuildId && !responseCache.has(interaction.guildId)) return;

			const intents = await witIntents(config.witAiServerToken[interaction.targetMessage.guildId]);

			const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				new StringSelectMenuBuilder().setCustomId("select_response").addOptions(
					intents.map((intent) => ({
						label: intent.name,
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
					time: 10_000,
				});
				if (!confirmation.isStringSelectMenu()) return await res.delete();

				if (confirmation.customId === "select_response") {
					const intent = intents.find(
						(intent) => intent.name === confirmation.values[0],
					);
					if (!intent) return await res.delete();
					await res.delete();
					if (!interaction.inCachedGuild()) return;

					let responseContent = '';
					const aggregatedResponses = new Collection<string, string>();

					if (config.devGuildId) {
						for (const [, guildResponses] of responseCache) {
							if (guildResponses) {
								for (const [key, value] of guildResponses) {
									aggregatedResponses.set(key, value);
								}
							}
						}

						responseContent = aggregatedResponses.get(intent.name) ?? '';
					} else {
						const guildResponses = responseCache.get(interaction.guildId);
						if (guildResponses) {
							responseContent = guildResponses.get(intent.name) ?? '';
						}
					}

					await interaction.targetMessage.reply({
						content: `${responseContent?.trim()}\n-# sent manually by ${interaction.user}`,
						allowedMentions: { repliedUser: true },
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
				.setName("Send Response")
				.setType(ApplicationCommandType.Message),
		);
	}
}
