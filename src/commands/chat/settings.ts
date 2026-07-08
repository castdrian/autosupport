import { Subcommand } from "@sapphire/plugin-subcommands";
import data from "@src/data.toml";
import {
	addSupportChannelId,
	clearSupportRoleId,
	clearThreadEscalated,
	countEscalatedThreadsForGuild,
	deleteThreadResponsesForThread,
	getOrCreateGuildSettings,
	removeSupportChannelId,
	setSupportRoleId,
} from "@src/database/db";
import { StatusColor, statusContainer } from "@utils/statusMessage";
import {
	ChannelType,
	type ChatInputCommandInteraction,
	ContainerBuilder,
	channelMention,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	roleMention,
	SeparatorBuilder,
	TextDisplayBuilder,
	type ThreadChannel,
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
				{ name: "support-role", chatInputRun: "chatInputSupportRole" },
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

		const escalatedCount = await countEscalatedThreadsForGuild(
			interaction.guildId,
		);
		const escalatedText = `**Active threads**\n${escalatedCount === 0 ? "No threads currently waiting on a human" : `${escalatedCount} thread${escalatedCount === 1 ? "" : "s"} currently waiting on a human`}`;

		const supportRoleText = `**Support role**\n${settings.supportRoleId ? `${roleMention(settings.supportRoleId)} is pinged when a thread requests human assistance` : "No support role configured — escalations won't ping anyone"}`;

		const accentColor =
			hasChannels && hasKnowledgeBase
				? StatusColor.Success
				: hasChannels || hasKnowledgeBase
					? StatusColor.Warning
					: StatusColor.Neutral;

		const container = new ContainerBuilder()
			.setAccentColor(accentColor)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(channelsText),
			)
			.addSeparatorComponents(new SeparatorBuilder())
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(knowledgeBaseText),
			)
			.addSeparatorComponents(new SeparatorBuilder())
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(escalatedText),
			)
			.addSeparatorComponents(new SeparatorBuilder())
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(supportRoleText),
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
			? StatusColor.Warning
			: alreadyConfigured
				? StatusColor.Neutral
				: StatusColor.Success;

		await interaction.reply({
			components: [statusContainer(accentColor, lines.join("\n\n"))],
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
			await interaction.reply({
				components: [
					statusContainer(
						StatusColor.Neutral,
						`channel ${channelMention(channel.id)} is not a configured support channel`,
					),
				],
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

		await interaction.reply({
			components: [
				statusContainer(
					StatusColor.Success,
					`channel ${channelMention(channel.id)} removed as support channel`,
				),
			],
			flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
		});
	}

	public async chatInputSupportRole(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const role = interaction.options.getRole("role");

		if (!role) {
			await clearSupportRoleId(interaction.guildId);
			await interaction.reply({
				components: [
					statusContainer(
						StatusColor.Neutral,
						"Support role cleared — escalations won't ping anyone.",
					),
				],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
			return;
		}

		await setSupportRoleId(interaction.guildId, role.id);
		await interaction.reply({
			components: [
				statusContainer(
					StatusColor.Success,
					`${roleMention(role.id)} will be pinged when a thread requests human assistance.`,
				),
			],
			flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
		});
	}

	private async cleanupThreadStateForChannel(channelId: string): Promise<void> {
		const channel = await this.container.client.channels
			.fetch(channelId)
			.catch(() => null);
		if (!channel?.isThreadOnly()) return;

		const active = await channel.threads.fetchActive().catch(() => null);
		const threadIds = new Set(active?.threads.keys() ?? []);

		let before: ThreadChannel | undefined;
		for (;;) {
			const page = await channel.threads
				.fetchArchived({ before })
				.catch(() => null);
			if (!page?.threads.size) break;
			for (const id of page.threads.keys()) threadIds.add(id);
			if (!page.hasMore) break;
			before = page.threads.last();
		}

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
				.addSubcommand((command) =>
					command
						.setName("support-role")
						.setDescription(
							"set or clear the role pinged when a thread requests human assistance",
						)
						.addRoleOption((option) =>
							option
								.setName("role")
								.setDescription(
									"role to ping on escalation (omit to clear the current role)",
								)
								.setRequired(false),
						),
				)
				.setContexts(InteractionContextType.Guild)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		);
	}
}
