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

		const file = await client.files.create({
			file: createReadStream(tempFilePath),
			purpose: FilePurpose.ASSISTANTS,
		});

		const vectorStore = await client.vectorStores.create({
			name: guildId,
		});

		await client.vectorStores.fileBatches.create(vectorStore.id, {
			file_ids: [file.id],
		});

		await fs.unlink(tempFilePath);

		managedVectorStores.set(guildId, vectorStore.id);
		return vectorStore.id;
	} catch (error) {
		console.error(`${ErrorMessage.VECTOR_STORE_ERROR}:`, error);
		throw error;
	}
}
