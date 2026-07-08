import { Subcommand } from "@sapphire/plugin-subcommands";
import data from "@src/data.toml";
import {
	addSupportChannelId,
	clearThreadEscalated,
	deleteThreadResponsesForThread,
	getOrCreateGuildSettings,
	removeSupportChannelId,
} from "@src/database/db";
import {
	ChannelType,
	type ChatInputCommandInteraction,
	ContainerBuilder,
	channelMention,
	MessageFlags,
	PermissionFlagsBits,
	SeparatorBuilder,
	TextDisplayBuilder,
} from "discord.js";

enum AccentColor {
	Success = 0x57f287,
	Warning = 0xfee75c,
	Neutral = 0x99aab5,
}

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

		const hasChannels = settings.channelIds.length > 0;
		const channelsText = hasChannels
			? `**Support channels**\n${settings.channelIds.map((id) => channelMention(id)).join("\n")}`
			: "**Support channels**\nNo support channels configured.";

		const articleCount = data.support[interaction.guildId]?.length ?? 0;
		const hasKnowledgeBase = articleCount > 0;
		const hasInstructions = Boolean(data.instructions[interaction.guildId]);

		const knowledgeBaseText = `**Knowledge base**\n${articleCount} support article${articleCount === 1 ? "" : "s"} loaded\n${hasInstructions ? "Custom instructions configured" : "No custom instructions configured"}`;

		const accentColor =
			hasChannels && hasKnowledgeBase
				? AccentColor.Success
				: hasChannels || hasKnowledgeBase
					? AccentColor.Warning
					: AccentColor.Neutral;

		const container = new ContainerBuilder()
			.setAccentColor(accentColor)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(channelsText),
			)
			.addSeparatorComponents(new SeparatorBuilder())
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(knowledgeBaseText),
			);

		await interaction.reply({
			components: [container],
			flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
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

		const hasKnowledgeBase = Boolean(data.support[interaction.guildId]?.length);

		const lines = [
			alreadyConfigured
				? `channel ${channelMention(channel.id)} is already a support channel`
				: `channel ${channelMention(channel.id)} added as support channel`,
		];
		if (!hasKnowledgeBase) {
			lines.push(
				":warning: No knowledge base content is configured for this server yet — the bot won't be able to answer questions here until entries are added to `data.toml`.",
			);
		}

		const accentColor = !hasKnowledgeBase
			? AccentColor.Warning
			: alreadyConfigured
				? AccentColor.Neutral
				: AccentColor.Success;

		const container = new ContainerBuilder()
			.setAccentColor(accentColor)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(lines.join("\n\n")),
			);

		await interaction.reply({
			components: [container],
			flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
		});
	}

	public async chatInputRemoveSupportChannel(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		const channel = interaction.options.getChannel("channel", true);
		const before = await getOrCreateGuildSettings(interaction.guildId);

		if (!before.channelIds.includes(channel.id)) {
			const container = new ContainerBuilder()
				.setAccentColor(AccentColor.Neutral)
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						`channel ${channelMention(channel.id)} is not a configured support channel`,
					),
				);
			await interaction.reply({
				components: [container],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
			return;
		}

		await removeSupportChannelId(interaction.guildId, channel.id);
		await this.cleanupThreadStateForChannel(channel.id).catch((error) =>
			this.container.logger.error(
				`Failed to clean up thread state for removed channel ${channel.id}: ${error}`,
			),
		);

		const container = new ContainerBuilder()
			.setAccentColor(AccentColor.Success)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`channel ${channelMention(channel.id)} removed as support channel`,
				),
			);

		await interaction.reply({
			components: [container],
			flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
		});
	}

	private async cleanupThreadStateForChannel(channelId: string): Promise<void> {
		const channel = await this.container.client.channels
			.fetch(channelId)
			.catch(() => null);
		if (!channel?.isThreadOnly()) return;

		const [active, archived] = await Promise.all([
			channel.threads.fetchActive().catch(() => null),
			channel.threads.fetchArchived().catch(() => null),
		]);

		const threadIds = new Set([
			...(active?.threads.keys() ?? []),
			...(archived?.threads.keys() ?? []),
		]);

		await Promise.all(
			[...threadIds].map((threadId) =>
				Promise.all([
					clearThreadEscalated(threadId),
					deleteThreadResponsesForThread(threadId),
				]),
			),
		);
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
