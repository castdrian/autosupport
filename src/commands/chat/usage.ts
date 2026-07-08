import { Command } from "@sapphire/framework";
import { getOpenAIClient } from "@utils/autosupport";
import { StatusColor, statusContainer } from "@utils/statusMessage";
import { getUsageSummary } from "@utils/usage";
import {
	type ChatInputCommandInteraction,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";
import OpenAI from "openai";

export class UsageCommand extends Command {
	public override async chatInputRun(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const openai = getOpenAIClient();
			const usage = await getUsageSummary(openai);
			const currency = usage.currency.toUpperCase();

			await interaction.editReply({
				components: [
					statusContainer(
						StatusColor.Neutral,
						`**OpenAI Usage**\nToday: ${usage.todayUsd.toFixed(2)} ${currency}\nMonth to date: ${usage.monthToDateUsd.toFixed(2)} ${currency}`,
					),
				],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (error) {
			this.container.logger.error(`Failed to fetch OpenAI usage: ${error}`);

			const isAuthError =
				error instanceof OpenAI.APIError &&
				(error.status === 401 || error.status === 403);

			await interaction.editReply({
				components: [
					statusContainer(
						StatusColor.Danger,
						isAuthError
							? "Couldn't fetch usage data. Make sure OPEN_AI_ADMIN_API_KEY is set to an org admin key with the api.usage.read scope."
							: "Couldn't fetch usage data due to an unexpected error. Check the logs for details.",
					),
				],
				flags: MessageFlags.IsComponentsV2,
			});
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName("usage")
				.setDescription("check current OpenAI usage and cost")
				.setContexts(InteractionContextType.Guild)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		);
	}
}
