import { responses } from "@src/data.toml";
import { Collection } from "discord.js";
import { createConfigLoader } from "neat-config";
import { z } from "zod";

const configSchema = z.object({
	discordToken: z
		.string()
		.regex(/^([MN][\w-]{23,25})\.([\w-]{6})\.([\w-]{27,39})$/),
	devGuildId: z.string().regex(/^(?<id>\d{17,20})$/).optional(),
	witAiServerToken: z.record(z.string().regex(/^(?<id>\d{17,20})$/), z.string().regex(/^[A-Z0-9]{32}$/)),
});

export const config = createConfigLoader()
	.addFromFile(".env")
	.addFromEnvironment()
	.addZodSchema(configSchema)
	.load();

const guildResponseSchema = z.object({
	minimum_confidence: z.number(),
	ignore_replies: z.boolean(),
	channel_ids: z.array(z.string().regex(/^(?<id>\d{17,20})$/)),
	ignored_roles: z.array(z.string().regex(/^(?<id>\d{17,20})$/)),
	confinement_role: z.string().optional().or(z.string().regex(/^(?<id>\d{17,20})$/)),
	values: z.record(z.string(), z.string()),
});

const responseSchema = z.record(z.string().regex(/^(?<id>\d{17,20})$/), guildResponseSchema)
responseSchema.parse(responses)

interface GuildResponse {
	minimumConfidence: number;
	ignoreReplies: boolean;
	channelIds: string[];
	ignoredRoles: string[];
	confinementRole?: string;
	values: Collection<string, string>;
}

export const responseCache = new Collection<string, GuildResponse>();

for (const [key, value] of Object.entries(responses)) {
	const { minimum_confidence: minimumConfidence, ignore_replies: ignoreReplies, channel_ids: channelIds, ignored_roles: ignoredRoles, confinement_role: confinementRole, values } = value;
	const valueCollection = new Collection<string, string>();

	for (const [responseKey, responseValue] of Object.entries(values)) {
		valueCollection.set(responseKey, responseValue);
	}

	responseCache.set(key, { minimumConfidence, ignoreReplies, channelIds, ignoredRoles, confinementRole, values: valueCollection });
}

interface Inmate {
	id: string;
	guildId: string;
	confinementRole: string;
	releaseDate: Date;
}

export const confinementCache = new Collection<string, Inmate>();