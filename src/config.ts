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
	openAiApiKey: z.string().regex(/sk-(?:proj-)?[a-zA-Z0-9]{40,}/),
	openAiAdminApiKey: z
		.string()
		.regex(/^sk-[a-zA-Z0-9_-]{20,}$/)
		.optional(),
});

export const config = createConfig({
	schema,
	loaders: [loaders.file(".env"), loaders.environment()],
	freeze: true,
});

const tomlSchema = z.object({
	instructions: z.record(z.string().regex(/^(?<id>\d{17,20})$/), z.string()),
	support: z.record(
		z.string().regex(/^(?<id>\d{17,20})$/),
		z.array(
			z.object({
				problem: z.string().min(1, "problem must not be empty"),
				solution: z.string().min(1, "solution must not be empty"),
				notes: z.string().optional(),
			}),
		),
	),
});

const tomlValidation = tomlSchema.safeParse(data);
if (!tomlValidation.success) {
	console.error("Invalid src/data.toml:");
	for (const issue of tomlValidation.error.issues) {
		const path = issue.path.length ? issue.path.join(".") : "(root)";
		console.error(`  - ${path}: ${issue.message}`);
	}
	process.exit(1);
}
