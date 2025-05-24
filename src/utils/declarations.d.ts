declare module "@src/data.toml" {
	interface SupportItem {
		problem: string;
		solution: string;
		notes?: string;
	}

	interface TomlData {
		support: {
			[guildId: string]: SupportItem[];
		};
	}

	const data: TomlData;
	export default data;
}
