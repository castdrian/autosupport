import type { SupportEntry } from "@utils/knowledgeBase";
import { StatusColor } from "@utils/statusMessage";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	LabelBuilder,
	ModalBuilder,
	SeparatorBuilder,
	TextDisplayBuilder,
	TextInputBuilder,
	TextInputStyle,
} from "discord.js";

export const KB_LIST_PREFIX = "kb_list";
export const KB_ADD_MODAL_ID = "kb_add_modal";
export const KB_EDIT_MODAL_PREFIX = "kb_edit_modal";
export const KB_DELETE_CONFIRM_PREFIX = "kb_delete_confirm";
export const KB_DELETE_CANCEL_ID = "kb_delete_cancel";

export const KB_FIELD_PROBLEM = "problem";
export const KB_FIELD_SOLUTION = "solution";
export const KB_FIELD_NOTES = "notes";

const PROBLEM_MAX_LENGTH = 300;
const SOLUTION_MAX_LENGTH = 2000;
const NOTES_MAX_LENGTH = 2000;

export function buildCustomId(prefix: string, index: number): string {
	return `${prefix}:${index}`;
}

export function parseIndexCustomId(
	customId: string,
	prefix: string,
): number | undefined {
	if (!customId.startsWith(`${prefix}:`)) return undefined;
	const raw = customId.slice(prefix.length + 1);
	const index = Number.parseInt(raw, 10);
	return Number.isInteger(index) && index >= 0 ? index : undefined;
}

export function truncate(value: string, max: number): string {
	return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// Builds the modal used to add or edit an entry. When an existing entry is
// passed the fields are prefilled and the custom id carries the entry index so
// the submit handler knows which entry to update.
export function buildEntryModal(entry?: {
	index: number;
	value: SupportEntry;
}): ModalBuilder {
	const isEdit = entry !== undefined;
	const modal = new ModalBuilder()
		.setCustomId(
			isEdit
				? buildCustomId(KB_EDIT_MODAL_PREFIX, entry.index)
				: KB_ADD_MODAL_ID,
		)
		.setTitle(
			isEdit ? "Edit knowledge base entry" : "Add knowledge base entry",
		);

	const problemInput = new TextInputBuilder()
		.setCustomId(KB_FIELD_PROBLEM)
		.setStyle(TextInputStyle.Short)
		.setRequired(true)
		.setMaxLength(PROBLEM_MAX_LENGTH)
		.setPlaceholder("The user-facing question or issue");
	if (entry) problemInput.setValue(entry.value.problem);

	const solutionInput = new TextInputBuilder()
		.setCustomId(KB_FIELD_SOLUTION)
		.setStyle(TextInputStyle.Paragraph)
		.setRequired(true)
		.setMaxLength(SOLUTION_MAX_LENGTH)
		.setPlaceholder("The answer or fix for the problem");
	if (entry) solutionInput.setValue(entry.value.solution);

	const notesInput = new TextInputBuilder()
		.setCustomId(KB_FIELD_NOTES)
		.setStyle(TextInputStyle.Paragraph)
		.setRequired(false)
		.setMaxLength(NOTES_MAX_LENGTH)
		.setPlaceholder("Optional extra context for the assistant to draw on");
	if (entry?.value.notes) notesInput.setValue(entry.value.notes);

	return modal.addLabelComponents(
		new LabelBuilder().setLabel("Problem").setTextInputComponent(problemInput),
		new LabelBuilder()
			.setLabel("Solution")
			.setTextInputComponent(solutionInput),
		new LabelBuilder()
			.setLabel("Notes")
			.setDescription("Optional")
			.setTextInputComponent(notesInput),
	);
}

function entryContent(
	entry: SupportEntry,
	index: number,
	total: number,
): string {
	const lines = [
		`**Knowledge base — entry ${index + 1} of ${total}**`,
		"",
		"**Problem**",
		entry.problem,
		"",
		"**Solution**",
		entry.solution,
	];
	if (entry.notes) {
		lines.push("", "**Notes**", entry.notes);
	}
	return lines.join("\n");
}

// Builds the paginated list view: the entry at `index` plus prev/next buttons
// that carry the neighbouring index in their custom id.
export function buildListView(entries: SupportEntry[], index: number) {
	if (entries.length === 0) {
		return [
			new ContainerBuilder()
				.setAccentColor(StatusColor.Neutral)
				.addTextDisplayComponents(
					new TextDisplayBuilder().setContent(
						"**Knowledge base**\nNo entries yet. Use `/knowledgebase add` to create one.",
					),
				),
		];
	}

	const clamped = Math.min(Math.max(index, 0), entries.length - 1);
	const entry = entries[clamped];

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(buildCustomId(KB_LIST_PREFIX, clamped - 1))
			.setLabel("Previous")
			.setEmoji("◀️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(clamped === 0),
		new ButtonBuilder()
			.setCustomId(buildCustomId(KB_LIST_PREFIX, clamped + 1))
			.setLabel("Next")
			.setEmoji("▶️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(clamped === entries.length - 1),
	);

	return [
		new ContainerBuilder()
			.setAccentColor(StatusColor.Neutral)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					entryContent(entry, clamped, entries.length),
				),
			)
			.addSeparatorComponents(new SeparatorBuilder())
			.addActionRowComponents(row),
	];
}

// Builds the confirmation prompt shown before an entry is deleted.
export function buildDeleteConfirmView(entry: SupportEntry, index: number) {
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId(buildCustomId(KB_DELETE_CONFIRM_PREFIX, index))
			.setLabel("Delete")
			.setStyle(ButtonStyle.Danger),
		new ButtonBuilder()
			.setCustomId(KB_DELETE_CANCEL_ID)
			.setLabel("Cancel")
			.setStyle(ButtonStyle.Secondary),
	);

	return [
		new ContainerBuilder()
			.setAccentColor(StatusColor.Warning)
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					`**Delete this entry?**\n\n**Problem**\n${truncate(entry.problem, 500)}`,
				),
			)
			.addSeparatorComponents(new SeparatorBuilder())
			.addActionRowComponents(row),
	];
}

export function resultMessage(
	knowledgeBaseRefreshed: boolean,
	successText: string,
): { color: StatusColor; content: string } {
	if (knowledgeBaseRefreshed) {
		return { color: StatusColor.Success, content: successText };
	}
	return {
		color: StatusColor.Warning,
		content: `${successText}\n\n:warning: The change was saved and committed, but the live knowledge base couldn't be refreshed just yet — it'll rebuild automatically on the next question.`,
	};
}
