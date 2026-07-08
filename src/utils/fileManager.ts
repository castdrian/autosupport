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

	try {
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

		return vectorStoreId;
	} finally {
		await fs.unlink(tempFilePath).catch(() => null);
	}
}

async function resolveKnowledgeBaseFile(
	guildId: string,
	client: OpenAI,
): Promise<string> {
	const supportData = data.support[guildId];
	if (!supportData?.length) {
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
	const inFlight = managedVectorStores.get(guildId);
	managedVectorStores.delete(guildId);
	if (inFlight) await inFlight.catch(() => null);

	const existingVectorStore = await findVectorStoreByName(client, guildId);
	if (!existingVectorStore) return;

	await deleteVectorStoreFiles(client, existingVectorStore.id);
	await client.vectorStores.delete(existingVectorStore.id);
}
