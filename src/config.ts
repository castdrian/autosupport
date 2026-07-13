import { existsSync, statSync } from "node:fs";
import { createConfig, loaders } from "@neato/config";
import data from "@src/data.toml";
import { fetchOnePasswordSecrets } from "@utils/onePasswordSecrets";
import { z } from "zod";

function hasEnvFile(): boolean {
	try {
		const stats = statSync(".env");
		// 1Password's local environments feature serves .env content through a
		// named pipe rather than a regular file, so FIFOs count too.
		return stats.isFile() || stats.isFIFO();
	} catch {
		return false;
	}
}

const schema = z.object({
	discordToken: z
		.string()
		.regex(/^([MN][\w-]{23,25})\.([\w-]{6})\.([\w-]{27,39})$/),
	devGuildId: z
		.string()
		.regex(/^(?<id>\d{17,20})$/)
		.optional(),
	openAiApiKey: z.string().regex(/^sk-(?:proj-)?[a-zA-Z0-9_-]{40,}$/),
	openAiAdminApiKey: z
		.string()
		.regex(/^sk-[a-zA-Z0-9_-]{20,}$/)
		.optional(),
	githubToken: z.string().min(1).optional(),
	errorWebhookUrl: z
		.string()
		.regex(/^https:\/\/discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/)
		.optional(),
});

const usesOnePassword =
	existsSync("/.dockerenv") || (!hasEnvFile() && !process.env.DISCORD_TOKEN);

async function loadConfig() {
	if (!usesOnePassword) {
		return createConfig({
			schema,
			loaders: [loaders.file(".env"), loaders.environment()],
			freeze: true,
		});
	}

	try {
		const secrets = await fetchOnePasswordSecrets();
		return Object.freeze(
			schema.parse({
				...secrets,
				devGuildId: process.env.DEV_GUILD_ID,
				githubToken: secrets.githubToken ?? process.env.GITHUB_TOKEN,
			}),
		);
	} catch (error) {
		console.error("Failed to load secrets from 1Password:");
		console.error(error);
		process.exit(1);
	}
}

export const config = await loadConfig();

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
