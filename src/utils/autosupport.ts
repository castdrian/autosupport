import { type RateLimit, RateLimitManager } from "@sapphire/ratelimits";
import { config } from "@src/config";
import data from "@src/data.toml";
import {
	clearThreadEscalated,
	clearThreadResponseId,
	getThreadResponseId,
	isThreadEscalated,
	setThreadEscalated,
	setThreadResponseId,
} from "@src/database/db";
import {
	ensureKnowledgeBaseFile,
	invalidateKnowledgeBaseCache,
} from "@utils/fileManager";
import { StatusColor, statusContainer } from "@utils/statusMessage";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type Message,
	MessageFlags,
	SeparatorBuilder,
	TextDisplayBuilder,
} from "discord.js";
import OpenAI from "openai";
import type {
	ResponseInputFile,
	ResponseInputImage,
	ResponseInputText,
} from "openai/resources/responses/responses";

const MODEL = "gpt-5-nano";

const THREAD_RATE_LIMIT_WINDOW_MS = 60_000;
const THREAD_RATE_LIMIT_MAX_MESSAGES = 4;

const USER_RATE_LIMIT_WINDOW_MS = 60_000;
const USER_RATE_LIMIT_MAX_MESSAGES = 8;

export const MAX_ATTACHMENTS = 4;
export const MAX_ATTACHMENT_SIZE_BYTES = 20 * 1024 * 1024;
const UNSUPPORTED_ATTACHMENT_TYPE_PREFIXES = ["video/", "audio/"];

const MAX_TEXT_DISPLAY_LENGTH = 3900;

const TYPING_REFRESH_INTERVAL_MS = 8_000;

enum ToolType {
	FILE_SEARCH = "file_search",
}

enum ErrorMessage {
	API_ERROR = "Error in OpenAI API call",
}

const threadRateLimitManager = new RateLimitManager<string>(
	THREAD_RATE_LIMIT_WINDOW_MS,
	THREAD_RATE_LIMIT_MAX_MESSAGES,
);
const userRateLimitManager = new RateLimitManager<string>(
	USER_RATE_LIMIT_WINDOW_MS,
	USER_RATE_LIMIT_MAX_MESSAGES,
);
let openAIClient: OpenAI | undefined;

function refundRateLimit(rateLimit: RateLimit<string>, limit: number): void {
	if (rateLimit.remaining < limit) rateLimit.remaining++;
}

export function isMissingVectorStoreError(error: unknown): boolean {
	if (!(error instanceof OpenAI.APIError)) return false;
	const message = error.message?.toLowerCase() ?? "";
	return message.includes("vector_store") || message.includes("vector store");
}

export function isStaleResponseIdError(error: unknown): boolean {
	if (!(error instanceof OpenAI.APIError) || error.status !== 404) return false;
	if (error.param === "previous_response_id") return true;
	const message = error.message?.toLowerCase() ?? "";
	return message.includes("previous_response_id");
}

export async function addHumanAssistanceThread(
	guildId: string,
	threadId: string,
): Promise<void> {
	await setThreadEscalated(guildId, threadId);
}

export async function hasRequestedHumanAssistance(
	threadId: string,
): Promise<boolean> {
	return isThreadEscalated(threadId);
}

export async function removeHumanAssistanceThread(
	threadId: string,
): Promise<void> {
	await clearThreadEscalated(threadId);
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

interface BuiltInputContent {
	content: InputContent[];
	droppedAttachments: number;
}

export function buildInputContent(message: Message): BuiltInputContent {
	const content: InputContent[] = [];
	let droppedAttachments = 0;
	let includedAttachments = 0;

	if (message.content.length) {
		content.push({ type: "input_text", text: message.content });
	}

	for (const attachment of message.attachments.values()) {
		if (
			includedAttachments >= MAX_ATTACHMENTS ||
			attachment.size > MAX_ATTACHMENT_SIZE_BYTES ||
			UNSUPPORTED_ATTACHMENT_TYPE_PREFIXES.some((prefix) =>
				attachment.contentType?.startsWith(prefix),
			)
		) {
			droppedAttachments++;
			continue;
		}

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
		includedAttachments++;
	}

	return { content, droppedAttachments };
}

export async function getResponse(message: Message) {
	let threadRateLimit: RateLimit<string> | undefined;
	let userRateLimit: RateLimit<string> | undefined;
	let consumedRateLimits = false;
	let typingInterval: ReturnType<typeof setInterval> | undefined;
	let deliveredChunks = 0;

	try {
		if (!message.content.length && !message.attachments.size) return;
		if (!message.inGuild()) return;
		if (!message.channel.isThread()) return;
		if (!message.channel.parent?.isThreadOnly()) return;

		if (await hasRequestedHumanAssistance(message.channelId)) return;

		const guildId = message.guildId;
		const userId = message.author.id;
		const threadKey = `${guildId}-${userId}-${message.channelId}`;
		const userKey = `${guildId}-${userId}`;

		threadRateLimit = threadRateLimitManager.acquire(threadKey);
		userRateLimit = userRateLimitManager.acquire(userKey);

		if (threadRateLimit.limited || userRateLimit.limited) {
			const limited = threadRateLimit.limited ? threadRateLimit : userRateLimit;
			const scope = threadRateLimit.limited
				? "in this thread"
				: "across your open threads";
			await message.reply({
				components: [
					statusContainer(
						StatusColor.Warning,
						`You're sending messages too quickly ${scope}. Please wait ${Math.ceil(limited.remainingTime / 1000)}s before trying again.`,
					),
				],
				allowedMentions: { repliedUser: true },
				flags: MessageFlags.IsComponentsV2,
			});
			return;
		}
		threadRateLimit.consume();
		userRateLimit.consume();
		consumedRateLimits = true;

		const openai = getOpenAIClient();

		await message.channel.sendTyping();
		typingInterval = setInterval(() => {
			message.channel.sendTyping().catch(() => null);
		}, TYPING_REFRESH_INTERVAL_MS);

		const vectorStoreId = await ensureKnowledgeBaseFile(guildId, openai);

		const guildInstructions = data.instructions[guildId] ?? "";
		const instructions = `${guildInstructions}\n\nThe user you are talking to is '${message.author.displayName} (@${message.author.username})'. The thread you are in is called '${message.channel.name}'.`;

		const previousResponseId = await getThreadResponseId(
			guildId,
			userId,
			message.channelId,
		);
		const { content: inputContent, droppedAttachments } =
			buildInputContent(message);
		if (!inputContent.length) {
			await message.reply({
				components: [
					statusContainer(
						StatusColor.Warning,
						"Sorry, I couldn't process that message — the attachment(s) were too large or an unsupported type. Try a smaller file or a common image format.",
					),
				],
				allowedMentions: { repliedUser: true },
				flags: MessageFlags.IsComponentsV2,
			});
			return;
		}

		const response = await openai.responses.create({
			model: MODEL,
			instructions,
			input: [{ role: "user", content: inputContent }],
			previous_response_id: previousResponseId,
			tools: [
				{ type: ToolType.FILE_SEARCH, vector_store_ids: [vectorStoreId] },
			],
		});

		await setThreadResponseId(
			guildId,
			userId,
			message.channelId,
			response.id,
		).catch((persistError) =>
			message.client.logger.error(
				`Failed to persist thread response id for thread ${message.channelId}: ${persistError}`,
			),
		);

		const hasHumanTag = message.channel.parent.availableTags.find((tag) =>
			tag.name.toLowerCase().includes("human"),
		)?.id;

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel("Close Thread")
				.setEmoji("✅")
				.setStyle(ButtonStyle.Success)
				.setCustomId("close_thread"),
		);

		if (hasHumanTag) {
			row.addComponents(
				new ButtonBuilder()
					.setLabel("Request Human")
					.setEmoji("🙋")
					.setStyle(ButtonStyle.Danger)
					.setCustomId("request_human"),
			);
		}

		const droppedAttachmentsNote =
			droppedAttachments > 0
				? `_Note: ${droppedAttachments} attachment${droppedAttachments === 1 ? " was" : "s were"} skipped (unsupported type, too large, or the ${MAX_ATTACHMENTS}-attachment limit was reached)._`
				: "";

		const cleanedContent = cleanResponseText(response.output_text);
		if (!cleanedContent) {
			const fallbackNote = hasHumanTag
				? " Use the Request Human button below if you'd like to talk to a person instead."
				: "";
			const components: (TextDisplayBuilder | SeparatorBuilder)[] = [
				new TextDisplayBuilder().setContent(
					`Sorry, I wasn't able to generate a response for that. Try rephrasing your question.${fallbackNote}`,
				),
			];
			if (droppedAttachmentsNote) {
				components.push(
					new SeparatorBuilder(),
					new TextDisplayBuilder().setContent(droppedAttachmentsNote),
				);
			}
			await message.reply({
				components: [...components, row],
				allowedMentions: { repliedUser: true },
				flags: MessageFlags.IsComponentsV2,
			});
			return;
		}

		const chunks = splitContent(cleanedContent, MAX_TEXT_DISPLAY_LENGTH);

		for (const [index, chunk] of chunks.entries()) {
			const isLast = index === chunks.length - 1;
			const components: (
				| TextDisplayBuilder
				| SeparatorBuilder
				| ActionRowBuilder<ButtonBuilder>
			)[] = [new TextDisplayBuilder().setContent(chunk)];

			if (isLast) {
				if (droppedAttachmentsNote) {
					components.push(
						new SeparatorBuilder(),
						new TextDisplayBuilder().setContent(droppedAttachmentsNote),
					);
				}
				components.push(row);
			}

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
			deliveredChunks++;
		}
	} catch (error) {
		if (consumedRateLimits && deliveredChunks === 0) {
			if (threadRateLimit) {
				refundRateLimit(threadRateLimit, threadRateLimitManager.limit);
			}
			if (userRateLimit) {
				refundRateLimit(userRateLimit, userRateLimitManager.limit);
			}
		}

		message.client.logger.error(`${ErrorMessage.API_ERROR}: ${error}`);

		if (deliveredChunks > 0 && message.channel.isThread()) {
			await message.channel
				.send({
					components: [
						statusContainer(
							StatusColor.Warning,
							"The rest of my reply couldn't be sent. If it looks cut off, try asking again.",
						),
					],
					flags: MessageFlags.IsComponentsV2,
				})
				.catch((sendError: unknown) =>
					message.client.logger.error(
						`Failed to send partial-failure notice for thread ${message.channelId}: ${sendError}`,
					),
				);
			return undefined;
		}

		let replyContent =
			"Sorry, I encountered an error while processing your request.";
		if (isMissingVectorStoreError(error) && message.guildId) {
			await invalidateKnowledgeBaseCache(message.guildId).catch(
				(invalidateError) =>
					message.client.logger.error(
						`Failed to invalidate knowledge base cache for guild ${message.guildId}: ${invalidateError}`,
					),
			);
			replyContent =
				"Sorry, I had trouble accessing the knowledge base for this server. It's been reset and should rebuild automatically — please try again in a moment.";
		} else if (isStaleResponseIdError(error) && message.guildId) {
			await clearThreadResponseId(
				message.guildId,
				message.author.id,
				message.channelId,
			).catch((clearError) =>
				message.client.logger.error(
					`Failed to clear stale response id for thread ${message.channelId}: ${clearError}`,
				),
			);
			replyContent =
				"Sorry, I lost track of this conversation (it may have expired). I've reset it — please try your message again.";
		} else if (error instanceof OpenAI.APIError && error.status === 429) {
			replyContent =
				error.code === "insufficient_quota"
					? "Sorry, the OpenAI account has run out of credits. An admin needs to top up billing before I can respond."
					: "Sorry, I'm being rate limited right now. Please try again in a moment.";
		}

		await message.reply({
			components: [statusContainer(StatusColor.Danger, replyContent)],
			allowedMentions: { repliedUser: true },
			flags: MessageFlags.IsComponentsV2,
		});
		return undefined;
	} finally {
		if (typingInterval) clearInterval(typingInterval);
	}
}
