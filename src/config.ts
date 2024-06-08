import { responses } from "@src/data.toml";
import { Collection } from "discord.js";
import { createConfigLoader } from "neat-config";
import { z } from "zod";

const schema = z.object({
	discordToken: z
		.string()
		.regex(/^([MN][\w-]{23,25})\.([\w-]{6})\.([\w-]{27,39})$/),
	devGuildId: z.string().regex(/^(?<id>\d{17,20})$/).optional(),
	witAiServerToken: z.record(z.string().regex(/^(?<id>\d{17,20})$/), z.string().regex(/^[A-Z0-9]{32}$/)),
});

export const config = createConfigLoader()
	.addFromFile(".env")
	.addFromEnvironment()
	.addZodSchema(schema)
	.load();

interface GuildResponse {
	channelIds: string[];
	values: Collection<string, string>;
}

export const responseCache = new Collection<string, GuildResponse>();

for (const [key, value] of Object.entries(responses)) {
	const { channel_ids: channelIds, ...props } = value;
	const values = new Collection<string, string>();

	for (const [responseKey, responseValue] of Object.entries(props)) {
		values.set(responseKey, responseValue);
	}

	responseCache.set(key, { channelIds, values });
}