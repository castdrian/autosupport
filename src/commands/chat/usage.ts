import { Command } from "@sapphire/framework";
import { getOpenAIClient } from "@utils/autosupport";
import { getUsageSummary } from "@utils/usage";
import {
	type ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	TextDisplayBuilder,
} from "discord.js";

export class UsageCommand extends Command {
	public override async chatInputRun(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const openai = getOpenAIClient();
			const usage = await getUsageSummary(openai);
			const currency = usage.currency.toUpperCase();

			const text = new TextDisplayBuilder().setContent(
				`**OpenAI Usage**\nToday: ${usage.todayUsd.toFixed(2)} ${currency}\nMonth to date: ${usage.monthToDateUsd.toFixed(2)} ${currency}`,
			);

			await interaction.editReply({
				components: [text],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (error) {
			this.container.logger.error(`Failed to fetch OpenAI usage: ${error}`);
			await interaction.editReply({
				content:
					"Couldn't fetch usage data. Make sure the configured OpenAI API key has organization admin access.",
			});
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName("usage")
				.setDescription("check current OpenAI usage and cost")
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		);
	}
}
