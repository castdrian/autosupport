import { Subcommand } from "@sapphire/plugin-subcommands";
import {
	addSupportChannelId,
	removeSupportChannelId,
} from "@src/database/db";
import {
	type ChatInputCommandInteraction,
	PermissionFlagsBits,
} from "discord.js";
import { ChannelType, channelMention } from "discord.js";

export class SettingsCommand extends Subcommand {
	public constructor(
		context: Subcommand.LoaderContext,
		options: Subcommand.Options,
	) {
		super(context, {
			...options,
			name: "settings",
			subcommands: [
				{ name: "info", chatInputRun: "chatInputInfo" },
				{
					name: "channels",
					type: "group",
					entries: [
						{ name: "add", chatInputRun: "chatInputAddSupportChannel" },
						{ name: "remove", chatInputRun: "chatInputRemoveSupportChannel" },
					],
				},
			],
		});
	}

	public async chatInputAddSupportChannel(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		const channel = interaction.options.getChannel("channel", true);
		await addSupportChannelId(interaction.guildId, channel.id);
		await interaction.reply({
			content: `channel ${channelMention(channel.id)} added as support channel`,
			ephemeral: true,
		});
	}

	public async chatInputRemoveSupportChannel(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		const channel = interaction.options.getChannel("channel", true);
		await removeSupportChannelId(interaction.guildId, channel.id);
		await interaction.reply({
			content: `channel ${channelMention(channel.id)} removed as support channel`,
			ephemeral: true,
		});
	}

	registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName("settings")
				.setDescription("autosupport settings")
				.addSubcommand((command) =>
					command.setName("info").setDescription("show current settings"),
				)
				.addSubcommandGroup((group) =>
					group
						.setName("channels")
						.setDescription("configure support channels")
						.addSubcommand((command) =>
							command
								.setName("add")
								.setDescription("add support channel")
								.addChannelOption((option) =>
									option
										.setName("channel")
										.setDescription("channel to add")
										.addChannelTypes(ChannelType.GuildForum)
										.setRequired(true),
								),
						)
						.addSubcommand((command) =>
							command
								.setName("remove")
								.setDescription("remove support channel")
								.addChannelOption((option) =>
									option
										.setName("channel")
										.setDescription("channel to remove")
										.addChannelTypes(ChannelType.GuildForum)
										.setRequired(true),
								),
						),
				)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		);
	}
}
