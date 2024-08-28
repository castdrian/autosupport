import { Command, Listener } from "@sapphire/framework";
import { config, responseCache } from "@src/config";
import { getDeveloperRoleId } from "@src/database/db";
import {
	ActionRowBuilder,
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	type ChatInputCommandInteraction,
	type MessageComponentInteraction,
} from "discord.js";

export class DeveloperCategoryAccessGrantCommand extends Command {
	public override async chatInputRun(interaction: ChatInputCommandInteraction) {
		try {
			if (!interaction.inCachedGuild()) return;
			if (!config.devGuildId && !responseCache.has(interaction.guildId)) return;

			const developerRoleId = await getDeveloperRoleId(interaction.guildId);
			if (!developerRoleId) {
				await interaction.reply({
					content: "Developer role not configured for this guild.",
					ephemeral: true,
				});
				return;
			}

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel("Grant Access")
					.setStyle(ButtonStyle.Primary)
					.setCustomId("grant_access"),
			);

			const reply = await interaction.reply({
				content:
					"By clicking the 'Grant Access' button, you will gain access to the development category.\nBy doing so, you agree not to misuse this category and to use the support channel when necessary.",
				components: [row],
				ephemeral: true,
			});

			const collectorFilter = (i: MessageComponentInteraction) =>
				i.customId === "grant_access" && i.user.id === interaction.user.id;

			try {
				const confirmation = await reply.awaitMessageComponent({
					filter: collectorFilter,
					time: 20_000,
				});

				if (confirmation.customId === "grant_access") {
					await interaction.member.roles.add(
						developerRoleId,
						"user self-requested access to development category",
					);
					await interaction.editReply({
						content:
							"You have been granted access to the development category.",
						components: [],
					});
				}
			} catch (e) {
				await interaction.editReply({ components: [] });
			}
		} catch (ex) {
			this.container.logger.error(ex);
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName("development-access")
				.setDescription("grants access to the development category"),
		);
	}
}
