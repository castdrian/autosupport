import { createConfigLoader } from "neat-config";
import { z } from "zod";

const schema = z.object({
	discordToken: z
		.string()
		.regex(/^([MN][\w-]{23,25})\.([\w-]{6})\.([\w-]{27,39})$/),
	guildId: z.string().regex(/^(?<id>\d{17,20})$/),
	channelId: z.string().regex(/^(?<id>\d{17,20})$/),
	witAiToken: z.string().regex(/^[A-Z0-9]{32}$/),
});

export const config = createConfigLoader()
	.addFromFile(".env")
	.addFromEnvironment()
	.addZodSchema(schema)
	.load();
