import { addIgnoredRoleId, addSupportChannelId, clearConfinementRoleId, getOrCreateGuildSettings, removeIgnoredRoleId, removeSupportChannelId, setConfinementRoleId, setIgnoreReplies, setMinimumConfidence } from '@root/src/database/db';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { inlineCodeBlock } from '@sapphire/utilities';
import { PermissionFlagsBits } from 'discord.js';
import { ChannelType, channelMention, roleMention } from 'discord.js';

export class SettingsCommand extends Subcommand {
	public constructor(context: Subcommand.LoaderContext, options: Subcommand.Options) {
		super(context, {
			...options,
			name: 'settings',
			subcommands: [
				{ name: 'info', chatInputRun: 'chatInputInfo' },
				{ name: 'confidence', chatInputRun: 'chatInputConfidence' },
				{ name: 'ignore-replies', chatInputRun: 'chatInputIgnoreReplies' },
				{
					name: 'channels',
					type: 'group',
					entries: [
						{ name: 'add', chatInputRun: 'chatInputAddSupportChannel' },
						{ name: 'remove', chatInputRun: 'chatInputRemoveSupportChannel' }
					]
				},
				{
					name: 'ignored-roles',
					type: 'group',
					entries: [
						{ name: 'add', chatInputRun: 'chatInputAddIgnoredRole' },
						{ name: 'remove', chatInputRun: 'chatInputRemoveIgnoredRole' }
					]
				},
				{
					name: 'confinement-role',
					type: 'group',
					entries: [
						{ name: 'set', chatInputRun: 'chatInputSetConfinementRole' },
						{ name: 'clear', chatInputRun: 'chatInputClearConfinementRole' }
					]
				},
			]
		});
	}

	public async chatInputInfo(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const settings = await getOrCreateGuildSettings(interaction.guildId);
		const formattedSettings = `Minimum Confidence: ${`${inlineCodeBlock((settings.minimumConfidence * 100).toString())}%`}\nIgnore Replies: ${settings.ignoreReplies ? inlineCodeBlock('Yes') : inlineCodeBlock('No')}\nSupport Channels: ${settings.channelIds.length > 0 ? settings.channelIds.map(channelMention).join(' ') : inlineCodeBlock('None')}\nIgnored Roles: ${settings.ignoredRoles.length > 0 ? settings.ignoredRoles.map(roleMention).join(' ') : inlineCodeBlock('None')}\nConfinement Role: ${settings.confinementRoleId ? roleMention(settings.confinementRoleId) : inlineCodeBlock('None')}`;
		await interaction.reply({ content: formattedSettings, ephemeral: true });
	}

	public async chatInputConfidence(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const confidence = interaction.options.getInteger('value', true);
		await setMinimumConfidence(interaction.guildId, confidence / 100);
		await interaction.reply({ content: `minimum confidence set to ${confidence}%`, ephemeral: true });
	}

	public async chatInputIgnoreReplies(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const ignoreReplies = interaction.options.getBoolean('value', true);
		await setIgnoreReplies(interaction.guildId, ignoreReplies);
		await interaction.reply({ content: `ignore replies set to ${ignoreReplies}`, ephemeral: true });
	}

	public async chatInputAddSupportChannel(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const channel = interaction.options.getChannel('channel', true);
		await addSupportChannelId(interaction.guildId, channel.id);
		await interaction.reply({ content: `channel ${channelMention(channel.id)} added as support channel`, ephemeral: true });
	}

	public async chatInputRemoveSupportChannel(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const channel = interaction.options.getChannel('channel', true);
		await removeSupportChannelId(interaction.guildId, channel.id);
		await interaction.reply({ content: `channel ${channelMention(channel.id)} removed as support channel`, ephemeral: true });
	}

	public async chatInputAddIgnoredRole(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const role = interaction.options.getRole('role', true);
		await addIgnoredRoleId(interaction.guildId, role.id);
		await interaction.reply({ content: `${roleMention(role.id)} added as ignored role`, ephemeral: true });
	}

	public async chatInputRemoveIgnoredRole(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const role = interaction.options.getRole('role', true);
		await removeIgnoredRoleId(interaction.guildId, role.id);
		await interaction.reply({ content: `${roleMention(role.id)} removed as ignored role`, ephemeral: true });
	}

	public async chatInputSetConfinementRole(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const role = interaction.options.getRole('role', true);
		await setConfinementRoleId(interaction.guildId, role.id);
		await interaction.reply({ content: `confinement role set to ${roleMention(role.id)}`, ephemeral: true });
	}

	public async chatInputClearConfinementRole(interaction: Subcommand.ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		await clearConfinementRoleId(interaction.guildId);
		await interaction.reply({ content: 'confinement role cleared', ephemeral: true });
	}

	registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName('settings')
				.setDescription('autosupport settings')
				.addSubcommand((command) =>
					command
						.setName("info")
						.setDescription("show current settings"),
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
						.setName('channels')
						.setDescription('configure support channels')
						.addSubcommand((command) =>
							command
								.setName('add')
								.setDescription('add support channel')
								.addChannelOption((option) =>
									option
										.setName('channel')
										.setDescription('channel to add')
										.addChannelTypes(ChannelType.GuildText)
										.setRequired(true),
								)
						)
						.addSubcommand((command) =>
							command
								.setName('remove')
								.setDescription('remove support channel')
								.addChannelOption((option) =>
									option
										.setName('channel')
										.setDescription('channel to remove')
										.addChannelTypes(ChannelType.GuildText)
										.setRequired(true),
								)
						)
				)
				.addSubcommandGroup((group) =>
					group
						.setName('ignored-roles')
						.setDescription('configure ignored roles')
						.addSubcommand((command) =>
							command
								.setName('add')
								.setDescription('add ignored role')
								.addRoleOption((option) =>
									option
										.setName('role')
										.setDescription('role to add')
										.setRequired(true),
								)
						)
						.addSubcommand((command) =>
							command
								.setName('remove')
								.setDescription('remove ignored role')
								.addRoleOption((option) =>
									option
										.setName('role')
										.setDescription('role to remove')
										.setRequired(true),
								)
						)
				)
				.addSubcommandGroup((group) =>
					group
						.setName('confinement-role')
						.setDescription('configure confinement role')
						.addSubcommand((command) =>
							command
								.setName('set')
								.setDescription('set confinement role')
								.addRoleOption((option) =>
									option
										.setName('role')
										.setDescription('role to set')
										.setRequired(true),
								)
						)
						.addSubcommand((command) =>
							command
								.setName('clear')
								.setDescription('clear confinement role')
						)
				)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		);
	}
}