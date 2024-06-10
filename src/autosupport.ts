import { config, responseCache } from "@src/config";
import { type Intent, witMessage } from "@utils/wit";
import { Collection, type Message } from "discord.js";
import { createWorker } from 'tesseract.js';

function getHighestConfidenceIntent(
	intents: Intent[],
	minimumConfidence: number | undefined,
): Intent | undefined {
	if (!intents.length) return undefined;
	if (minimumConfidence === undefined) return undefined;

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
			const worker = await createWorker('eng');
			const ret = await worker.recognize(attachment.url);
			await worker.terminate();
			imageText = ret.data.text;
		}

		const res = await witMessage(
			`${message.content}\n${imageText}`,
			config.witAiServerToken[
			config.devGuildId ? Object.keys(config.witAiServerToken)[0] : message.guildId
			],
		);

		if (!res.intents.length) return;
		const selectedIntent = getHighestConfidenceIntent(res.intents, config.devGuildId ? 0 : responseCache.get(message.guildId)?.minimumConfidence);

		if (selectedIntent) {
			await message.channel.sendTyping();

			let responseContent = '';
			const aggregatedResponses = new Collection<string, string>();

			if (config.devGuildId) {
				for (const [, guildResponses] of responseCache) {
					if (guildResponses) {
						for (const [key, value] of guildResponses.values) {
							aggregatedResponses.set(key, value);
						}
					}
				}

				responseContent = aggregatedResponses.get(selectedIntent.name) ?? '';
			} else {
				const guildResponses = responseCache.get(message.guildId);
				if (guildResponses) {
					responseContent = guildResponses.values.get(selectedIntent.name) ?? '';
				}
			}

			await message.reply({
				content: `${responseContent.trim()}\n-# triggered intent ${selectedIntent.name} with ${(selectedIntent.confidence * 100).toFixed(2)}% confidence`,
				allowedMentions: { repliedUser: true },
			});
		}

	} catch (error) {
		message.client.logger.error(error);
		return undefined;
	}
}
