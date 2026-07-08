import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import {
	canManageThread,
	REQUEST_HUMAN_MODAL_ID,
	REQUEST_HUMAN_REASON_FIELD_ID,
} from "@src/interaction-handlers/buttons";
import { addHumanAssistanceThread } from "@utils/autosupport";
import { StatusColor, statusContainer } from "@utils/statusMessage";
import {
	ButtonBuilder,
	ButtonStyle,
	MessageFlags,
	type ModalSubmitInteraction,
	PermissionFlagsBits,
	SectionBuilder,
	TextDisplayBuilder,
} from "discord.js";

export class RequestHumanModalHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.ModalSubmit,
		});
	}

	public override async run(interaction: ModalSubmitInteraction) {
		if (!interaction.guildId) return;
		const thread = interaction.channel;
		if (!thread?.isThread()) return;
		if (!thread.parent?.isThreadOnly()) return;

		// Re-check everything: time has passed since the button was clicked and
		// showModal() was awaited, so the thread's state could have changed —
		// e.g. someone else already requested human help in the meantime.
		if (!canManageThread(interaction, thread)) {
			await interaction.reply({
				components: [
					statusContainer(
						StatusColor.Danger,
						"Only the person who started this thread or a moderator can request human assistance for it.",
					),
				],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
			return;
		}

		if (
			!interaction.guild?.members?.me ||
			!thread
				.permissionsFor(interaction.guild.members.me)
				?.has(PermissionFlagsBits.ManageThreads)
		) {
			await interaction.reply({
				components: [
					statusContainer(
						StatusColor.Danger,
						"I don't have permission to request a human.",
					),
				],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
			return;
		}

		try {
			const reason = interaction.fields
				.getTextInputValue(REQUEST_HUMAN_REASON_FIELD_ID)
				.trim();

			const humanAssistanceTag = thread.parent.availableTags.find((tag) =>
				tag.name.toLowerCase().includes("human"),
			)?.id;
			if (humanAssistanceTag) {
				await thread.setAppliedTags([humanAssistanceTag]);
			}

			await addHumanAssistanceThread(interaction.guildId, thread.id);

			await interaction.reply({
				components: [
					statusContainer(
						StatusColor.Success,
						"Human assistance has been requested. AI responses have been disabled for this thread.",
					),
				],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});

			const pausedText = reason
				? `AI responses are paused for this thread.\n\n**Reason given:** ${reason}`
				: "AI responses are paused for this thread. The person who started this thread or a moderator can click below to resume them.";

			const resumeSection = new SectionBuilder()
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(pausedText),
				)
				.setButtonAccessory(
					new ButtonBuilder()
						.setLabel("Resume AI")
						.setEmoji("🔄")
						.setStyle(ButtonStyle.Secondary)
						.setCustomId("resume_ai"),
				);

			await thread
				.send({
					components: [resumeSection],
					flags: MessageFlags.IsComponentsV2,
				})
				.catch(() => null);
		} catch (error) {
			this.container.logger.error(
				`Failed to process human assistance request for thread ${thread.id}: ${error}`,
			);
			if (!interaction.replied && !interaction.deferred) {
				await interaction
					.reply({
						components: [
							statusContainer(
								StatusColor.Danger,
								"Sorry, something went wrong while requesting human assistance. Please try again.",
							),
						],
						flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
					})
					.catch(() => null);
			}
		}
	}

	public override async parse(interaction: ModalSubmitInteraction) {
		if (!interaction.guildId) return this.none();
		if (interaction.customId !== REQUEST_HUMAN_MODAL_ID) return this.none();
		return this.some();
	}
}
