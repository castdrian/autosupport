import { config, responseCache } from "@src/config";
import { getMinimumConfidence } from "@src/database/db";
import { type Intent, witMessage } from "@utils/wit";
import { Collection, type Message } from "discord.js";
import { createWorker } from "tesseract.js";

function getHighestConfidenceIntent(
	intents: Intent[],
	minimumConfidence: number,
): Intent | undefined {
	if (!intents.length) return undefined;

	const highestConfidenceIntent = intents.reduce((prev, current) =>
		prev.confidence > current.confidence ? prev : current,
	);

	return highestConfidenceIntent.confidence >= minimumConfidence
		? highestConfidenceIntent
		: undefined;
}

export async function getResponse(message: Message) {
	try {
		if (!message.content.length && !message.attachments.size) return;
		if (!message.inGuild()) return;
		let imageText = "";

		const attachment = message.attachments.first();

		if (attachment?.contentType?.startsWith("image")) {
			const worker = await createWorker("eng");
			const ret = await worker.recognize(attachment.url);
			await worker.terminate();
			imageText = ret.data.text;
		}

		const res = await witMessage(
			`${message.content}\n${imageText}`,
			config.witAiServerToken[message.guildId],
		);

		if (!res.intents.length) return;
		const selectedIntent = getHighestConfidenceIntent(
			res.intents,
			await getMinimumConfidence(message.guildId),
		);

		if (selectedIntent) {
			await message.channel.sendTyping();

			const responseContent = getResponseContent(
				selectedIntent.name,
				message.guildId,
			);
			if (responseContent)
				await message.reply({
					content: `${responseContent.trim()}${config.devGuildId ? `\n-# triggered intent ${selectedIntent.name} with ${(selectedIntent.confidence * 100).toFixed(2)}% confidence` : ""}`,
					allowedMentions: { repliedUser: true },
				});
		}
	} catch (error) {
		message.client.logger.error(error);
		return undefined;
	}
}

export function getResponseContent(intentName: string, guildId: string) {
	if (config.devGuildId) {
		const aggregatedResponses = new Collection<string, string>();

		for (const [, guildResponses] of responseCache) {
			if (guildResponses) {
				for (const [key, value] of guildResponses) {
					aggregatedResponses.set(key, value);
				}
			}
		}

		return aggregatedResponses.get(intentName)!;
	}

	const guildResponses = responseCache.get(guildId);
	if (guildResponses) {
		return guildResponses.get(intentName)!;
	}
}
