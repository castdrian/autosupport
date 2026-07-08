import { describe, expect, mock, test } from "bun:test";
import { join } from "node:path";

mock.module("@utils/fileManager", () => ({
	deleteKnowledgeBaseFile: mock(async () => {}),
	ensureKnowledgeBaseFile: mock(async () => "vs_test123"),
	invalidateKnowledgeBaseCache: mock(async () => {}),
}));

const { SapphireClient } = await import("@sapphire/framework");
const { Collection, GatewayIntentBits } = await import("discord.js");
const {
	addSupportChannelId,
	getGuildSettingsIfExists,
	getThreadResponseId,
	isThreadEscalated,
	setThreadEscalated,
	setThreadResponseId,
} = await import("@src/database/db");

let nextId = 500000000000000001n;
function freshId(): string {
	return String(nextId++);
}

const client = new SapphireClient({ intents: [GatewayIntentBits.Guilds] });
client.stores.registerPath(join(process.cwd(), "src"));
await client.stores.load();

const listeners = client.stores.get("listeners");
const guildDeleteListener = listeners.get("guildDelete")!;
const threadDeleteListener = listeners.get("threadDelete")!;
const channelDeleteListener = listeners.get("channelDelete")!;

describe("guild delete cleanup", () => {
	test("purges guild settings, thread responses, and escalated threads for the guild", async () => {
		const guildId = freshId();
		const threadId = freshId();
		const userId = freshId();

		await addSupportChannelId(guildId, "111111111111111111");
		await setThreadResponseId(guildId, userId, threadId, "resp_abc");
		await setThreadEscalated(guildId, threadId);

		// biome-ignore lint/suspicious/noExplicitAny: minimal fake matching what the listener reads
		await guildDeleteListener.run({ id: guildId } as any);

		expect(await getGuildSettingsIfExists(guildId)).toBeUndefined();
		expect(
			await getThreadResponseId(guildId, userId, threadId),
		).toBeUndefined();
		expect(await isThreadEscalated(threadId)).toBe(false);
	});

	test("does not affect another guild's data", async () => {
		const guildId = freshId();
		const otherGuildId = freshId();
		const threadId = freshId();
		const userId = freshId();

		await setThreadResponseId(guildId, userId, threadId, "resp_a");
		await setThreadResponseId(otherGuildId, userId, threadId, "resp_b");

		// biome-ignore lint/suspicious/noExplicitAny: minimal fake matching what the listener reads
		await guildDeleteListener.run({ id: guildId } as any);

		expect(
			await getThreadResponseId(guildId, userId, threadId),
		).toBeUndefined();
		expect(await getThreadResponseId(otherGuildId, userId, threadId)).toBe(
			"resp_b",
		);
	});
});

describe("thread delete cleanup", () => {
	test("purges escalation and response state for the deleted thread", async () => {
		const guildId = freshId();
		const threadId = freshId();
		const userId = freshId();

		await setThreadResponseId(guildId, userId, threadId, "resp_abc");
		await setThreadEscalated(guildId, threadId);

		// biome-ignore lint/suspicious/noExplicitAny: minimal fake matching what the listener reads
		await threadDeleteListener.run({ id: threadId } as any);

		expect(
			await getThreadResponseId(guildId, userId, threadId),
		).toBeUndefined();
		expect(await isThreadEscalated(threadId)).toBe(false);
	});

	test("does not affect another thread's data", async () => {
		const guildId = freshId();
		const threadA = freshId();
		const threadB = freshId();

		await setThreadEscalated(guildId, threadA);
		await setThreadEscalated(guildId, threadB);

		// biome-ignore lint/suspicious/noExplicitAny: minimal fake matching what the listener reads
		await threadDeleteListener.run({ id: threadA } as any);

		expect(await isThreadEscalated(threadA)).toBe(false);
		expect(await isThreadEscalated(threadB)).toBe(true);
	});
});

describe("channel delete cleanup", () => {
	function createFakeForumChannel(options: {
		guildId: string;
		channelId: string;
		cachedThreadIds?: string[];
	}) {
		const cachedThreads = new Collection(
			(options.cachedThreadIds ?? []).map((threadId) => [
				threadId,
				{ id: threadId, isThread: () => true, parentId: options.channelId },
			]),
		);

		return {
			id: options.channelId,
			guildId: options.guildId,
			isThreadOnly: () => true,
			client: { channels: { cache: cachedThreads } },
			// biome-ignore lint/suspicious/noExplicitAny: minimal fake matching what the listener reads
		} as any;
	}

	test("removes the deleted channel from the guild's configured channels", async () => {
		const guildId = freshId();
		const channelId = freshId();

		await addSupportChannelId(guildId, channelId);

		await channelDeleteListener.run(
			createFakeForumChannel({ guildId, channelId }),
		);

		const settings = await getGuildSettingsIfExists(guildId);
		expect(settings?.channelIds).not.toContain(channelId);
	});

	test("cleans up state for cached threads that belonged to the deleted channel", async () => {
		const guildId = freshId();
		const channelId = freshId();
		const threadId = freshId();

		await setThreadEscalated(guildId, threadId);

		await channelDeleteListener.run(
			createFakeForumChannel({
				guildId,
				channelId,
				cachedThreadIds: [threadId],
			}),
		);

		expect(await isThreadEscalated(threadId)).toBe(false);
	});

	test("leaves unrelated channels and threads untouched", async () => {
		const guildId = freshId();
		const channelId = freshId();
		const otherChannelId = freshId();
		const unrelatedThreadId = freshId();

		await addSupportChannelId(guildId, channelId);
		await addSupportChannelId(guildId, otherChannelId);
		await setThreadEscalated(guildId, unrelatedThreadId);

		await channelDeleteListener.run(
			createFakeForumChannel({ guildId, channelId, cachedThreadIds: [] }),
		);

		const settings = await getGuildSettingsIfExists(guildId);
		expect(settings?.channelIds).toContain(otherChannelId);
		expect(await isThreadEscalated(unrelatedThreadId)).toBe(true);
	});
});
