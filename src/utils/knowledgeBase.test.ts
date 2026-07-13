import { beforeEach, describe, expect, mock, test } from "bun:test";

interface MutableData {
	instructions: Record<string, string>;
	support: Record<
		string,
		Array<{ problem: string; solution: string; notes?: string }>
	>;
}

const data: MutableData = { instructions: {}, support: {} };

let commitShouldFail = false;
let refreshShouldFail = false;

const commitDataFile = mock(async (_content: string, _message: string) => {
	if (commitShouldFail) throw new Error("commit boom");
});
const invalidateKnowledgeBaseCache = mock(async () => {
	if (refreshShouldFail) throw new Error("refresh boom");
});
const ensureKnowledgeBaseFile = mock(async () => "vs-id");

mock.module("@src/data.toml", () => ({ default: data }));
mock.module("@utils/githubCommit", () => ({ commitDataFile }));
mock.module("@utils/fileManager", () => ({
	ensureKnowledgeBaseFile,
	invalidateKnowledgeBaseCache,
}));

const {
	addSupportEntry,
	deleteSupportEntry,
	getSupportEntries,
	getSupportEntry,
	updateSupportEntry,
} = await import("./knowledgeBase");

const GUILD = "950850315601711176";

beforeEach(() => {
	data.instructions = {};
	data.support = {};
	commitShouldFail = false;
	refreshShouldFail = false;
	commitDataFile.mockClear();
	invalidateKnowledgeBaseCache.mockClear();
	ensureKnowledgeBaseFile.mockClear();
});

describe("getSupportEntries / getSupportEntry", () => {
	test("returns an empty array for an unknown guild", () => {
		expect(getSupportEntries("nope")).toEqual([]);
		expect(getSupportEntry("nope", 0)).toBeUndefined();
	});
});

describe("addSupportEntry", () => {
	test("appends a normalized entry, commits and refreshes", async () => {
		const result = await addSupportEntry(GUILD, {
			problem: "  How? ",
			solution: " Like this ",
			notes: "  ",
		});

		expect(result.knowledgeBaseRefreshed).toBe(true);
		expect(getSupportEntries(GUILD)).toEqual([
			{ problem: "How?", solution: "Like this" },
		]);
		expect(commitDataFile).toHaveBeenCalledTimes(1);
		expect(commitDataFile.mock.calls[0][1]).toContain("[skip ci]");
		expect(invalidateKnowledgeBaseCache).toHaveBeenCalledWith(GUILD);
		expect(ensureKnowledgeBaseFile).toHaveBeenCalledTimes(1);
	});

	test("keeps non-empty notes", async () => {
		await addSupportEntry(GUILD, {
			problem: "P",
			solution: "S",
			notes: "extra",
		});
		expect(getSupportEntries(GUILD)[0]).toEqual({
			problem: "P",
			solution: "S",
			notes: "extra",
		});
	});

	test("rolls back the in-memory change when the commit fails", async () => {
		commitShouldFail = true;
		await expect(
			addSupportEntry(GUILD, { problem: "P", solution: "S" }),
		).rejects.toThrow("commit boom");
		expect(getSupportEntries(GUILD)).toEqual([]);
		expect(ensureKnowledgeBaseFile).not.toHaveBeenCalled();
	});

	test("reports refresh failure without throwing", async () => {
		refreshShouldFail = true;
		const result = await addSupportEntry(GUILD, {
			problem: "P",
			solution: "S",
		});
		expect(result.knowledgeBaseRefreshed).toBe(false);
		expect(getSupportEntries(GUILD)).toHaveLength(1);
	});
});

describe("updateSupportEntry", () => {
	test("replaces the entry at the index", async () => {
		data.support[GUILD] = [
			{ problem: "old", solution: "old" },
			{ problem: "keep", solution: "keep" },
		];
		await updateSupportEntry(GUILD, 0, { problem: "new", solution: "new" });
		expect(getSupportEntries(GUILD)).toEqual([
			{ problem: "new", solution: "new" },
			{ problem: "keep", solution: "keep" },
		]);
	});

	test("throws for an out-of-range index", async () => {
		data.support[GUILD] = [{ problem: "a", solution: "b" }];
		await expect(
			updateSupportEntry(GUILD, 5, { problem: "x", solution: "y" }),
		).rejects.toBeInstanceOf(RangeError);
		expect(commitDataFile).not.toHaveBeenCalled();
	});
});

describe("deleteSupportEntry", () => {
	test("removes the entry at the index", async () => {
		data.support[GUILD] = [
			{ problem: "a", solution: "b" },
			{ problem: "c", solution: "d" },
		];
		await deleteSupportEntry(GUILD, 0);
		expect(getSupportEntries(GUILD)).toEqual([{ problem: "c", solution: "d" }]);
		expect(ensureKnowledgeBaseFile).toHaveBeenCalledTimes(1);
	});

	test("does not rebuild the store when the last entry is removed", async () => {
		data.support[GUILD] = [{ problem: "a", solution: "b" }];
		const result = await deleteSupportEntry(GUILD, 0);
		expect(getSupportEntries(GUILD)).toEqual([]);
		expect(invalidateKnowledgeBaseCache).toHaveBeenCalledWith(GUILD);
		expect(ensureKnowledgeBaseFile).not.toHaveBeenCalled();
		expect(result.knowledgeBaseRefreshed).toBe(true);
	});

	test("throws for an out-of-range index", async () => {
		data.support[GUILD] = [{ problem: "a", solution: "b" }];
		await expect(deleteSupportEntry(GUILD, 9)).rejects.toBeInstanceOf(
			RangeError,
		);
	});
});
