enum WitRoute {
	MESSAGE = 'message',
	INTENTS = 'intents',
	UTTERANCES = 'utterances',
}

enum HttpMethod {
	POST = 'POST',
}

export interface Intent {
	confidence: number;
	id: string;
	name: string;
}

interface WitMessageResult {
	entities: Record<string, unknown>;
	intents: Intent[];
	text: string;
	traits: Record<string, unknown>;
}

interface Utterance {
	text: string;
	intent: string;
	entities: unknown[];
	traits: unknown[];
}

interface FetchOptions {
	route: WitRoute;
	token: string;
	params?: URLSearchParams;
	method?: HttpMethod;
	body?: object;
}

async function witFetch<T>({ route, token, params = new URLSearchParams(), method, body }: FetchOptions): Promise<T> {
	const url = new URL(`https://api.wit.ai/${route}`);
	url.search = params.toString();

	const response = await fetch(url.toString(), {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	});

	if (!response.ok) throw new Error(`Failed to fetch from Wit.ai: ${response.statusText}`);
	return response.json() as T;
}

export async function witMessage(text: string, token: string): Promise<WitMessageResult> {
	const params = new URLSearchParams({ q: text });
	return witFetch<WitMessageResult>({
		route: WitRoute.MESSAGE,
		token,
		params,
	});
}

export async function witIntents(token: string): Promise<Intent[]> {
	return witFetch<Intent[]>({
		route: WitRoute.INTENTS,
		token,
	});
}

export async function trainWitUtterance(text: string, intent: string, token: string): Promise<void> {
	const utterance: Utterance = {
		text,
		intent,
		entities: [],
		traits: [],
	};
	
	await witFetch<void>({
		route: WitRoute.UTTERANCES,
		token,
		method: HttpMethod.POST,
		body: [utterance],
	});
}