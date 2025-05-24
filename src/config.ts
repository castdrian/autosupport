import { createConfig, loaders } from "@neato/config";
import data from "@src/data.toml";

import { z } from "zod";

const schema = z.object({
	discordToken: z
		.string()
		.regex(/^([MN][\w-]{23,25})\.([\w-]{6})\.([\w-]{27,39})$/),
	devGuildId: z
		.string()
		.regex(/^(?<id>\d{17,20})$/)
		.optional(),
	openAiApiKey: z.record(
		z.string().regex(/^(?<id>\d{17,20})$/),
		z.string().regex(/sk-(?:proj-)?[a-zA-Z0-9]{40,}/),
	),
	openAiAssistantId: z.record(
		z.string().regex(/^(?<id>\d{17,20})$/),
		z.string().regex(/asst_[a-zA-Z0-9]{24,}/),
	),
});

export const config = createConfig({
	schema,
	loaders: [loaders.file(".env"), loaders.environment()],
	freeze: true,
});

function validateConfig(data: unknown) {
	const parsed = schema.parse(data);
	if (
		parsed.devGuildId &&
		(!Object.keys(parsed.openAiApiKey).includes(parsed.devGuildId) ||
			!Object.keys(parsed.openAiAssistantId).includes(parsed.devGuildId))
	) {
		throw new z.ZodError([
			{
				path: ["openAiApiKey", "openAiAssistantId"],
				message:
					"if devGuildId is set, it must be a key in both openAiApiKey and openAiAssistantId",
				code: z.ZodIssueCode.custom,
			},
		]);
	}
}

validateConfig(config);

const tomlSchema = z.object({
	support: z.record(
		z.string().regex(/^(?<id>\d{17,20})$/),
		z.array(
			z.object({
				problem: z.string(),
				solution: z.string(),
				notes: z.string().optional(),
			}),
		),
	),
});
tomlSchema.parse(data);
