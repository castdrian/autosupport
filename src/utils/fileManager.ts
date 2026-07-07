import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import data from "@src/data.toml";
import {
	clearKnowledgeBaseState,
	getKnowledgeBaseState,
	setKnowledgeBaseState,
} from "@src/database/db";
import type OpenAI from "openai";

enum FilePurpose {
	ASSISTANTS = "assistants",
}

enum ErrorMessage {
	NO_SUPPORT_DATA = "No support data found for guild",
	FILE_CREATION_ERROR = "Error creating knowledge base file",
	VECTOR_STORE_ERROR = "Error managing vector store",
}

const managedVectorStores = new Map<string, Promise<string>>();

async function getVectorStoreFiles(client: OpenAI, vectorStoreId: string) {
	try {
		const response = await client.vectorStores.files.list(vectorStoreId);
		return response;
	} catch (error) {
		console.warn(`Error listing vector store files: ${error}`);
		return { data: [] };
	}
}

// client.vectorStores.list() only returns one page (20 items) by default.
// The SDK's list result is an async iterable that transparently fetches
// further pages on demand, so iterate rather than reading .data directly —
// otherwise a store past the first page would never be found, causing
// duplicate creation on rebuild and silently-failed cleanup on delete.
async function findVectorStoreByName(client: OpenAI, name: string) {
	for await (const store of client.vectorStores.list()) {
		if (store.name === name) return store;
	}
	return undefined;
}

async function deleteVectorStoreFiles(client: OpenAI, vectorStoreId: string) {
	try {
		const files = await getVectorStoreFiles(client, vectorStoreId);

		for (const file of files.data || []) {
			try {
				await client.vectorStores.files.delete(file.id, {
					vector_store_id: vectorStoreId,
				});
			} catch (error) {
				console.warn(`Failed to delete file ${file.id}: ${error}`);
			}
		}
	} catch (error) {
		console.warn(`Error deleting vector store files: ${error}`);
	}
}

export function normalizeSupportData(
	supportData: (typeof data.support)[string],
) {
	return supportData.map((item) => ({
		problem: item.problem,
		solution: item.solution,
		notes: item.notes || null,
	}));
}

export function hashSupportData(
	normalized: ReturnType<typeof normalizeSupportData>,
) {
	return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

async function buildKnowledgeBaseFile(
	guildId: string,
	client: OpenAI,
	normalizedSupportData: ReturnType<typeof normalizeSupportData>,
): Promise<string> {
	const fileName = `${guildId}.json`;
	const tempFilePath = path.join(process.cwd(), fileName);

	const jsonContent = JSON.stringify(
		{ support: { [guildId]: normalizedSupportData } },
		null,
		2,
	);

	await fs.writeFile(tempFilePath, jsonContent);

	let vectorStoreId: string;

	const existingVectorStore = await findVectorStoreByName(client, guildId);

	if (existingVectorStore) {
		vectorStoreId = existingVectorStore.id;
		await deleteVectorStoreFiles(client, vectorStoreId);
	} else {
		const vectorStore = await client.vectorStores.create({
			name: guildId,
		});
		vectorStoreId = vectorStore.id;
	}

	const file = await client.files.create({
		file: createReadStream(tempFilePath),
		purpose: FilePurpose.ASSISTANTS,
	});

	const batch = await client.vectorStores.fileBatches.createAndPoll(
		vectorStoreId,
		{
			file_ids: [file.id],
		},
	);

	if (batch.status !== "completed" || batch.file_counts.failed > 0) {
		throw new Error(
			`Vector store file batch did not complete successfully for guild ${guildId}: status=${batch.status}, failed=${batch.file_counts.failed}`,
		);
	}

	await fs.unlink(tempFilePath);

	return vectorStoreId;
}

async function resolveKnowledgeBaseFile(
	guildId: string,
	client: OpenAI,
): Promise<string> {
	const supportData = data.support[guildId];
	if (!supportData || !supportData.length) {
		throw new Error(`${ErrorMessage.NO_SUPPORT_DATA}: ${guildId}`);
	}

	const normalized = normalizeSupportData(supportData);
	const currentHash = hashSupportData(normalized);

	const persisted = await getKnowledgeBaseState(guildId);
	if (persisted && persisted.contentHash === currentHash) {
		return persisted.vectorStoreId;
	}

	const vectorStoreId = await buildKnowledgeBaseFile(
		guildId,
		client,
		normalized,
	);
	await setKnowledgeBaseState(guildId, {
		vectorStoreId,
		contentHash: currentHash,
	});
	return vectorStoreId;
}

// Caches the in-flight build promise (not just the finished result) so
// concurrent calls for the same guild before the first build completes
// await the same build instead of racing to create duplicate vector stores.
// The build itself is skipped entirely (no OpenAI calls at all) when the
// guild's support data hasn't changed since the last persisted build.
export function ensureKnowledgeBaseFile(
	guildId: string,
	client: OpenAI,
): Promise<string> {
	const existing = managedVectorStores.get(guildId);
	if (existing) return existing;

	const buildPromise = resolveKnowledgeBaseFile(guildId, client).catch(
		(error) => {
			managedVectorStores.delete(guildId);
			console.error(`${ErrorMessage.VECTOR_STORE_ERROR}:`, error);
			throw error;
		},
	);

	managedVectorStores.set(guildId, buildPromise);
	return buildPromise;
}

// Forgets everything about a guild's knowledge base build so the next call
// to ensureKnowledgeBaseFile does a full rebuild. Use when the cached vector
// store ID turns out to be stale (e.g. it was deleted out-of-band).
export async function invalidateKnowledgeBaseCache(
	guildId: string,
): Promise<void> {
	managedVectorStores.delete(guildId);
	await clearKnowledgeBaseState(guildId);
}

export async function deleteKnowledgeBaseFile(
	guildId: string,
	client: OpenAI,
): Promise<void> {
	// If a build is already in flight for this guild, let it finish first so
	// we clean up whatever it actually produces instead of racing it — the
	// in-flight build's own state writes would otherwise land after cleanup
	// runs and leave a fresh, never-cleaned-up vector store behind.
	const inFlight = managedVectorStores.get(guildId);
	managedVectorStores.delete(guildId);
	if (inFlight) await inFlight.catch(() => null);

	const existingVectorStore = await findVectorStoreByName(client, guildId);
	if (!existingVectorStore) return;

	await deleteVectorStoreFiles(client, existingVectorStore.id);
	await client.vectorStores.delete(existingVectorStore.id);
}
