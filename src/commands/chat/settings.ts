import { Subcommand } from "@sapphire/plugin-subcommands";
import { inlineCodeBlock } from "@sapphire/utilities";
import { config } from "@src/config";
import {
	addIgnoredRoleId,
	addSupportChannelId,
	clearConfinementRoleId,
	clearDeveloperRoleId,
	getOrCreateGuildSettings,
	removeIgnoredRoleId,
	removeSupportChannelId,
	setConfinementRoleId,
	setDeveloperRoleId,
	setIgnoreReplies,
	setMinimumConfidence,
} from "@src/database/db";
import { addIntent, deleteIntent } from "@utils/wit";
import {
	type ChatInputCommandInteraction,
	PermissionFlagsBits,
} from "discord.js";
import { ChannelType, channelMention, roleMention } from "discord.js";

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
				{ name: "confidence", chatInputRun: "chatInputConfidence" },
				{ name: "ignore-replies", chatInputRun: "chatInputIgnoreReplies" },
				{
					name: "channels",
					type: "group",
					entries: [
						{ name: "add", chatInputRun: "chatInputAddSupportChannel" },
						{ name: "remove", chatInputRun: "chatInputRemoveSupportChannel" },
					],
				},
				{
					name: "ignored-roles",
					type: "group",
					entries: [
						{ name: "add", chatInputRun: "chatInputAddIgnoredRole" },
						{ name: "remove", chatInputRun: "chatInputRemoveIgnoredRole" },
					],
				},
				{
					name: "confinement-role",
					type: "group",
					entries: [
						{ name: "set", chatInputRun: "chatInputSetConfinementRole" },
						{ name: "clear", chatInputRun: "chatInputClearConfinementRole" },
					],
				},
				{
					name: "developer-role",
					type: "group",
					entries: [
						{ name: "set", chatInputRun: "chatInputSetDeveloperRole" },
						{ name: "clear", chatInputRun: "chatInputClearDevelopertRole" },
					],
				},
				{
					name: "intents",
					type: "group",
					entries: [
						{ name: "add", chatInputRun: "chatInputAddIntent" },
						{ name: "delete", chatInputRun: "chatInputDeleteIntent" },
					],
				},
			],
		});
	}

	public async chatInputInfo(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const settings = await getOrCreateGuildSettings(interaction.guildId);
		const formattedSettings = `Minimum Confidence: ${inlineCodeBlock(`${(settings.minimumConfidence * 100).toString()}%`)}\nIgnore Replies: ${settings.ignoreReplies ? inlineCodeBlock("Yes") : inlineCodeBlock("No")}\nSupport Channels: ${settings.channelIds.length > 0 ? settings.channelIds.map(channelMention).join(" ") : inlineCodeBlock("None")}\nIgnored Roles: ${settings.ignoredRoles.length > 0 ? settings.ignoredRoles.map(roleMention).join(" ") : inlineCodeBlock("None")}\nConfinement Role: ${settings.confinementRoleId ? roleMention(settings.confinementRoleId) : inlineCodeBlock("None")}`;
		await interaction.reply({ content: formattedSettings, ephemeral: true });
	}

	public async chatInputConfidence(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const confidence = interaction.options.getInteger("value", true);
		await setMinimumConfidence(interaction.guildId, confidence / 100);
		await interaction.reply({
			content: `minimum confidence set to ${confidence}%`,
			ephemeral: true,
		});
	}

	public async chatInputIgnoreReplies(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		const ignoreReplies = interaction.options.getBoolean("value", true);
		await setIgnoreReplies(interaction.guildId, ignoreReplies);
		await interaction.reply({
			content: `ignore replies set to ${ignoreReplies}`,
			ephemeral: true,
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

	public async chatInputAddIgnoredRole(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		const role = interaction.options.getRole("role", true);
		await addIgnoredRoleId(interaction.guildId, role.id);
		await interaction.reply({
			content: `${roleMention(role.id)} added as ignored role`,
			ephemeral: true,
		});
	}

	public async chatInputRemoveIgnoredRole(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		const role = interaction.options.getRole("role", true);
		await removeIgnoredRoleId(interaction.guildId, role.id);
		await interaction.reply({
			content: `${roleMention(role.id)} removed as ignored role`,
			ephemeral: true,
		});
	}

	public async chatInputSetConfinementRole(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		const role = interaction.options.getRole("role", true);
		await setConfinementRoleId(interaction.guildId, role.id);
		await interaction.reply({
			content: `confinement role set to ${roleMention(role.id)}`,
			ephemeral: true,
		});
	}

	public async chatInputClearConfinementRole(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		await clearConfinementRoleId(interaction.guildId);
		await interaction.reply({
			content: "confinement role cleared",
			ephemeral: true,
		});
	}

	public async chatInputSetDeveloperRole(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		const role = interaction.options.getRole("role", true);
		await setDeveloperRoleId(interaction.guildId, role.id);
		await interaction.reply({
			content: `developer role set to ${roleMention(role.id)}`,
			ephemeral: true,
		});
	}

	public async chatInputClearDeveloperRole(
		interaction: ChatInputCommandInteraction,
	) {
		if (!interaction.guildId) return;
		await clearDeveloperRoleId(interaction.guildId);
		await interaction.reply({
			content: "developer role cleared",
			ephemeral: true,
		});
	}

	public async chatInputAddIntent(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;

		const intent = interaction.options.getString("intent", true);

		const isValidIntent = /^(?!\d)[a-zA-Z0-9_]+$/.test(intent);

		if (!isValidIntent) {
			await interaction.reply({
				content:
					"Invalid intent format. Intent must match the regex `/^(?!\\d)[a-zA-Z0-9_]+$/`.",
				ephemeral: true,
			});
			return;
		}

		await addIntent(intent, config.witAiServerToken[interaction.guildId]);
		await interaction.reply({
			content: `intent ${inlineCodeBlock(intent)} added`,
			ephemeral: true,
		});
	}

	public async chatInputDeleteIntent(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const intent = interaction.options.getString("intent", true);
		await deleteIntent(intent, config.witAiServerToken[interaction.guildId]);
		await interaction.reply({
			content: `intent ${inlineCodeBlock(intent)} deleted`,
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
				.addSubcommand((command) =>
					command
						.setName("confidence")
						.setDescription("set minimum confidence")
						.addIntegerOption((option) =>
							option
								.setName("value")
								.setDescription("minimum confidence value")
								.setMinValue(0)
								.setMaxValue(100)
								.setRequired(true),
						),
				)
				.addSubcommand((command) =>
					command
						.setName("ignore-replies")
						.setDescription("toggle ignore replies")
						.addBooleanOption((option) =>
							option
								.setName("value")
								.setDescription("ignore replies")
								.setRequired(true),
						),
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
										.addChannelTypes(ChannelType.GuildText)
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
										.addChannelTypes(ChannelType.GuildText)
										.setRequired(true),
								),
						),
				)
				.addSubcommandGroup((group) =>
					group
						.setName("ignored-roles")
						.setDescription("configure ignored roles")
						.addSubcommand((command) =>
							command
								.setName("add")
								.setDescription("add ignored role")
								.addRoleOption((option) =>
									option
										.setName("role")
										.setDescription("role to add")
										.setRequired(true),
								),
						)
						.addSubcommand((command) =>
							command
								.setName("remove")
								.setDescription("remove ignored role")
								.addRoleOption((option) =>
									option
										.setName("role")
										.setDescription("role to remove")
										.setRequired(true),
								),
						),
				)
				.addSubcommandGroup((group) =>
					group
						.setName("confinement-role")
						.setDescription("configure confinement role")
						.addSubcommand((command) =>
							command
								.setName("set")
								.setDescription("set confinement role")
								.addRoleOption((option) =>
									option
										.setName("role")
										.setDescription("role to set")
										.setRequired(true),
								),
						)
						.addSubcommand((command) =>
							command.setName("clear").setDescription("clear confinement role"),
						),
				)
				.addSubcommandGroup((group) =>
					group
						.setName("developer-role")
						.setDescription("configure developer role")
						.addSubcommand((command) =>
							command
								.setName("set")
								.setDescription("set developer role")
								.addRoleOption((option) =>
									option
										.setName("role")
										.setDescription("role to set")
										.setRequired(true),
								),
						)
						.addSubcommand((command) =>
							command.setName("clear").setDescription("clear development role"),
						),
				)
				.addSubcommandGroup((group) =>
					group
						.setName("intents")
						.setDescription("configure intents")
						.addSubcommand((command) =>
							command
								.setName("add")
								.setDescription("add intent")
								.addStringOption((option) =>
									option
										.setName("intent")
										.setDescription("intent to add")
										.setRequired(true),
								),
						)
						.addSubcommand((command) =>
							command
								.setName("delete")
								.setDescription("delete intent")
								.addStringOption((option) =>
									option
										.setName("intent")
										.setDescription("intent to delete")
										.setAutocomplete(true)
										.setRequired(true),
								),
						),
				)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		);
	}
}
