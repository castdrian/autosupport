import { describe, expect, test } from "bun:test";
import { cleanResponseText } from "./autosupport";

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
