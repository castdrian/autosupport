import { describe, expect, test } from "bun:test";
import { lastActivityTimestamp } from "@utils/threadSweeper";
import { SnowflakeUtil } from "discord.js";

describe("lastActivityTimestamp", () => {
	test("derives the timestamp from lastMessageId when present", () => {
		const timestamp = Date.now() - 60_000;
		const snowflake = SnowflakeUtil.generate({ timestamp }).toString();

		const result = lastActivityTimestamp({
			lastMessageId: snowflake,
			createdTimestamp: 0,
		});

		expect(result).toBe(timestamp);
	});

	test("falls back to createdTimestamp when lastMessageId is null", () => {
		const createdTimestamp = Date.now() - 3_600_000;

		const result = lastActivityTimestamp({
			lastMessageId: null,
			createdTimestamp,
		});

		expect(result).toBe(createdTimestamp);
	});

	test("falls back to 0 when both lastMessageId and createdTimestamp are null", () => {
		const result = lastActivityTimestamp({
			lastMessageId: null,
			createdTimestamp: null,
		});

		expect(result).toBe(0);
	});

	test("prefers lastMessageId over createdTimestamp when both are present", () => {
		const messageTimestamp = Date.now() - 1_000;
		const createdTimestamp = Date.now() - 999_999;
		const snowflake = SnowflakeUtil.generate({
			timestamp: messageTimestamp,
		}).toString();

		const result = lastActivityTimestamp({
			lastMessageId: snowflake,
			createdTimestamp,
		});

		expect(result).toBe(messageTimestamp);
	});
});
