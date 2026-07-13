import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import { MissingGithubTokenError } from "@utils/githubCommit";
import { deleteSupportEntry, getSupportEntries } from "@utils/knowledgeBase";
import {
	buildListView,
	KB_DELETE_CANCEL_ID,
	KB_DELETE_CONFIRM_PREFIX,
	KB_LIST_PREFIX,
	parseIndexCustomId,
	resultMessage,
} from "@utils/knowledgeBaseUi";
import { StatusColor, statusContainer } from "@utils/statusMessage";
import { type ButtonInteraction, PermissionFlagsBits } from "discord.js";

export class KnowledgeBaseButtonHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		});
	}

	public override async run(
		interaction: ButtonInteraction,
		result: { kind: "list" | "delete" | "cancel"; index: number },
	) {
		if (!interaction.guildId) return;

		if (result.kind === "cancel") {
			await interaction.update({
				components: [
					statusContainer(StatusColor.Neutral, "Deletion cancelled."),
				],
			});
			return;
		}

		if (result.kind === "list") {
			const entries = getSupportEntries(interaction.guildId);
			await interaction.update({
				components: buildListView(entries, result.index),
			});
			return;
		}

		await interaction.deferUpdate();
		try {
			const { knowledgeBaseRefreshed } = await deleteSupportEntry(
				interaction.guildId,
				result.index,
			);
			const message = resultMessage(
				knowledgeBaseRefreshed,
				"Entry deleted and knowledge base updated.",
			);
			await interaction.editReply({
				components: [statusContainer(message.color, message.content)],
			});
		} catch (error) {
			await this.replyWithError(interaction, error, "delete");
		}
	}

	private async replyWithError(
		interaction: ButtonInteraction,
		error: unknown,
		action: string,
	) {
		this.container.logger.error(
			`Failed to ${action} knowledge base entry: ${error}`,
		);
		const content =
			error instanceof MissingGithubTokenError
				? "No GitHub token is configured, so I can't persist knowledge base changes. Set the GitHub token and try again."
				: "Sorry, something went wrong saving that change. Please try again.";
		await interaction
			.editReply({
				components: [statusContainer(StatusColor.Danger, content)],
			})
			.catch(() => null);
	}

	public override parse(interaction: ButtonInteraction) {
		if (!interaction.guildId) return this.none();
		if (
			!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
		) {
			return this.none();
		}

		if (interaction.customId === KB_DELETE_CANCEL_ID) {
			return this.some({ kind: "cancel", index: -1 } as const);
		}

		const listIndex = parseIndexCustomId(interaction.customId, KB_LIST_PREFIX);
		if (listIndex !== undefined) {
			return this.some({ kind: "list", index: listIndex } as const);
		}

		const deleteIndex = parseIndexCustomId(
			interaction.customId,
			KB_DELETE_CONFIRM_PREFIX,
		);
		if (deleteIndex !== undefined) {
			return this.some({ kind: "delete", index: deleteIndex } as const);
		}

		return this.none();
	}
}
