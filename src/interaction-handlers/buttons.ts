import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import {
	clearThreadEscalated,
	deleteThreadResponsesForThread,
} from "@src/database/db";
import {
	hasRequestedHumanAssistance,
	removeHumanAssistanceThread,
} from "@utils/autosupport";
import { StatusColor, statusContainer } from "@utils/statusMessage";
import {
	type ButtonInteraction,
	LabelBuilder,
	MessageFlags,
	ModalBuilder,
	type ModalSubmitInteraction,
	PermissionFlagsBits,
	TextInputBuilder,
	TextInputStyle,
	type ThreadChannel,
} from "discord.js";

export function canManageThread(
	interaction: ButtonInteraction | ModalSubmitInteraction,
	thread: ThreadChannel,
): boolean {
	if (interaction.user.id === thread.ownerId) return true;
	return (
		interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads) ??
		false
	);
}

export const REQUEST_HUMAN_MODAL_ID = "request_human_modal";
export const REQUEST_HUMAN_REASON_FIELD_ID = "reason";

export class ThreadButtonHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		});
	}

	public override async run(interaction: ButtonInteraction) {
		switch (interaction.customId) {
			case "close_thread": {
				if (!interaction.guildId) return;
				const thread = interaction.channel;
				if (!thread?.isThread()) return;
				if (!thread.parent?.isThreadOnly()) return;

				if (!canManageThread(interaction, thread)) {
					await interaction.reply({
						components: [
							statusContainer(
								StatusColor.Danger,
								"Only the person who started this thread or a moderator can close it.",
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
								"I don't have permission to close this thread.",
							),
						],
						flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
					});
					return;
				}
				await interaction.reply({
					components: [
						statusContainer(StatusColor.Success, "Thread has been closed."),
					],
					flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
				});

				await Promise.all([
					clearThreadEscalated(thread.id),
					deleteThreadResponsesForThread(thread.id),
				]).catch(() => null);

				await thread
					.setArchived(true)
					.catch((error) =>
						this.container.logger.error(
							`Failed to archive thread ${thread.id} after close_thread: ${error}`,
						),
					);
				break;
			}
			case "request_human": {
				if (!interaction.guildId) return;
				const thread = interaction.channel;
				if (!thread?.isThread()) return;
				if (!thread.parent?.isThreadOnly()) return;

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

				if (await hasRequestedHumanAssistance(thread.id)) {
					await interaction.reply({
						components: [
							statusContainer(
								StatusColor.Neutral,
								"Human assistance has already been requested for this thread.",
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

				const modal = new ModalBuilder()
					.setCustomId(REQUEST_HUMAN_MODAL_ID)
					.setTitle("Request Human Assistance")
					.addLabelComponents(
						new LabelBuilder()
							.setLabel("What do you need help with?")
							.setDescription(
								"Optional — a quick summary helps whoever picks this up.",
							)
							.setTextInputComponent(
								new TextInputBuilder()
									.setCustomId(REQUEST_HUMAN_REASON_FIELD_ID)
									.setStyle(TextInputStyle.Paragraph)
									.setRequired(false)
									.setMaxLength(500)
									.setPlaceholder(
										"e.g. the bot's answer didn't fix my issue and I'm not sure what to try next",
									),
							),
					);

				try {
					await interaction.showModal(modal);
				} catch (error) {
					this.container.logger.error(
						`Failed to show request-human modal for thread ${thread.id}: ${error}`,
					);
					if (!interaction.replied && !interaction.deferred) {
						await interaction
							.reply({
								components: [
									statusContainer(
										StatusColor.Danger,
										"Sorry, something went wrong opening the request form. Please try again.",
									),
								],
								flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
							})
							.catch(() => null);
					}
				}
				break;
			}
			case "resume_ai": {
				if (!interaction.guildId) return;
				const thread = interaction.channel;
				if (!thread?.isThread()) return;
				if (!thread.parent?.isThreadOnly()) return;

				if (!canManageThread(interaction, thread)) {
					await interaction.reply({
						components: [
							statusContainer(
								StatusColor.Danger,
								"Only the person who started this thread or a moderator can resume AI responses for it.",
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
								"I don't have permission to resume AI for this thread.",
							),
						],
						flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
					});
					return;
				}

				try {
					await removeHumanAssistanceThread(thread.id);

					const humanAssistanceTag = thread.parent.availableTags.find((tag) =>
						tag.name.toLowerCase().includes("human"),
					)?.id;
					if (
						humanAssistanceTag &&
						thread.appliedTags.includes(humanAssistanceTag)
					) {
						const remainingTags = thread.appliedTags.filter(
							(id) => id !== humanAssistanceTag,
						);
						await thread.setAppliedTags(remainingTags).catch(() => null);
					}

					await interaction.reply({
						components: [
							statusContainer(
								StatusColor.Success,
								"AI responses have been resumed for this thread.",
							),
						],
						flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
					});
				} catch (error) {
					this.container.logger.error(
						`Failed to resume AI for thread ${thread.id}: ${error}`,
					);
					if (!interaction.replied && !interaction.deferred) {
						await interaction
							.reply({
								components: [
									statusContainer(
										StatusColor.Danger,
										"Sorry, something went wrong resuming AI for this thread. Please try again.",
									),
								],
								flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
							})
							.catch(() => null);
					}
				}
				break;
			}
		}
	}

	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.guildId) return this.none();
		if (
			interaction.customId !== "close_thread" &&
			interaction.customId !== "request_human" &&
			interaction.customId !== "resume_ai"
		)
			return this.none();
		return this.some({ interaction });
	}
}
