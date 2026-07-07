import { describe, expect, test } from "bun:test";
import { cleanResponseText, splitContent } from "./autosupport";

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
