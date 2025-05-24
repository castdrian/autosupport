import { config } from "@src/config";
import { ensureKnowledgeBaseFile } from "@utils/fileManager";
import { type Message, MessageFlags } from "discord.js";
import OpenAI from "openai";

enum Role {
	USER = "user",
	ASSISTANT = "assistant",
}

enum ToolType {
	FILE_SEARCH = "file_search",
}

enum MessageType {
	TEXT = "text",
}

enum ErrorMessage {
	MISSING_CLIENT = "OpenAI client not available for guild",
	MISSING_ASSISTANT = "Assistant ID not configured for guild",
	API_ERROR = "Error in OpenAI API call",
}

const userThreads = new Map<string, string>();
const openAIClients = new Map<string, OpenAI>();

function getOpenAIClient(guildId: string): OpenAI {
	if (!openAIClients.has(guildId)) {
		const apiKey = config.openAiApiKey[guildId];
		if (!apiKey) {
			throw new Error(`${ErrorMessage.MISSING_CLIENT}: ${guildId}`);
		}

		openAIClients.set(guildId, new OpenAI({ apiKey }));
	}
	return openAIClients.get(guildId)!;
}

export async function getResponse(message: Message) {
	try {
		if (!message.content.length && !message.attachments.size) return;
		if (!message.inGuild()) return;

		const guildId = message.guildId;
		const userId = message.author.id;
		const threadKey = `${guildId}-${userId}-${message.channelId}`;

		const openai = getOpenAIClient(guildId);

		const assistantId = config.openAiAssistantId[guildId];
		if (!assistantId) {
			throw new Error(`${ErrorMessage.MISSING_ASSISTANT}: ${guildId}`);
		}

		await message.channel.sendTyping();

		const vectorStoreId = await ensureKnowledgeBaseFile(guildId, openai);

		let threadId = userThreads.get(threadKey);

		if (!threadId) {
			const thread = await openai.beta.threads.create({
				tool_resources: {
					file_search: {
						vector_store_ids: [vectorStoreId],
					},
				},
			});
			threadId = thread.id;
			userThreads.set(threadKey, threadId);
		}

		await openai.beta.threads.messages.create(threadId, {
			role: Role.USER,
			content: message.content,
		});

		const run = await openai.beta.threads.runs.create(threadId, {
			assistant_id: assistantId,
			tools: [{ type: ToolType.FILE_SEARCH }],
			additional_instructions: `The user you are talking to is '${message.author.displayName} (@${message.author.username})'. Use the file search tool to find relevant information from the knowledge base.`,
		});

		const completedRun = await openai.beta.threads.runs.poll(threadId, run.id, {
			pollIntervalMs: 500,
		});

		const messages = await openai.beta.threads.messages.list(threadId);
		const assistantMessages = messages.data.filter(
			(msg) => msg.role === Role.ASSISTANT && msg.run_id === completedRun.id,
		);

		if (assistantMessages.length > 0) {
			const latestMessage = assistantMessages[0];
			const content = latestMessage.content
				.filter((item) => item.type === MessageType.TEXT)
				.map((item) => (item.type === MessageType.TEXT ? item.text.value : ""))
				.join("\n");

			await message.reply({
				content,
				allowedMentions: { repliedUser: true },
			});
		}
	} catch (error) {
		message.client.logger.error(`${ErrorMessage.API_ERROR}: ${error}`);
		await message.reply({
			content: "Sorry, I encountered an error while processing your request.",
			allowedMentions: { repliedUser: true },
		});
		return undefined;
	}
}
