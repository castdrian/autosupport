declare module "@src/data.toml" {
	interface Response {
		channel_ids: string[];
		[key: string]: string;
	}

	export const responses: Record<string, Response>;
}
