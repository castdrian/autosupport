import { describe, expect, mock, test } from "bun:test";

interface FakeItem {
	fields?: { label?: string; value?: string }[];
}

let vaultResponse: { id?: string } = { id: "vault-id" };
let itemResponses: Record<string, FakeItem> = {};

const getVaultByTitle = mock(async () => vaultResponse);
const getItemById = mock(async (_vaultId: string, itemId: string) => {
	return itemResponses[itemId] ?? { fields: [] };
});

mock.module("@1password/connect", () => ({
	OnePasswordConnect: mock(() => ({ getVaultByTitle, getItemById })),
}));

const { fetchOnePasswordSecrets } = await import("./onePasswordSecrets");

const AUTOSUPPORT_ITEM_ID = "3lbrpnmiautp3luz4yn56ncrdq";
const OPENAI_API_ITEM_ID = "vztlvhd3pg44senwiuqdbn23sq";
const OPENAI_ADMIN_ITEM_ID = "o723cwctv6jq6msshupbubpaly";

function setValidItems(overrides?: {
	autosupport?: FakeItem;
	openAiApi?: FakeItem;
	openAiAdmin?: FakeItem;
}) {
	vaultResponse = { id: "vault-id" };
	itemResponses = {
		[AUTOSUPPORT_ITEM_ID]: overrides?.autosupport ?? {
			fields: [
				{ label: "credential", value: "discord-token-value" },
				{ label: "error webhook url", value: "https://webhook.example/x" },
			],
		},
		[OPENAI_API_ITEM_ID]: overrides?.openAiApi ?? {
			fields: [{ label: "credential", value: "openai-api-key-value" }],
		},
		[OPENAI_ADMIN_ITEM_ID]: overrides?.openAiAdmin ?? {
			fields: [{ label: "credential", value: "openai-admin-key-value" }],
		},
	};
}

async function withToken<T>(
	token: string | undefined,
	fn: () => Promise<T>,
): Promise<T> {
	const previous = process.env.OP_UNBOUND_TOKEN;
	if (token === undefined) {
		delete process.env.OP_UNBOUND_TOKEN;
	} else {
		process.env.OP_UNBOUND_TOKEN = token;
	}
	try {
		return await fn();
	} finally {
		if (previous === undefined) {
			delete process.env.OP_UNBOUND_TOKEN;
		} else {
			process.env.OP_UNBOUND_TOKEN = previous;
		}
	}
}

describe("fetchOnePasswordSecrets", () => {
	test("throws when OP_UNBOUND_TOKEN is not set", async () => {
		await withToken(undefined, async () => {
			await expect(fetchOnePasswordSecrets()).rejects.toThrow(
				"OP_UNBOUND_TOKEN is not set",
			);
		});
	});

	test("throws when the vault cannot be resolved", async () => {
		setValidItems();
		vaultResponse = {};

		await withToken("test-token", async () => {
			await expect(fetchOnePasswordSecrets()).rejects.toThrow(
				'Could not resolve the "Unbound" 1Password vault.',
			);
		});
	});

	test("throws when the autosupport item is missing its credential field", async () => {
		setValidItems({ autosupport: { fields: [] } });

		await withToken("test-token", async () => {
			await expect(fetchOnePasswordSecrets()).rejects.toThrow(
				/autosupport - discord auth.*credential/,
			);
		});
	});

	test("throws when the OpenAI API item is missing its credential field", async () => {
		setValidItems({ openAiApi: { fields: [] } });

		await withToken("test-token", async () => {
			await expect(fetchOnePasswordSecrets()).rejects.toThrow(
				/OpenAI API Key.*credential/,
			);
		});
	});

	test("returns all secrets when every field is present", async () => {
		setValidItems();

		await withToken("test-token", async () => {
			const secrets = await fetchOnePasswordSecrets();
			expect(secrets).toEqual({
				discordToken: "discord-token-value",
				openAiApiKey: "openai-api-key-value",
				openAiAdminApiKey: "openai-admin-key-value",
				errorWebhookUrl: "https://webhook.example/x",
			});
		});
	});

	test("returns undefined for optional fields that are absent", async () => {
		setValidItems({
			autosupport: { fields: [{ label: "credential", value: "dt" }] },
			openAiAdmin: { fields: [] },
		});

		await withToken("test-token", async () => {
			const secrets = await fetchOnePasswordSecrets();
			expect(secrets.errorWebhookUrl).toBeUndefined();
			expect(secrets.openAiAdminApiKey).toBeUndefined();
		});
	});

	test("matches field labels case-insensitively", async () => {
		setValidItems({
			autosupport: {
				fields: [{ label: "CREDENTIAL", value: "discord-token-value" }],
			},
		});

		await withToken("test-token", async () => {
			const secrets = await fetchOnePasswordSecrets();
			expect(secrets.discordToken).toBe("discord-token-value");
		});
	});

	test("fetches all three known items by id from the resolved vault", async () => {
		setValidItems();
		getItemById.mockClear();

		await withToken("test-token", async () => {
			await fetchOnePasswordSecrets();
		});

		const calledItemIds = getItemById.mock.calls.map((call) => call[1]);
		expect(calledItemIds).toContain(AUTOSUPPORT_ITEM_ID);
		expect(calledItemIds).toContain(OPENAI_API_ITEM_ID);
		expect(calledItemIds).toContain(OPENAI_ADMIN_ITEM_ID);
		for (const call of getItemById.mock.calls) {
			expect(call[0]).toBe("vault-id");
		}
	});
});
