import { OnePasswordConnect } from "@1password/connect";

const VAULT_TITLE = "Unbound";

const AUTOSUPPORT_ITEM_ID = "3lbrpnmiautp3luz4yn56ncrdq";
const OPENAI_API_ITEM_ID = "vztlvhd3pg44senwiuqdbn23sq";
const OPENAI_ADMIN_ITEM_ID = "o723cwctv6jq6msshupbubpaly";

export interface OnePasswordSecrets {
	discordToken: string;
	openAiApiKey: string;
	openAiAdminApiKey: string | undefined;
	errorWebhookUrl: string | undefined;
}

interface ItemField {
	label?: string;
	value?: string;
}

function fieldValue(
	fields: ItemField[] | undefined,
	label: string,
): string | undefined {
	return fields?.find(
		(field) => field.label?.toLowerCase() === label.toLowerCase(),
	)?.value;
}

export async function fetchOnePasswordSecrets(): Promise<OnePasswordSecrets> {
	const token = process.env.OP_CONNECT_TOKEN;
	if (!token) {
		throw new Error(
			"OP_CONNECT_TOKEN is not set; cannot fetch secrets from 1Password.",
		);
	}

	const serverURL = process.env.OP_CONNECT_SERVER_URL;
	if (!serverURL) {
		throw new Error(
			"OP_CONNECT_SERVER_URL is not set; cannot fetch secrets from 1Password.",
		);
	}

	const op = OnePasswordConnect({
		serverURL,
		token,
		keepAlive: true,
	});

	const vault = await op.getVaultByTitle(VAULT_TITLE);
	if (!vault.id) {
		throw new Error(`Could not resolve the "${VAULT_TITLE}" 1Password vault.`);
	}

	const [autosupportItem, openAiApiItem, openAiAdminItem] = await Promise.all([
		op.getItemById(vault.id, AUTOSUPPORT_ITEM_ID),
		op.getItemById(vault.id, OPENAI_API_ITEM_ID),
		op.getItemById(vault.id, OPENAI_ADMIN_ITEM_ID),
	]);

	const discordToken = fieldValue(autosupportItem.fields, "credential");
	const errorWebhookUrl = fieldValue(
		autosupportItem.fields,
		"error webhook url",
	);
	const openAiApiKey = fieldValue(openAiApiItem.fields, "credential");
	const openAiAdminApiKey = fieldValue(openAiAdminItem.fields, "credential");

	if (!discordToken) {
		throw new Error(
			'1Password item "autosupport - discord auth" is missing its "credential" field.',
		);
	}
	if (!openAiApiKey) {
		throw new Error(
			'1Password item "OpenAI API Key" is missing its "credential" field.',
		);
	}

	return { discordToken, openAiApiKey, openAiAdminApiKey, errorWebhookUrl };
}
