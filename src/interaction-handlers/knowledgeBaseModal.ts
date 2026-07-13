import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import { MissingGithubTokenError } from "@utils/githubCommit";
import {
	addSupportEntry,
	type SupportEntryInput,
	updateSupportEntry,
} from "@utils/knowledgeBase";
import {
	KB_ADD_MODAL_ID,
	KB_EDIT_MODAL_PREFIX,
	KB_FIELD_NOTES,
	KB_FIELD_PROBLEM,
	KB_FIELD_SOLUTION,
	parseIndexCustomId,
	resultMessage,
} from "@utils/knowledgeBaseUi";
import { StatusColor, statusContainer } from "@utils/statusMessage";
import {
	MessageFlags,
	type ModalSubmitInteraction,
	PermissionFlagsBits,
} from "discord.js";

export class KnowledgeBaseModalHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
		});
	}

	public override async run(
		interaction: ModalSubmitInteraction,
		result: { index?: number },
	) {
		if (!interaction.guildId) return;

		const input: SupportEntryInput = {
			problem: interaction.fields.getTextInputValue(KB_FIELD_PROBLEM),
			solution: interaction.fields.getTextInputValue(KB_FIELD_SOLUTION),
			notes: interaction.fields.getTextInputValue(KB_FIELD_NOTES),
		};

		if (!input.problem.trim() || !input.solution.trim()) {
			await interaction.reply({
				components: [
					statusContainer(
						StatusColor.Danger,
						"Both the problem and the solution are required.",
					),
				],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
			return;
		}

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			const isEdit = result.index !== undefined;
			const { knowledgeBaseRefreshed } = isEdit
				? await updateSupportEntry(interaction.guildId, result.index!, input)
				: await addSupportEntry(interaction.guildId, input);

			const message = resultMessage(
				knowledgeBaseRefreshed,
				isEdit
					? "Entry updated and knowledge base updated."
					: "Entry added and knowledge base updated.",
			);
			await interaction.editReply({
				components: [statusContainer(message.color, message.content)],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (error) {
			this.container.logger.error(
				`Failed to save knowledge base entry: ${error}`,
			);
			const content =
				error instanceof MissingGithubTokenError
					? "No GitHub token is configured, so I can't persist knowledge base changes. Set the GitHub token and try again."
					: error instanceof RangeError
						? "That knowledge base entry no longer exists — it may have been changed or removed."
						: "Sorry, something went wrong saving that entry. Please try again.";
			await interaction
				.editReply({
					components: [statusContainer(StatusColor.Danger, content)],
					flags: MessageFlags.IsComponentsV2,
				})
				.catch(() => null);
		}
	}

	public override parse(interaction: ModalSubmitInteraction) {
		if (!interaction.guildId) return this.none();
		if (
			!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)
		) {
			return this.none();
		}

		if (interaction.customId === KB_ADD_MODAL_ID) {
			return this.some({});
		}

		const editIndex = parseIndexCustomId(
			interaction.customId,
			KB_EDIT_MODAL_PREFIX,
		);
		if (editIndex !== undefined) {
			return this.some({ index: editIndex });
		}

		return this.none();
	}
}
