import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import { addHumanAssistanceThread } from "@utils/autosupport";
import { type ButtonInteraction, PermissionFlagsBits } from "discord.js";

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
				if (
					!interaction.guild?.members?.me ||
					!thread
						.permissionsFor(interaction.guild.members.me)
						?.has(PermissionFlagsBits.ManageThreads)
				) {
					await interaction.reply({
						content: "I don't have permission to close this thread.",
						ephemeral: true,
					});
					return;
				}
				await interaction.reply({
					content: "Thread has been closed.",
					ephemeral: true,
				});

				await thread.setArchived(true);
				await thread.setLocked(true);
				break;
			}
			case "request_human": {
				if (!interaction.guildId) return;
				const thread = interaction.channel;
				if (!thread || !thread.isThread()) return;
				if (!thread.parent?.isThreadOnly()) return;
				if (
					!interaction.guild?.members?.me ||
					!thread
						.permissionsFor(interaction.guild.members.me)
						?.has(PermissionFlagsBits.ManageThreads)
				) {
					await interaction.reply({
						content: "I don't have permission to request a human.",
						ephemeral: true,
					});
					return;
				}

				const humanAssistanceTag = thread.parent.availableTags.find((tag) =>
					tag.name.toLowerCase().includes("human"),
				)?.id;
				if (humanAssistanceTag) {
					await thread.setAppliedTags([humanAssistanceTag]);
				}

				addHumanAssistanceThread(thread.id);

				await interaction.reply({
					content:
						"Human assistance has been requested. AI responses have been disabled for this thread.",
					ephemeral: true,
				});
				break;
			}
		}
	}

	public override async parse(interaction: ButtonInteraction) {
		if (!interaction.guildId) return this.none();
		if (
			interaction.customId !== "close_thread" &&
			interaction.customId !== "request_human"
		)
			return this.none();
		return this.some({ interaction });
	}
}
