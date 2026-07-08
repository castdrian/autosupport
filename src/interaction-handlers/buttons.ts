import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import {
	clearThreadEscalated,
	deleteThreadResponsesForThread,
} from "@src/database/db";
import {
	addHumanAssistanceThread,
	hasRequestedHumanAssistance,
	removeHumanAssistanceThread,
} from "@utils/autosupport";
import {
	ButtonBuilder,
	type ButtonInteraction,
	ButtonStyle,
	MessageFlags,
	PermissionFlagsBits,
	SectionBuilder,
	TextDisplayBuilder,
	type ThreadChannel,
} from "discord.js";

function canManageThread(
	interaction: ButtonInteraction,
	thread: ThreadChannel,
): boolean {
	if (interaction.user.id === thread.ownerId) return true;
	return (
		interaction.memberPermissions?.has(PermissionFlagsBits.ManageThreads) ??
		false
	);
}

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
				if (!thread || !thread.isThread()) return;
				if (!thread.parent?.isThreadOnly()) return;

				if (!canManageThread(interaction, thread)) {
					await interaction.reply({
						content:
							"Only the person who started this thread or a moderator can close it.",
						flags: MessageFlags.Ephemeral,
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
						content: "I don't have permission to close this thread.",
						flags: MessageFlags.Ephemeral,
					});
					return;
				}
				await interaction.reply({
					content: "Thread has been closed.",
					flags: MessageFlags.Ephemeral,
				});

				await Promise.all([
					clearThreadEscalated(thread.id),
					deleteThreadResponsesForThread(thread.id),
				]).catch(() => null);

				await thread.setArchived(true);
				break;
			}
			case "request_human": {
				if (!interaction.guildId) return;
				const thread = interaction.channel;
				if (!thread || !thread.isThread()) return;
				if (!thread.parent?.isThreadOnly()) return;

				if (!canManageThread(interaction, thread)) {
					await interaction.reply({
						content:
							"Only the person who started this thread or a moderator can request human assistance for it.",
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				if (await hasRequestedHumanAssistance(thread.id)) {
					await interaction.reply({
						content:
							"Human assistance has already been requested for this thread.",
						flags: MessageFlags.Ephemeral,
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
						content: "I don't have permission to request a human.",
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

				const humanAssistanceTag = thread.parent.availableTags.find((tag) =>
					tag.name.toLowerCase().includes("human"),
				)?.id;
				if (humanAssistanceTag) {
					await thread.setAppliedTags([humanAssistanceTag]);
				}

				await addHumanAssistanceThread(interaction.guildId, thread.id);

				await interaction.reply({
					content:
						"Human assistance has been requested. AI responses have been disabled for this thread.",
					flags: MessageFlags.Ephemeral,
				});

				const resumeSection = new SectionBuilder()
					.addTextDisplayComponents(
						new TextDisplayBuilder().setContent(
							"AI responses are paused for this thread. The person who started this thread or a moderator can click below to resume them.",
						),
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
				break;
			}
			case "resume_ai": {
				if (!interaction.guildId) return;
				const thread = interaction.channel;
				if (!thread || !thread.isThread()) return;
				if (!thread.parent?.isThreadOnly()) return;

				if (!canManageThread(interaction, thread)) {
					await interaction.reply({
						content:
							"Only the person who started this thread or a moderator can resume AI responses for it.",
						flags: MessageFlags.Ephemeral,
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
						content: "I don't have permission to resume AI for this thread.",
						flags: MessageFlags.Ephemeral,
					});
					return;
				}

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
					content: "AI responses have been resumed for this thread.",
					flags: MessageFlags.Ephemeral,
				});
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
