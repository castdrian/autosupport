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

const MODEL = "gpt-4.1-nano";

enum ToolType {
	FILE_SEARCH = "file_search",
}

enum ErrorMessage {
	API_ERROR = "Error in OpenAI API call",
}

const userResponses = new Map<string, string>();
const humanAssistanceThreads = new Set<string>();
let openAIClient: OpenAI | undefined;

export function addHumanAssistanceThread(threadId: string): void {
	humanAssistanceThreads.add(threadId);
}

export function hasRequestedHumanAssistance(threadId: string): boolean {
	return humanAssistanceThreads.has(threadId);
}

export function removeHumanAssistanceThread(threadId: string): void {
	humanAssistanceThreads.delete(threadId);
}

export function getOpenAIClient(): OpenAI {
	if (!openAIClient) {
		openAIClient = new OpenAI({ apiKey: config.openAiApiKey });
	}
	return openAIClient;
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

		const openai = getOpenAIClient();

		await message.channel.sendTyping();

		const vectorStoreId = await ensureKnowledgeBaseFile(guildId, openai);

		const guildInstructions = data.instructions[guildId] ?? "";
		const instructions = `${guildInstructions}\n\nThe user you are talking to is '${message.author.displayName} (@${message.author.username})'. The thread you are in is called '${message.channel.name}'.`;

		const previousResponseId = userResponses.get(threadKey);

		const response = await openai.responses.create({
			model: MODEL,
			instructions,
			input: message.content,
			previous_response_id: previousResponseId,
			tools: [
				{ type: ToolType.FILE_SEARCH, vector_store_ids: [vectorStoreId] },
			],
		});

		userResponses.set(threadKey, response.id);

		const cleanedContent = cleanResponseText(response.output_text);
		if (!cleanedContent) return;

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
	} catch (error) {
		message.client.logger.error(`${ErrorMessage.API_ERROR}: ${error}`);

		let replyContent =
			"Sorry, I encountered an error while processing your request.";
		if (error instanceof OpenAI.APIError && error.status === 429) {
			replyContent =
				error.code === "insufficient_quota"
					? "Sorry, the OpenAI account has run out of credits. An admin needs to top up billing before I can respond."
					: "Sorry, I'm being rate limited right now. Please try again in a moment.";
		}

		await message.reply({
			content: replyContent,
			allowedMentions: { repliedUser: true },
		});
		return undefined;
	}
}
