import { describe, expect, test } from "bun:test";
import { hashSupportData, normalizeSupportData } from "@utils/fileManager";

describe("normalizeSupportData", () => {
	test("normalizes missing notes to null", () => {
		expect(normalizeSupportData([{ problem: "p", solution: "s" }])).toEqual([
			{ problem: "p", solution: "s", notes: null },
		]);
	});

	test("preserves provided notes", () => {
		expect(
			normalizeSupportData([{ problem: "p", solution: "s", notes: "n" }]),
		).toEqual([{ problem: "p", solution: "s", notes: "n" }]);
	});
});

describe("hashSupportData", () => {
	test("is deterministic for identical content", () => {
		const a = normalizeSupportData([{ problem: "p", solution: "s" }]);
		const b = normalizeSupportData([{ problem: "p", solution: "s" }]);

		expect(hashSupportData(a)).toBe(hashSupportData(b));
	});

	test("changes when content changes", () => {
		const a = normalizeSupportData([{ problem: "p", solution: "s" }]);
		const b = normalizeSupportData([{ problem: "p", solution: "different" }]);

		expect(hashSupportData(a)).not.toBe(hashSupportData(b));
	});

	test("changes when entry order changes", () => {
		const a = normalizeSupportData([
			{ problem: "p1", solution: "s1" },
			{ problem: "p2", solution: "s2" },
		]);
		const b = normalizeSupportData([
			{ problem: "p2", solution: "s2" },
			{ problem: "p1", solution: "s1" },
		]);

		expect(hashSupportData(a)).not.toBe(hashSupportData(b));
	});
});
