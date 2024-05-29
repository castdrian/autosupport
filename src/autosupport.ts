import { config } from "@src/config";
import { responses } from "@src/data.toml";
import { Collection, type Message } from "discord.js";
import { Wit, type WitIntent } from "node-wit";
import { createWorker } from 'tesseract.js';

const responseCache = new Collection<string, string>();

for (const [key, value] of Object.entries(responses)) {
	responseCache.set(key, value);
}

const wit = new Wit({
	accessToken: config.witAiToken,
});

function getHighestConfidenceIntent(
	intents: WitIntent[],
): WitIntent | undefined {
	if (!intents.length) return undefined;

	const highestConfidenceIntent = intents.reduce((prev, current) =>
		prev.confidence > current.confidence ? prev : current,
	);

	return highestConfidenceIntent.confidence >= 0.8
		? highestConfidenceIntent
		: undefined;
}

export async function getResponse(message: Message) {
	try {
		if (!message.content.length && !message.attachments.size) return;
		let imageText = "";

		const attachment = message.attachments.first();
		if (!attachment?.contentType?.startsWith("image")) return;

		const worker = await createWorker('eng');
		const ret = await worker.recognize(attachment.url);
		await worker.terminate();
		imageText = ret.data.text;

		const res = await wit.message(
			`${message.content}\n${imageText}`,
			{},
		);

		if (!res.intents.length) return;
		const selectedIntent = getHighestConfidenceIntent(res.intents);

		if (selectedIntent) {
			await message.channel.sendTyping();
			await message.reply({
				content: `${responseCache.get(selectedIntent.name)}\n\n-# triggered intent ${selectedIntent.name} with confidence ${selectedIntent.confidence.toFixed(3)}`,
				allowedMentions: { repliedUser: true },
			});
		}
	} catch (error) {
		message.client.logger.error(error);
		return undefined;
	}
}
