import { describe, expect, test } from "bun:test";
import {
	buildInputContent,
	cleanResponseText,
	isMissingVectorStoreError,
	isStaleResponseIdError,
	MAX_ATTACHMENT_SIZE_BYTES,
	MAX_ATTACHMENTS,
	splitContent,
} from "@utils/autosupport";
import type { Message } from "discord.js";
import OpenAI from "openai";

interface FakeAttachment {
	size: number;
	contentType: string | null;
	url: string;
	name: string;
}

function createMessage(
	content: string,
	attachments: FakeAttachment[],
): Message {
	return {
		content,
		attachments: new Map(
			attachments.map((attachment, i) => [String(i), attachment]),
		),
	} as unknown as Message;
}

describe("cleanResponseText", () => {
	test("strips file citation markers", () => {
		expect(cleanResponseText("Answer【4:0†source】")).toBe("Answer");
	});

	test("strips caret-style footnote markers", () => {
		expect(cleanResponseText("Answer[^12^]")).toBe("Answer");
	});

	test("strips bracketed numeric citations", () => {
		expect(cleanResponseText("Answer[42]")).toBe("Answer");
	});

	test("trims surrounding whitespace", () => {
		expect(cleanResponseText("  Answer  ")).toBe("Answer");
	});

	test("leaves plain text untouched", () => {
		expect(cleanResponseText("Just a plain answer.")).toBe(
			"Just a plain answer.",
		);
	});
});

describe("splitContent", () => {
	test("returns a single chunk when under the limit", () => {
		expect(splitContent("short answer", 100)).toEqual(["short answer"]);
	});

	test("splits on a paragraph break when possible", () => {
		const content = `${"a".repeat(50)}\n\n${"b".repeat(50)}`;
		const chunks = splitContent(content, 60);

		expect(chunks).toEqual(["a".repeat(50), "b".repeat(50)]);
	});

	test("falls back to a hard cut when no whitespace is available", () => {
		const content = "a".repeat(120);
		const chunks = splitContent(content, 50);

		expect(chunks).toEqual(["a".repeat(50), "a".repeat(50), "a".repeat(20)]);
	});

	test("never drops any characters across chunks", () => {
		const content = Array.from({ length: 30 }, (_, i) => `sentence ${i}.`).join(
			" ",
		);
		const chunks = splitContent(content, 40);

		expect(chunks.join(" ").replace(/\s+/g, " ")).toBe(
			content.replace(/\s+/g, " "),
		);
	});
});

describe("buildInputContent", () => {
	test("includes text content", () => {
		const result = buildInputContent(createMessage("hello", []));

		expect(result.content).toEqual([{ type: "input_text", text: "hello" }]);
		expect(result.droppedAttachments).toBe(0);
	});

	test("includes image attachments as input_image", () => {
		const result = buildInputContent(
			createMessage("", [
				{
					size: 100,
					contentType: "image/png",
					url: "https://example.com/img.png",
					name: "img.png",
				},
			]),
		);

		expect(result.content).toEqual([
			{
				type: "input_image",
				image_url: "https://example.com/img.png",
				detail: "auto",
			},
		]);
		expect(result.droppedAttachments).toBe(0);
	});

	test("includes non-image attachments as input_file", () => {
		const result = buildInputContent(
			createMessage("", [
				{
					size: 100,
					contentType: "application/pdf",
					url: "https://example.com/doc.pdf",
					name: "doc.pdf",
				},
			]),
		);

		expect(result.content).toEqual([
			{
				type: "input_file",
				file_url: "https://example.com/doc.pdf",
				filename: "doc.pdf",
			},
		]);
		expect(result.droppedAttachments).toBe(0);
	});

	test("drops attachments over the size cap", () => {
		const result = buildInputContent(
			createMessage("", [
				{
					size: MAX_ATTACHMENT_SIZE_BYTES + 1,
					contentType: "image/png",
					url: "https://example.com/huge.png",
					name: "huge.png",
				},
			]),
		);

		expect(result.content).toEqual([]);
		expect(result.droppedAttachments).toBe(1);
	});

	test("drops unsupported attachment types", () => {
		const result = buildInputContent(
			createMessage("", [
				{
					size: 100,
					contentType: "video/mp4",
					url: "https://example.com/clip.mp4",
					name: "clip.mp4",
				},
			]),
		);

		expect(result.content).toEqual([]);
		expect(result.droppedAttachments).toBe(1);
	});

	test("caps attachments at MAX_ATTACHMENTS and drops the rest", () => {
		const attachments = Array.from({ length: MAX_ATTACHMENTS + 2 }, (_, i) => ({
			size: 100,
			contentType: "image/png",
			url: `https://example.com/img${i}.png`,
			name: `img${i}.png`,
		}));

		const result = buildInputContent(createMessage("", attachments));

		expect(result.content).toHaveLength(MAX_ATTACHMENTS);
		expect(result.droppedAttachments).toBe(2);
	});
});

describe("isMissingVectorStoreError", () => {
	test("returns false for a 404 API error unrelated to vector stores", () => {
		const error = new OpenAI.APIError(404, undefined, "Not Found", undefined);
		expect(isMissingVectorStoreError(error)).toBe(false);
	});

	test("returns true when the message mentions a missing vector store", () => {
		const error = new OpenAI.APIError(
			400,
			undefined,
			"Vector store vs_abc123 not found",
			undefined,
		);
		expect(isMissingVectorStoreError(error)).toBe(true);
	});

	test("returns false for unrelated API errors", () => {
		const error = new OpenAI.APIError(
			500,
			undefined,
			"Internal server error",
			undefined,
		);
		expect(isMissingVectorStoreError(error)).toBe(false);
	});

	test("returns false for non-API errors", () => {
		expect(isMissingVectorStoreError(new Error("some other failure"))).toBe(
			false,
		);
		expect(isMissingVectorStoreError("not an error")).toBe(false);
		expect(isMissingVectorStoreError(undefined)).toBe(false);
	});
});

describe("isStaleResponseIdError", () => {
	test("returns true when the error param is previous_response_id", () => {
		const error = new OpenAI.APIError(
			404,
			{ param: "previous_response_id" },
			"Previous response not found",
			undefined,
		);
		expect(isStaleResponseIdError(error)).toBe(true);
	});

	test("returns true when the message mentions previous_response_id", () => {
		const error = new OpenAI.APIError(
			404,
			undefined,
			"previous_response_id 'resp_abc123' not found",
			undefined,
		);
		expect(isStaleResponseIdError(error)).toBe(true);
	});

	test("returns false for a 404 unrelated to previous_response_id", () => {
		const error = new OpenAI.APIError(404, undefined, "Not Found", undefined);
		expect(isStaleResponseIdError(error)).toBe(false);
	});

	test("returns false for a non-404 error mentioning previous_response_id", () => {
		const error = new OpenAI.APIError(
			400,
			undefined,
			"previous_response_id must be a string",
			undefined,
		);
		expect(isStaleResponseIdError(error)).toBe(false);
	});

	test("returns false for non-API errors", () => {
		expect(isStaleResponseIdError(new Error("some other failure"))).toBe(false);
		expect(isStaleResponseIdError("not an error")).toBe(false);
		expect(isStaleResponseIdError(undefined)).toBe(false);
	});
});
