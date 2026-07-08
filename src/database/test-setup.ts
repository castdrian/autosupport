import { db } from "@src/database/db";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

migrate(db, { migrationsFolder: "./src/database/drizzle" });
