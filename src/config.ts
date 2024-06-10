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
	minimumConfidence: number;
	ignoreReplies: boolean;
	channelIds: string[];
	ignoredRoles: string[];
	values: Collection<string, string>;
}

export const responseCache = new Collection<string, GuildResponse>();

for (const [key, value] of Object.entries(responses)) {
	const { minimum_confidence: minimumConfidence, ignore_replies: ignoreReplies, channel_ids: channelIds, ignored_roles: ignoredRoles, values } = value;
	const valueCollection = new Collection<string, string>();

	for (const [responseKey, responseValue] of Object.entries(values)) {
		valueCollection.set(responseKey, responseValue);
	}

	responseCache.set(key, { minimumConfidence, ignoreReplies, channelIds, ignoredRoles, values: valueCollection });
}