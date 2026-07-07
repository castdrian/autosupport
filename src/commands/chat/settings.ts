import { Subcommand } from "@sapphire/plugin-subcommands";
import data from "@src/data.toml";
import {
	addSupportChannelId,
	getOrCreateGuildSettings,
	removeSupportChannelId,
} from "@src/database/db";
import {
	ChannelType,
	type ChatInputCommandInteraction,
	channelMention,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";

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

	public async chatInputInfo(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const settings = await getOrCreateGuildSettings(interaction.guildId);

		const channelsContent = settings.channelIds.length
			? `**Support channels:**\n${settings.channelIds.map((id) => channelMention(id)).join("\n")}`
			: "No support channels configured.";

		const articleCount = data.support[interaction.guildId]?.length ?? 0;
		const hasInstructions = Boolean(data.instructions[interaction.guildId]);

		const knowledgeBaseContent = `**Knowledge base:**\n${articleCount} support article${articleCount === 1 ? "" : "s"} loaded\n${hasInstructions ? "Custom instructions configured" : "No custom instructions configured"}`;

		await interaction.reply({
			content: `${channelsContent}\n\n${knowledgeBaseContent}`,
			flags: MessageFlags.Ephemeral,
		});
	}

	public async chatInputAddSupportChannel(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		const channel = interaction.options.getChannel("channel", true);
		const before = await getOrCreateGuildSettings(interaction.guildId);
		const alreadyConfigured = before.channelIds.includes(channel.id);
		await addSupportChannelId(interaction.guildId, channel.id);
		await interaction.reply({
			content: alreadyConfigured
				? `channel ${channelMention(channel.id)} is already a support channel`
				: `channel ${channelMention(channel.id)} added as support channel`,
			flags: MessageFlags.Ephemeral,
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
			flags: MessageFlags.Ephemeral,
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
