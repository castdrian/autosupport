import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/database/schema.ts",
	out: "./src/database/drizzle",
	dialect: "sqlite",
	dbCredentials: {
		url: "file:./autosupport.db",
	},
	verbose: true,
	strict: true,
});
