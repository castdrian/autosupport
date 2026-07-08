import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { SapphireClient } from "@sapphire/framework";
import { GatewayIntentBits } from "discord.js";

describe("piece loading", () => {
	test("all listeners, commands, and interaction handlers load without error", async () => {
		const client = new SapphireClient({
			intents: [GatewayIntentBits.Guilds],
		});

		client.stores.registerPath(join(process.cwd(), "src"));

		for (const store of client.stores.values()) {
			// biome-ignore lint/suspicious/noExplicitAny: overriding an internal Sapphire strategy hook for the test
			(store.strategy as any).onError = (error: unknown) => {
				throw error;
			};
		}

		await client.stores.load();

		expect(client.stores.get("listeners")?.size).toBeGreaterThan(0);
		expect(client.stores.get("commands")?.size).toBeGreaterThan(0);
		expect(client.stores.get("interaction-handlers")?.size).toBeGreaterThan(0);
	});
});
