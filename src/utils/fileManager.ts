import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import data from "@src/data.toml";
import type OpenAI from "openai";

enum FilePurpose {
	ASSISTANTS = "assistants",
}

enum ErrorMessage {
	NO_SUPPORT_DATA = "No support data found for guild",
	FILE_CREATION_ERROR = "Error creating knowledge base file",
	VECTOR_STORE_ERROR = "Error managing vector store",
}

const managedVectorStores = new Map<string, string>();

async function getVectorStoreFiles(client: OpenAI, vectorStoreId: string) {
	try {

		const response = (await client.vectorStores.files.list(vectorStoreId));
		return response;
	} catch (error) {
		console.warn(`Error listing vector store files: ${error}`);
		return { data: [] };
	}
}

async function deleteVectorStoreFiles(client: OpenAI, vectorStoreId: string) {
	try {
		const files = await getVectorStoreFiles(client, vectorStoreId);

		for (const file of files.data || []) {
			try {
				await client.vectorStores.files.del(vectorStoreId, file.id);
			} catch (error) {
				console.warn(`Failed to delete file ${file.id}: ${error}`);
			}
		}
	} catch (error) {
		console.warn(`Error deleting vector store files: ${error}`);
	}
}

export async function ensureKnowledgeBaseFile(
	guildId: string,
	client: OpenAI,
): Promise<string> {
	if (managedVectorStores.has(guildId)) {
		return managedVectorStores.get(guildId)!;
	}

	try {
		const supportData = data.support[guildId];
		if (!supportData || !supportData.length) {
			throw new Error(`${ErrorMessage.NO_SUPPORT_DATA}: ${guildId}`);
		}

		const fileName = `${guildId}.json`;
		const tempFilePath = path.join(process.cwd(), fileName);

		const jsonContent = JSON.stringify(
			{
				support: {
					[guildId]: supportData.map((item) => ({
						problem: item.problem,
						solution: item.solution,
						notes: item.notes || null,
					})),
				},
			},
			null,
			2,
		);

		await fs.writeFile(tempFilePath, jsonContent);

		let vectorStoreId: string;
		let hasExistingVectorStore = false;

		const vectorStores = await client.vectorStores.list();
		const existingVectorStore = vectorStores.data.find(
			(store) => store.name === guildId,
		);

		if (existingVectorStore) {
			vectorStoreId = existingVectorStore.id;
			hasExistingVectorStore = true;

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

		await client.vectorStores.fileBatches.create(vectorStoreId, {
			file_ids: [file.id],
		});

		await fs.unlink(tempFilePath);

		managedVectorStores.set(guildId, vectorStoreId);
		return vectorStoreId;
	} catch (error) {
		console.error(`${ErrorMessage.VECTOR_STORE_ERROR}:`, error);
		throw error;
	}
}
