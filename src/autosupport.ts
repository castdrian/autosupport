import TOML from '@ltd/j-toml';
import pkg from 'node-wit';
import { Collection, Message } from 'discord.js';
import { readFileSync } from 'node:fs';

const { Wit } = pkg;

interface ConfigObject {
	title: string;
	responses: Record<string, string>;
}

const configStore = TOML.parse(readFileSync('./src/config.toml', 'utf8')) as unknown as ConfigObject;
const responseCache = new Collection<string, string>();

for (const [key, value] of Object.entries(configStore.responses)) {
	responseCache.set(key, value);
}

const wit = new Wit({
	accessToken: process.env.WIT_AI_TOKEN ?? ''
});

export async function getResponse(message: Message) {
	const res = await wit.message(message.content, {});

	if (!res.intents.length) return;
	await message.channel.sendTyping();
	const intent = res.intents.reduce((prev, current) => (prev.confidence > current.confidence ? prev : current));
	return responseCache.get(intent.name);
}
