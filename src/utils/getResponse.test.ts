import { describe, expect, mock, test } from "bun:test";

mock.module("@utils/fileManager", () => ({
	ensureKnowledgeBaseFile: mock(async () => "vs_test123"),
	invalidateKnowledgeBaseCache: mock(async () => {}),
}));

const fileManager = await import("@utils/fileManager");
const {
	getResponse,
	getOpenAIClient,
	THREAD_RATE_LIMIT_MAX_MESSAGES,
	USER_RATE_LIMIT_MAX_MESSAGES,
} = await import("@utils/autosupport");
const { getThreadResponseId, setThreadEscalated } = await import(
	"@src/database/db"
);

let nextId = 400000000000000001n;
function freshId(): string {
	return String(nextId++);
}

interface FakeThread {
	id: string;
	name: string;
	isThread: () => boolean;
	parent: { isThreadOnly: () => boolean; availableTags: FakeTag[] };
	sendTyping: () => Promise<void>;
	send: ReturnType<typeof mock>;
}

interface FakeTag {
	id: string;
	name: string;
}

function createFakeMessage(options: {
	content?: string;
	guildId?: string;
	threadId?: string;
	userId?: string;
	availableTags?: FakeTag[];
}) {
	const guildId = options.guildId ?? freshId();
	const threadId = options.threadId ?? freshId();
	const userId = options.userId ?? freshId();

	const channel: FakeThread = {
		id: threadId,
		name: "test-thread",
		isThread: () => true,
		parent: {
			isThreadOnly: () => true,
			availableTags: options.availableTags ?? [],
		},
		sendTyping: mock(async () => {}),
		send: mock(async (_options: unknown) => ({})),
	};

	const reply = mock(async (_options: unknown) => ({}));
	const loggerError = mock((_message: unknown) => {});

	const message = {
		content: options.content ?? "hello there",
		attachments: new Map(),
		guildId,
		channelId: threadId,
		author: {
			id: userId,
			displayName: "Tester",
			username: "tester",
		},
		channel,
		inGuild: () => true,
		reply,
		client: {
			logger: { error: loggerError },
		},
	};

	return {
		message: message as unknown as Parameters<typeof getResponse>[0],
		reply,
		channelSend: channel.send,
		loggerError,
		guildId,
		threadId,
		userId,
	};
}

function mockOpenAIResponse(
	impl: (...args: unknown[]) => unknown,
): ReturnType<typeof mock> {
	const openai = getOpenAIClient();
	const fn = mock(impl);
	// biome-ignore lint/suspicious/noExplicitAny: patching the shared SDK singleton for tests
	(openai.responses as any).create = fn;
	return fn;
}

describe("getResponse", () => {
	test("sends a single-chunk reply and persists response continuity", async () => {
		const { message, reply, guildId, threadId, userId } = createFakeMessage({});
		mockOpenAIResponse(async () => ({
			id: "resp_abc123",
			output_text: "Here is your answer.",
		}));

		await getResponse(message);

		expect(reply).toHaveBeenCalledTimes(1);
		expect(await getThreadResponseId(guildId, userId, threadId)).toBe(
			"resp_abc123",
		);
	});

	test("does not respond when the thread has already requested human assistance", async () => {
		const { message, reply, guildId, threadId } = createFakeMessage({});
		await setThreadEscalated(guildId, threadId);
		const create = mockOpenAIResponse(async () => ({
			id: "resp_should_not_be_used",
			output_text: "unused",
		}));

		await getResponse(message);

		expect(create).not.toHaveBeenCalled();
		expect(reply).not.toHaveBeenCalled();
	});

	test("rate limits after the per-thread message cap is exceeded", async () => {
		const guildId = freshId();
		const threadId = freshId();
		const userId = freshId();
		mockOpenAIResponse(async () => ({
			id: "resp_ratelimit",
			output_text: "answer",
		}));

		let lastReply: ReturnType<typeof mock> | undefined;
		for (let i = 0; i < 5; i++) {
			const fake = createFakeMessage({ guildId, threadId, userId });
			lastReply = fake.reply;
			await getResponse(fake.message);
		}

		expect(lastReply).toHaveBeenCalledTimes(1);
		const warningCall = lastReply?.mock.calls[0]?.[0] as {
			components: unknown[];
		};
		expect(JSON.stringify(warningCall)).toContain(
			"sending messages too quickly",
		);
	});

	test("splits a long response across multiple messages", async () => {
		const { message, reply, channelSend } = createFakeMessage({});
		const longText = "a".repeat(9000);
		mockOpenAIResponse(async () => ({
			id: "resp_long",
			output_text: longText,
		}));

		await getResponse(message);

		expect(reply).toHaveBeenCalledTimes(1);
		expect(channelSend).toHaveBeenCalledTimes(2);
	});

	test("does not refund the rate limit and posts a partial-failure notice when a later chunk fails to send", async () => {
		const { message, reply, channelSend, guildId, threadId, userId } =
			createFakeMessage({});
		const longText = "a".repeat(9000);
		mockOpenAIResponse(async () => ({
			id: "resp_partial",
			output_text: longText,
		}));
		channelSend.mockImplementationOnce(async () => {
			throw new Error("network blip");
		});

		await getResponse(message);

		expect(reply).toHaveBeenCalledTimes(1);
		expect(channelSend).toHaveBeenCalledTimes(2);
		const noticeCall = channelSend.mock.calls[1]?.[0] as {
			components: unknown[];
		};
		expect(JSON.stringify(noticeCall)).toContain("couldn't be sent");

		for (let i = 0; i < 4; i++) {
			const followUp = createFakeMessage({ guildId, threadId, userId });
			mockOpenAIResponse(async () => ({
				id: `resp_followup_${i}`,
				output_text: "ok",
			}));
			await getResponse(followUp.message);
			if (i < 3) {
				expect(followUp.reply).toHaveBeenCalledTimes(1);
			} else {
				const call = followUp.reply.mock.calls[0]?.[0] as {
					components: unknown[];
				};
				expect(JSON.stringify(call)).toContain("sending messages too quickly");
			}
		}
	});

	test("refunds the rate limit when nothing was delivered", async () => {
		const guildId = freshId();
		const threadId = freshId();
		const userId = freshId();

		for (let i = 0; i < 4; i++) {
			const fake = createFakeMessage({ guildId, threadId, userId });
			mockOpenAIResponse(async () => {
				throw new Error("boom");
			});
			await getResponse(fake.message);
			expect(fake.reply).toHaveBeenCalledTimes(1);
			const call = fake.reply.mock.calls[0]?.[0] as { components: unknown[] };
			expect(JSON.stringify(call)).toContain(
				"encountered an error while processing",
			);
		}

		const fifth = createFakeMessage({ guildId, threadId, userId });
		mockOpenAIResponse(async () => ({
			id: "resp_fifth",
			output_text: "finally works",
		}));
		await getResponse(fifth.message);
		expect(fifth.reply).toHaveBeenCalledTimes(1);
		const call = fifth.reply.mock.calls[0]?.[0] as { components: unknown[] };
		expect(JSON.stringify(call)).not.toContain("sending messages too quickly");
	});

	test("clears the stale response id and resets the conversation on a stale previous_response_id error", async () => {
		const { message, reply, guildId, threadId, userId } = createFakeMessage({});
		await import("@src/database/db").then(({ setThreadResponseId }) =>
			setThreadResponseId(guildId, userId, threadId, "resp_stale"),
		);

		const OpenAI = (await import("openai")).default;
		mockOpenAIResponse(async () => {
			throw new OpenAI.APIError(
				404,
				{ param: "previous_response_id" },
				"Previous response not found",
				undefined,
			);
		});

		await getResponse(message);

		expect(reply).toHaveBeenCalledTimes(1);
		const call = reply.mock.calls[0]?.[0] as { components: unknown[] };
		expect(JSON.stringify(call)).toContain("lost track of this conversation");
		expect(
			await getThreadResponseId(guildId, userId, threadId),
		).toBeUndefined();
	});

	test("invalidates the knowledge base cache on a missing vector store error", async () => {
		const { message, reply } = createFakeMessage({});
		const OpenAI = (await import("openai")).default;
		mockOpenAIResponse(async () => {
			throw new OpenAI.APIError(
				404,
				undefined,
				"Vector store vs_gone123 not found",
				undefined,
			);
		});

		const invalidateSpy =
			fileManager.invalidateKnowledgeBaseCache as ReturnType<typeof mock>;
		invalidateSpy.mockClear();

		await getResponse(message);

		expect(invalidateSpy).toHaveBeenCalledTimes(1);
		expect(reply).toHaveBeenCalledTimes(1);
		const call = reply.mock.calls[0]?.[0] as { components: unknown[] };
		expect(JSON.stringify(call)).toContain(
			"trouble accessing the knowledge base",
		);
	});

	test("shows the Request Human button only when a matching forum tag exists", async () => {
		const { message, reply } = createFakeMessage({
			availableTags: [{ id: "tag1", name: "Needs Human" }],
		});
		mockOpenAIResponse(async () => ({
			id: "resp_withtag",
			output_text: "answer",
		}));

		await getResponse(message);

		const call = reply.mock.calls[0]?.[0] as { components: unknown[] };
		expect(JSON.stringify(call)).toContain("request_human");
	});

	test("concurrency: exactly THREAD_RATE_LIMIT_MAX_MESSAGES succeed when many arrive at once in the same thread", async () => {
		const guildId = freshId();
		const threadId = freshId();
		const userId = freshId();

		mockOpenAIResponse(async () => ({
			id: "resp_concurrent_thread",
			output_text: "ok",
		}));

		const fakes = Array.from({ length: 20 }, () =>
			createFakeMessage({ guildId, threadId, userId }),
		);

		await Promise.all(fakes.map((fake) => getResponse(fake.message)));

		for (const fake of fakes) {
			expect(fake.reply).toHaveBeenCalledTimes(1);
		}

		const succeeded = fakes.filter((fake) => {
			const call = fake.reply.mock.calls[0]?.[0] as { components: unknown[] };
			return !JSON.stringify(call).includes("sending messages too quickly");
		});

		expect(succeeded).toHaveLength(THREAD_RATE_LIMIT_MAX_MESSAGES);
	});

	test("concurrency: exactly USER_RATE_LIMIT_MAX_MESSAGES succeed when many arrive at once across different threads for the same user", async () => {
		const guildId = freshId();
		const userId = freshId();

		mockOpenAIResponse(async () => ({
			id: "resp_concurrent_user",
			output_text: "ok",
		}));

		const fakes = Array.from({ length: 20 }, () =>
			createFakeMessage({ guildId, userId }),
		);

		await Promise.all(fakes.map((fake) => getResponse(fake.message)));

		for (const fake of fakes) {
			expect(fake.reply).toHaveBeenCalledTimes(1);
		}

		const succeeded = fakes.filter((fake) => {
			const call = fake.reply.mock.calls[0]?.[0] as { components: unknown[] };
			return !JSON.stringify(call).includes("sending messages too quickly");
		});

		expect(succeeded).toHaveLength(USER_RATE_LIMIT_MAX_MESSAGES);
	});
});
