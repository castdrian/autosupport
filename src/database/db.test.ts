import { describe, expect, test } from "bun:test";
import {
	addSupportChannelId,
	clearKnowledgeBaseState,
	clearThreadEscalated,
	clearThreadResponseId,
	countEscalatedThreadsForGuild,
	deleteEscalatedThreadsForGuild,
	deleteGuildSettings,
	deleteThreadResponsesForGuild,
	deleteThreadResponsesForThread,
	getGuildSettingsIfExists,
	getKnowledgeBaseState,
	getOrCreateGuildSettings,
	getThreadResponseId,
	isThreadEscalated,
	removeSupportChannelId,
	setKnowledgeBaseState,
	setThreadEscalated,
	setThreadResponseId,
} from "@src/database/db";

// Each test uses its own guild/thread/user ID since all tests share one
// in-memory db connection for the whole test run (see bunfig.toml preload +
// DATABASE_PATH).
let nextGuildId = 100000000000000001n;
function freshGuildId(): string {
	return String(nextGuildId++);
}

let nextThreadId = 200000000000000001n;
function freshThreadId(): string {
	return String(nextThreadId++);
}

let nextUserId = 300000000000000001n;
function freshUserId(): string {
	return String(nextUserId++);
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

	test("concurrent adds for different channels both survive", async () => {
		const guildId = freshGuildId();
		await Promise.all([
			addSupportChannelId(guildId, "333333333333333333"),
			addSupportChannelId(guildId, "444444444444444444"),
		]);

		const settings = await getOrCreateGuildSettings(guildId);
		expect(settings.channelIds).toContain("333333333333333333");
		expect(settings.channelIds).toContain("444444444444444444");
		expect(settings.channelIds).toHaveLength(2);
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

describe("thread response continuity", () => {
	test("getThreadResponseId returns undefined when never set", async () => {
		const guildId = freshGuildId();
		const threadId = freshThreadId();
		const userId = freshUserId();

		expect(
			await getThreadResponseId(guildId, userId, threadId),
		).toBeUndefined();
	});

	test("setThreadResponseId persists and getThreadResponseId reads it back", async () => {
		const guildId = freshGuildId();
		const threadId = freshThreadId();
		const userId = freshUserId();

		await setThreadResponseId(guildId, userId, threadId, "resp_abc123");

		expect(await getThreadResponseId(guildId, userId, threadId)).toBe(
			"resp_abc123",
		);
	});

	test("setThreadResponseId overwrites the previous response id for the same key", async () => {
		const guildId = freshGuildId();
		const threadId = freshThreadId();
		const userId = freshUserId();

		await setThreadResponseId(guildId, userId, threadId, "resp_first");
		await setThreadResponseId(guildId, userId, threadId, "resp_second");

		expect(await getThreadResponseId(guildId, userId, threadId)).toBe(
			"resp_second",
		);
	});

	test("setThreadResponseId keeps separate rows per user in the same thread", async () => {
		const guildId = freshGuildId();
		const threadId = freshThreadId();
		const userA = freshUserId();
		const userB = freshUserId();

		await setThreadResponseId(guildId, userA, threadId, "resp_a");
		await setThreadResponseId(guildId, userB, threadId, "resp_b");

		expect(await getThreadResponseId(guildId, userA, threadId)).toBe("resp_a");
		expect(await getThreadResponseId(guildId, userB, threadId)).toBe("resp_b");
	});

	test("clearThreadResponseId removes only the matching user/thread pair", async () => {
		const guildId = freshGuildId();
		const threadId = freshThreadId();
		const userA = freshUserId();
		const userB = freshUserId();

		await setThreadResponseId(guildId, userA, threadId, "resp_a");
		await setThreadResponseId(guildId, userB, threadId, "resp_b");
		await clearThreadResponseId(guildId, userA, threadId);

		expect(await getThreadResponseId(guildId, userA, threadId)).toBeUndefined();
		expect(await getThreadResponseId(guildId, userB, threadId)).toBe("resp_b");
	});

	test("deleteThreadResponsesForThread removes every user's row for that thread", async () => {
		const guildId = freshGuildId();
		const threadId = freshThreadId();
		const otherThreadId = freshThreadId();
		const userA = freshUserId();
		const userB = freshUserId();

		await setThreadResponseId(guildId, userA, threadId, "resp_a");
		await setThreadResponseId(guildId, userB, threadId, "resp_b");
		await setThreadResponseId(guildId, userA, otherThreadId, "resp_other");
		await deleteThreadResponsesForThread(threadId);

		expect(await getThreadResponseId(guildId, userA, threadId)).toBeUndefined();
		expect(await getThreadResponseId(guildId, userB, threadId)).toBeUndefined();
		expect(await getThreadResponseId(guildId, userA, otherThreadId)).toBe(
			"resp_other",
		);
	});

	test("deleteThreadResponsesForGuild removes every thread's row for that guild", async () => {
		const guildId = freshGuildId();
		const otherGuildId = freshGuildId();
		const threadA = freshThreadId();
		const threadB = freshThreadId();
		const userId = freshUserId();

		await setThreadResponseId(guildId, userId, threadA, "resp_a");
		await setThreadResponseId(guildId, userId, threadB, "resp_b");
		await setThreadResponseId(
			otherGuildId,
			userId,
			threadA,
			"resp_other_guild",
		);
		await deleteThreadResponsesForGuild(guildId);

		expect(await getThreadResponseId(guildId, userId, threadA)).toBeUndefined();
		expect(await getThreadResponseId(guildId, userId, threadB)).toBeUndefined();
		expect(await getThreadResponseId(otherGuildId, userId, threadA)).toBe(
			"resp_other_guild",
		);
	});
});

describe("thread escalation state", () => {
	test("isThreadEscalated returns false when never escalated", async () => {
		const threadId = freshThreadId();
		expect(await isThreadEscalated(threadId)).toBe(false);
	});

	test("setThreadEscalated marks the thread as escalated", async () => {
		const guildId = freshGuildId();
		const threadId = freshThreadId();

		await setThreadEscalated(guildId, threadId);

		expect(await isThreadEscalated(threadId)).toBe(true);
	});

	test("setThreadEscalated is idempotent when called twice", async () => {
		const guildId = freshGuildId();
		const threadId = freshThreadId();

		await setThreadEscalated(guildId, threadId);
		await setThreadEscalated(guildId, threadId);

		expect(await isThreadEscalated(threadId)).toBe(true);
	});

	test("clearThreadEscalated resets escalation state", async () => {
		const guildId = freshGuildId();
		const threadId = freshThreadId();

		await setThreadEscalated(guildId, threadId);
		await clearThreadEscalated(threadId);

		expect(await isThreadEscalated(threadId)).toBe(false);
	});

	test("clearThreadEscalated on a non-escalated thread is a no-op", async () => {
		const threadId = freshThreadId();
		await clearThreadEscalated(threadId);

		expect(await isThreadEscalated(threadId)).toBe(false);
	});

	test("countEscalatedThreadsForGuild counts only threads for that guild", async () => {
		const guildId = freshGuildId();
		const otherGuildId = freshGuildId();
		const threadA = freshThreadId();
		const threadB = freshThreadId();
		const otherGuildThread = freshThreadId();

		await setThreadEscalated(guildId, threadA);
		await setThreadEscalated(guildId, threadB);
		await setThreadEscalated(otherGuildId, otherGuildThread);

		expect(await countEscalatedThreadsForGuild(guildId)).toBe(2);
		expect(await countEscalatedThreadsForGuild(otherGuildId)).toBe(1);
	});

	test("deleteEscalatedThreadsForGuild removes only that guild's escalated threads", async () => {
		const guildId = freshGuildId();
		const otherGuildId = freshGuildId();
		const threadA = freshThreadId();
		const otherGuildThread = freshThreadId();

		await setThreadEscalated(guildId, threadA);
		await setThreadEscalated(otherGuildId, otherGuildThread);
		await deleteEscalatedThreadsForGuild(guildId);

		expect(await isThreadEscalated(threadA)).toBe(false);
		expect(await isThreadEscalated(otherGuildThread)).toBe(true);
	});
});
