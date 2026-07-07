import { RateLimitManager } from "@sapphire/ratelimits";
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
import type {
	ResponseInputFile,
	ResponseInputImage,
	ResponseInputText,
} from "openai/resources/responses/responses";

const MODEL = "gpt-5-nano";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_MESSAGES = 4;
const MAX_ATTACHMENTS = 4;

// Discord caps the total text across all Components V2 text displays in a
// single message at 4000 characters; stay under that with some margin.
const MAX_TEXT_DISPLAY_LENGTH = 3900;

enum ToolType {
	FILE_SEARCH = "file_search",
}

enum ErrorMessage {
	API_ERROR = "Error in OpenAI API call",
}

const userResponses = new Map<string, string>();
const humanAssistanceThreads = new Set<string>();
const rateLimitManager = new RateLimitManager<string>(
	RATE_LIMIT_WINDOW_MS,
	RATE_LIMIT_MAX_MESSAGES,
);
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
		openAIClient = new OpenAI({
			apiKey: config.openAiApiKey,
			adminAPIKey: config.openAiAdminApiKey,
		});
	}
	return openAIClient;
}

export function cleanResponseText(text: string): string {
	return text
		.replace(/【\d+:\d+†[a-zA-Z]+】/g, "")
		.replace(/\[\^\d+\^\]/g, "")
		.replace(/\[\d+\]/g, "")
		.trim();
}

export function splitContent(content: string, maxLength: number): string[] {
	if (content.length <= maxLength) return [content];

	const chunks: string[] = [];
	let remaining = content;

	while (remaining.length > maxLength) {
		let splitAt = remaining.lastIndexOf("\n\n", maxLength);
		if (splitAt <= 0) splitAt = remaining.lastIndexOf("\n", maxLength);
		if (splitAt <= 0) splitAt = remaining.lastIndexOf(" ", maxLength);
		if (splitAt <= 0) splitAt = maxLength;

		chunks.push(remaining.slice(0, splitAt).trim());
		remaining = remaining.slice(splitAt).trim();
	}

	if (remaining.length) chunks.push(remaining);
	return chunks;
}

type InputContent = ResponseInputText | ResponseInputImage | ResponseInputFile;

function buildInputContent(message: Message): InputContent[] {
	const content: InputContent[] = [];

	if (message.content.length) {
		content.push({ type: "input_text", text: message.content });
	}

	for (const attachment of [...message.attachments.values()].slice(
		0,
		MAX_ATTACHMENTS,
	)) {
		if (attachment.contentType?.startsWith("image/")) {
			content.push({
				type: "input_image",
				image_url: attachment.url,
				detail: "auto",
			});
		} else {
			content.push({
				type: "input_file",
				file_url: attachment.url,
				filename: attachment.name,
			});
		}
	}

	return content;
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

		const rateLimit = rateLimitManager.acquire(threadKey);
		if (rateLimit.limited) {
			await message.reply({
				content: `You're sending messages too quickly. Please wait ${Math.ceil(rateLimit.remainingTime / 1000)}s before trying again.`,
				allowedMentions: { repliedUser: true },
			});
			return;
		}
		rateLimit.consume();

		const openai = getOpenAIClient();

		await message.channel.sendTyping();

		const vectorStoreId = await ensureKnowledgeBaseFile(guildId, openai);

		const guildInstructions = data.instructions[guildId] ?? "";
		const instructions = `${guildInstructions}\n\nThe user you are talking to is '${message.author.displayName} (@${message.author.username})'. The thread you are in is called '${message.channel.name}'.`;

		const previousResponseId = userResponses.get(threadKey);
		const inputContent = buildInputContent(message);
		if (!inputContent.length) return;

		const response = await openai.responses.create({
			model: MODEL,
			instructions,
			input: [{ role: "user", content: inputContent }],
			previous_response_id: previousResponseId,
			tools: [
				{ type: ToolType.FILE_SEARCH, vector_store_ids: [vectorStoreId] },
			],
		});

		userResponses.set(threadKey, response.id);

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

		const cleanedContent = cleanResponseText(response.output_text);
		if (!cleanedContent) {
			const fallbackNote = hasHumanTag
				? " Use the Request Human button below if you'd like to talk to a person instead."
				: "";
			await message.reply({
				components: [
					new TextDisplayBuilder().setContent(
						`Sorry, I wasn't able to generate a response for that. Try rephrasing your question.${fallbackNote}`,
					),
					row,
				],
				allowedMentions: { repliedUser: true },
				flags: MessageFlags.IsComponentsV2,
			});
			return;
		}

		const chunks = splitContent(cleanedContent, MAX_TEXT_DISPLAY_LENGTH);

		for (const [index, chunk] of chunks.entries()) {
			const isLast = index === chunks.length - 1;
			const text = new TextDisplayBuilder().setContent(chunk);
			const components = isLast ? [text, row] : [text];

			if (index === 0) {
				await message.reply({
					components,
					allowedMentions: { repliedUser: true },
					flags: MessageFlags.IsComponentsV2,
				});
			} else {
				await message.channel.send({
					components,
					flags: MessageFlags.IsComponentsV2,
				});
			}
		}
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
