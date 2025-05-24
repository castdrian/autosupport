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
	FILE_RETRIEVAL_ERROR = "Error retrieving file content",
}

const managedFiles = new Map<string, string>();

export async function ensureKnowledgeBaseFile(
	guildId: string,
	client: OpenAI,
): Promise<string> {
	if (managedFiles.has(guildId)) {
		return managedFiles.get(guildId)!;
	}

	try {
		const supportData = data.support[guildId];
		if (!supportData || !supportData.length) {
			throw new Error(`${ErrorMessage.NO_SUPPORT_DATA}: ${guildId}`);
		}

		const fileName = `${guildId}.json`;
		const tempFilePath = path.join(process.cwd(), fileName);

		const jsonContent = JSON.stringify({
			support: {
				[guildId]: supportData.map((item) => ({
					problem: item.problem,
					solution: item.solution,
					notes: item.notes || null,
				})),
			},
		});

		await fs.writeFile(tempFilePath, jsonContent);

		const files = await client.files.list();
		const existingFile = files.data.find((file) => file.filename === fileName);

		let fileId: string;

		if (existingFile) {
			let contentMatches = false;

			try {
				const fileContent = await client.files.content(existingFile.id);
				const existingContent = await fileContent.text();

				const parsedExisting = JSON.parse(existingContent);
				const parsedNew = JSON.parse(jsonContent);
				contentMatches =
					JSON.stringify(parsedExisting) === JSON.stringify(parsedNew);
			} catch (error) {
				console.warn(`${ErrorMessage.FILE_RETRIEVAL_ERROR}: ${error}`);
				contentMatches = false;
			}

			if (!contentMatches) {
				await client.files.del(existingFile.id);
				const file = await client.files.create({
					file: createReadStream(tempFilePath),
					purpose: FilePurpose.ASSISTANTS,
				});
				fileId = file.id;
			} else {
				fileId = existingFile.id;
			}
		} else {
			const file = await client.files.create({
				file: createReadStream(tempFilePath),
				purpose: FilePurpose.ASSISTANTS,
			});
			fileId = file.id;
		}

		await fs.unlink(tempFilePath);

		managedFiles.set(guildId, fileId);
		return fileId;
	} catch (error) {
		console.error(`${ErrorMessage.FILE_CREATION_ERROR}:`, error);
		throw error;
	}
}
