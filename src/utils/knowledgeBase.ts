import data from "@src/data.toml";
import { getOpenAIClient } from "@utils/autosupport";
import {
	ensureKnowledgeBaseFile,
	invalidateKnowledgeBaseCache,
} from "@utils/fileManager";
import { commitDataFile } from "@utils/githubCommit";
import { serializeDataToml } from "@utils/tomlSerializer";

export interface SupportEntryInput {
	problem: string;
	solution: string;
	notes?: string;
}

export type SupportEntry = (typeof data.support)[string][number];

export function getSupportEntries(guildId: string): SupportEntry[] {
	return data.support[guildId] ?? [];
}

export function getSupportEntry(
	guildId: string,
	index: number,
): SupportEntry | undefined {
	return getSupportEntries(guildId)[index];
}

function normalizeInput(input: SupportEntryInput): SupportEntry {
	const notes = input.notes?.trim();
	const entry: SupportEntry = {
		problem: input.problem.trim(),
		solution: input.solution.trim(),
	};
	if (notes) entry.notes = notes;
	return entry;
}

// Persists a new set of entries for a guild: mutates the in-memory data object
// (so the running bot sees the change without a restart), commits the file to
// GitHub with [skip ci], then rebuilds the OpenAI vector store. If the commit
// fails the in-memory change is rolled back. The returned flag reports whether
// the OpenAI knowledge base was refreshed successfully — the commit and live
// data are already consistent even when it is false, and the store rebuilds on
// the next inbound message.
async function persistEntries(
	guildId: string,
	nextEntries: SupportEntry[],
	commitMessage: string,
): Promise<{ knowledgeBaseRefreshed: boolean }> {
	const previous = data.support[guildId];
	data.support[guildId] = nextEntries;

	try {
		await commitDataFile(serializeDataToml(data), commitMessage);
	} catch (error) {
		if (previous) {
			data.support[guildId] = previous;
		} else {
			delete data.support[guildId];
		}
		throw error;
	}

	let knowledgeBaseRefreshed = false;
	try {
		await invalidateKnowledgeBaseCache(guildId);
		if (nextEntries.length > 0) {
			await ensureKnowledgeBaseFile(guildId, getOpenAIClient());
		}
		knowledgeBaseRefreshed = true;
	} catch {
		knowledgeBaseRefreshed = false;
	}

	return { knowledgeBaseRefreshed };
}

export function addSupportEntry(guildId: string, input: SupportEntryInput) {
	const nextEntries = [...getSupportEntries(guildId), normalizeInput(input)];
	return persistEntries(
		guildId,
		nextEntries,
		"chore: add knowledge base entry [skip ci]",
	);
}

export function updateSupportEntry(
	guildId: string,
	index: number,
	input: SupportEntryInput,
) {
	const entries = getSupportEntries(guildId);
	if (index < 0 || index >= entries.length) {
		throw new RangeError(`No knowledge base entry at index ${index}`);
	}
	const nextEntries = entries.map((entry, i) =>
		i === index ? normalizeInput(input) : entry,
	);
	return persistEntries(
		guildId,
		nextEntries,
		"chore: update knowledge base entry [skip ci]",
	);
}

export function deleteSupportEntry(guildId: string, index: number) {
	const entries = getSupportEntries(guildId);
	if (index < 0 || index >= entries.length) {
		throw new RangeError(`No knowledge base entry at index ${index}`);
	}
	const nextEntries = entries.filter((_, i) => i !== index);
	return persistEntries(
		guildId,
		nextEntries,
		"chore: delete knowledge base entry [skip ci]",
	);
}
