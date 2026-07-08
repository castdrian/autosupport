import { describe, expect, test } from "bun:test";
import {
	addSupportChannelId,
	clearKnowledgeBaseState,
	deleteGuildSettings,
	getGuildSettingsIfExists,
	getKnowledgeBaseState,
	getOrCreateGuildSettings,
	removeSupportChannelId,
	setKnowledgeBaseState,
} from "@src/database/db";

// Each test uses its own guild ID since all tests share one in-memory db
// connection for the whole test run (see bunfig.toml preload + DATABASE_PATH).
let nextGuildId = 100000000000000001n;
function freshGuildId(): string {
	return String(nextGuildId++);
}

describe("getOrCreateGuildSettings", () => {
	test("creates a new row with defaults on first call", async () => {
		const guildId = freshGuildId();
		const settings = await getOrCreateGuildSettings(guildId);

		expect(settings.id).toBe(guildId);
		expect(settings.channelIds).toEqual([]);
		expect(settings.knowledgeBaseVectorStoreId).toBeNull();
		expect(settings.knowledgeBaseHash).toBeNull();
	});

	test("returns the existing row on subsequent calls without resetting it", async () => {
		const guildId = freshGuildId();
		await addSupportChannelId(guildId, "111111111111111111");

		const settings = await getOrCreateGuildSettings(guildId);
		expect(settings.channelIds).toEqual(["111111111111111111"]);
	});
});

describe("getGuildSettingsIfExists", () => {
	test("returns undefined for a guild with no row", async () => {
		const guildId = freshGuildId();
		expect(await getGuildSettingsIfExists(guildId)).toBeUndefined();
	});

	test("returns the row once one has been created", async () => {
		const guildId = freshGuildId();
		await getOrCreateGuildSettings(guildId);

		const settings = await getGuildSettingsIfExists(guildId);
		expect(settings?.id).toBe(guildId);
	});

	test("does not create a row as a side effect", async () => {
		const guildId = freshGuildId();
		await getGuildSettingsIfExists(guildId);

		expect(await getGuildSettingsIfExists(guildId)).toBeUndefined();
	});
});

describe("addSupportChannelId / removeSupportChannelId", () => {
	test("adds a channel", async () => {
		const guildId = freshGuildId();
		const settings = await addSupportChannelId(guildId, "222222222222222222");
		expect(settings.channelIds).toEqual(["222222222222222222"]);
	});

	test("does not add a duplicate channel", async () => {
		const guildId = freshGuildId();
		await addSupportChannelId(guildId, "222222222222222222");
		const settings = await addSupportChannelId(guildId, "222222222222222222");
		expect(settings.channelIds).toEqual(["222222222222222222"]);
	});

	test("removes a configured channel", async () => {
		const guildId = freshGuildId();
		await addSupportChannelId(guildId, "222222222222222222");
		const settings = await removeSupportChannelId(
			guildId,
			"222222222222222222",
		);
		expect(settings.channelIds).toEqual([]);
	});

	test("is a no-op when removing a channel that isn't configured", async () => {
		const guildId = freshGuildId();
		await addSupportChannelId(guildId, "222222222222222222");
		const settings = await removeSupportChannelId(
			guildId,
			"999999999999999999",
		);
		expect(settings.channelIds).toEqual(["222222222222222222"]);
	});
});

describe("deleteGuildSettings", () => {
	test("removes the row entirely", async () => {
		const guildId = freshGuildId();
		await getOrCreateGuildSettings(guildId);
		await deleteGuildSettings(guildId);

		expect(await getGuildSettingsIfExists(guildId)).toBeUndefined();
	});

	test("a subsequent getOrCreateGuildSettings call re-creates a fresh row", async () => {
		const guildId = freshGuildId();
		await addSupportChannelId(guildId, "222222222222222222");
		await deleteGuildSettings(guildId);

		const settings = await getOrCreateGuildSettings(guildId);
		expect(settings.channelIds).toEqual([]);
	});
});

describe("knowledge base state", () => {
	test("getKnowledgeBaseState returns undefined when never set", async () => {
		const guildId = freshGuildId();
		expect(await getKnowledgeBaseState(guildId)).toBeUndefined();
	});

	test("setKnowledgeBaseState persists and getKnowledgeBaseState reads it back", async () => {
		const guildId = freshGuildId();
		await setKnowledgeBaseState(guildId, {
			vectorStoreId: "vs_abc123",
			contentHash: "deadbeef",
		});

		expect(await getKnowledgeBaseState(guildId)).toEqual({
			vectorStoreId: "vs_abc123",
			contentHash: "deadbeef",
		});
	});

	test("clearKnowledgeBaseState resets it back to undefined", async () => {
		const guildId = freshGuildId();
		await setKnowledgeBaseState(guildId, {
			vectorStoreId: "vs_abc123",
			contentHash: "deadbeef",
		});
		await clearKnowledgeBaseState(guildId);

		expect(await getKnowledgeBaseState(guildId)).toBeUndefined();
	});
});
