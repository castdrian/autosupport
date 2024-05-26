import pkg from 'node-wit';
import { Collection, Message } from 'discord.js';
import recognize from 'tesseractocr';
import { request } from 'undici';
import responses from '@src/data.toml';
import { config } from '@src/config';

const { Wit } = pkg;

interface ConfigObject {
	title: string;
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

export async function getResponse(message: Message) {
	try {
		let imageText: string | undefined;

		if (message.attachments.size) {
			const attachment = message.attachments.first()!;
			if (!attachment.contentType?.startsWith('image')) return;

			const buffer = Buffer.from(await request(attachment.url).then((res) => res.body.arrayBuffer()));
			const text = await recognize(buffer);
			if (text) imageText = text;
		}

		const res = await wit.message(message.content + (imageText ? `\n${imageText}` : ''), {});

		if (!res.intents.length) return;
		await message.channel.sendTyping();
		const intent = res.intents.reduce((prev, current) => (prev.confidence > current.confidence ? prev : current));
		return responseCache.get(intent.name);
	} catch (error) {
		message.client.logger.error(error);
		return undefined;
	}
}
