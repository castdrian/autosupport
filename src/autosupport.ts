import { config } from "@src/config";
import responses from "@src/data.toml";
import { Collection, type Message } from "discord.js";
import { Wit, type WitIntent } from "node-wit";
import recognize from "tesseractocr";
import { request } from "undici";

interface ConfigObject {
	responses: Record<string, string>;
}

const configStore = responses as ConfigObject;
const responseCache = new Collection<string, string>();

for (const [key, value] of Object.entries(configStore.responses)) {
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

	return highestConfidenceIntent.confidence >= 0.9
		? highestConfidenceIntent
		: undefined;
}

export async function getResponse(message: Message) {
	try {
		let imageText: string | undefined;

		if (message.attachments.size) {
			// biome-ignore lint/style/noNonNullAssertion: this is safe because we check if there are attachments
			const attachment = message.attachments.first()!;
			if (!attachment.contentType?.startsWith("image")) return;

			const buffer = Buffer.from(
				await request(attachment.url).then((res) => res.body.arrayBuffer()),
			);
			const text = await recognize(buffer);
			if (text) imageText = text;
		}

		const res = await wit.message(
			message.content + (imageText ? `\n${imageText}` : ""),
			{},
		);

		if (!res.intents.length) return;
		const selectedIntent = getHighestConfidenceIntent(res.intents);

		if (selectedIntent) {
			await message.channel.sendTyping();
			return responseCache.get(selectedIntent.name);
		}
	} catch (error) {
		message.client.logger.error(error);
		return undefined;
	}
}
