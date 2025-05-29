import { config } from "@src/config";
import data from "@src/data.toml";
import { ensureKnowledgeBaseFile } from "@utils/fileManager";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Message,
	MessageFlags,
	TextDisplayBuilder,
} from "discord.js";
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
const humanAssistanceThreads = new Set<string>();

export function addHumanAssistanceThread(threadId: string): void {
	humanAssistanceThreads.add(threadId);
}

export function hasRequestedHumanAssistance(threadId: string): boolean {
	return humanAssistanceThreads.has(threadId);
}

export function removeHumanAssistanceThread(threadId: string): void {
	humanAssistanceThreads.delete(threadId);
}

async function getOpenAIClient(guildId: string): Promise<OpenAI> {
	if (!openAIClients.has(guildId)) {
		const apiKey = config.openAiApiKey[guildId];
		if (!apiKey) {
			throw new Error(`${ErrorMessage.MISSING_CLIENT}: ${guildId}`);
		}

		const openai = new OpenAI({ apiKey });
		openAIClients.set(guildId, openai);

		const assistantId = config.openAiAssistantId[guildId];
		if (assistantId && data.instructions && data.instructions[guildId]) {
			try {
				await openai.beta.assistants.update(assistantId, {
					instructions: data.instructions[guildId],
				});
				console.log(
					`Updated assistant ${assistantId} with custom instructions for guild ${guildId}`,
				);
			} catch (error) {
				console.error(`Failed to update assistant instructions: ${error}`);
			}
		}
	}
	return openAIClients.get(guildId)!;
}

function cleanResponseText(text: string): string {
	return text
		.replace(/【\d+:\d+†[a-zA-Z]+】/g, "")
		.replace(/\[\^\d+\^\]/g, "")
		.replace(/\[\d+\]/g, "")
		.trim();
}

export async function getResponse(message: Message) {
	try {
		if (!message.content.length && !message.attachments.size) return;
		if (!message.inGuild()) return;
		if (!message.channel.isThread()) return;
		if (!message.channel.parent?.isThreadOnly()) return;

		if (hasRequestedHumanAssistance(message.channelId)) return;

		const guildId = message.guildId;
		const userId = message.author.id;
		const threadKey = `${guildId}-${userId}-${message.channelId}`;

		const openai = await getOpenAIClient(guildId);

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
			additional_instructions: `The user you are talking to is '${message.author.displayName} (@${message.author.username})'. The thread you are in is called '${message.channel.name}'.`,
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

			const cleanedContent = cleanResponseText(content);

			const text = new TextDisplayBuilder().setContent(cleanedContent);

			const hasHumanTag = message.channel.parent.availableTags.find((tag) =>
				tag.name.toLowerCase().includes("human"),
			)?.id;

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel("Close Thread")
					.setStyle(ButtonStyle.Success)
					.setCustomId("close_thread"),
			);

			if (hasHumanTag) {
				row.addComponents(
					new ButtonBuilder()
						.setLabel("Request Human")
						.setStyle(ButtonStyle.Danger)
						.setCustomId("request_human"),
				);
			}

			await message.reply({
				components: [text, row],
				allowedMentions: { repliedUser: true },
				flags: MessageFlags.IsComponentsV2,
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
