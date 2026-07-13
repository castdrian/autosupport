import { Subcommand } from "@sapphire/plugin-subcommands";
import { getSupportEntries, getSupportEntry } from "@utils/knowledgeBase";
import {
	buildDeleteConfirmView,
	buildEntryModal,
	buildListView,
	truncate,
} from "@utils/knowledgeBaseUi";
import { StatusColor, statusContainer } from "@utils/statusMessage";
import {
	type AutocompleteInteraction,
	type ChatInputCommandInteraction,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
} from "discord.js";

const AUTOCOMPLETE_LIMIT = 25;

export class KnowledgeBaseCommand extends Subcommand {
	public constructor(
		context: Subcommand.LoaderContext,
		options: Subcommand.Options,
	) {
		super(context, {
			...options,
			name: "knowledgebase",
			subcommands: [
				{ name: "list", chatInputRun: "chatInputList" },
				{ name: "add", chatInputRun: "chatInputAdd" },
				{ name: "edit", chatInputRun: "chatInputEdit" },
				{ name: "delete", chatInputRun: "chatInputDelete" },
			],
		});
	}

	public async chatInputList(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const entries = getSupportEntries(interaction.guildId);
		await interaction.reply({
			components: buildListView(entries, 0),
			flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
		});
	}

	public async chatInputAdd(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		await interaction.showModal(buildEntryModal());
	}

	public async chatInputEdit(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const index = interaction.options.getInteger("entry", true);
		const entry = getSupportEntry(interaction.guildId, index);
		if (!entry) {
			await interaction.reply({
				components: [
					statusContainer(
						StatusColor.Danger,
						"That knowledge base entry no longer exists.",
					),
				],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
			return;
		}
		await interaction.showModal(buildEntryModal({ index, value: entry }));
	}

	public async chatInputDelete(interaction: ChatInputCommandInteraction) {
		if (!interaction.guildId) return;
		const index = interaction.options.getInteger("entry", true);
		const entry = getSupportEntry(interaction.guildId, index);
		if (!entry) {
			await interaction.reply({
				components: [
					statusContainer(
						StatusColor.Danger,
						"That knowledge base entry no longer exists.",
					),
				],
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});
			return;
		}
		await interaction.reply({
			components: buildDeleteConfirmView(entry, index),
			flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
		});
	}

	public override async autocompleteRun(interaction: AutocompleteInteraction) {
		if (!interaction.guildId) return interaction.respond([]);
		const focused = interaction.options.getFocused().toString().toLowerCase();
		const entries = getSupportEntries(interaction.guildId);

		const choices = entries
			.map((entry, index) => ({ entry, index }))
			.filter(({ entry }) =>
				focused ? entry.problem.toLowerCase().includes(focused) : true,
			)
			.slice(0, AUTOCOMPLETE_LIMIT)
			.map(({ entry, index }) => ({
				name: truncate(`${index + 1}. ${entry.problem}`, 100),
				value: index,
			}));

		return interaction.respond(choices);
	}

	public registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName("knowledgebase")
				.setDescription("manage the support knowledge base")
				.addSubcommand((command) =>
					command
						.setName("list")
						.setDescription("browse knowledge base entries"),
				)
				.addSubcommand((command) =>
					command.setName("add").setDescription("add a knowledge base entry"),
				)
				.addSubcommand((command) =>
					command
						.setName("edit")
						.setDescription("edit a knowledge base entry")
						.addIntegerOption((option) =>
							option
								.setName("entry")
								.setDescription("entry to edit")
								.setRequired(true)
								.setAutocomplete(true),
						),
				)
				.addSubcommand((command) =>
					command
						.setName("delete")
						.setDescription("delete a knowledge base entry")
						.addIntegerOption((option) =>
							option
								.setName("entry")
								.setDescription("entry to delete")
								.setRequired(true)
								.setAutocomplete(true),
						),
				)
				.setContexts(InteractionContextType.Guild)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		);
	}
}
