declare module "@src/data.toml" {

	interface Response {
		minimum_confidence: number;
		ignore_replies: boolean;
		channel_ids: string[];
		ignored_roles: string[];
		values: Record<string, string>;
	}

	export const responses: Record<string, Response>;
}
