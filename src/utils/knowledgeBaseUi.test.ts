import { describe, expect, it } from "bun:test";
import type { SupportEntry } from "@utils/knowledgeBase";
import {
	buildCustomId,
	buildDeleteConfirmView,
	buildEntryModal,
	buildListView,
	KB_ADD_MODAL_ID,
	KB_EDIT_MODAL_PREFIX,
	KB_LIST_PREFIX,
	parseIndexCustomId,
	resultMessage,
	truncate,
} from "@utils/knowledgeBaseUi";
import { StatusColor } from "@utils/statusMessage";

const entry = (over: Partial<SupportEntry> = {}): SupportEntry => ({
	problem: "How do I X?",
	solution: "Do Y.",
	...over,
});

describe("buildCustomId / parseIndexCustomId", () => {
	it("round-trips an index", () => {
		const id = buildCustomId(KB_LIST_PREFIX, 3);
		expect(id).toBe("kb_list:3");
		expect(parseIndexCustomId(id, KB_LIST_PREFIX)).toBe(3);
	});

	it("returns undefined for a non-matching prefix", () => {
		expect(
			parseIndexCustomId("kb_list:2", KB_EDIT_MODAL_PREFIX),
		).toBeUndefined();
	});

	it("returns undefined for a non-numeric or negative index", () => {
		expect(parseIndexCustomId("kb_list:abc", KB_LIST_PREFIX)).toBeUndefined();
		expect(parseIndexCustomId("kb_list:-1", KB_LIST_PREFIX)).toBeUndefined();
	});
});

describe("truncate", () => {
	it("leaves short strings untouched", () => {
		expect(truncate("short", 10)).toBe("short");
	});

	it("adds an ellipsis when over the limit", () => {
		expect(truncate("abcdef", 4)).toBe("abc…");
	});
});

describe("resultMessage", () => {
	it("reports success when the knowledge base refreshed", () => {
		const message = resultMessage(true, "Entry added.");
		expect(message.color).toBe(StatusColor.Success);
		expect(message.content).toBe("Entry added.");
	});

	it("warns when the refresh did not happen", () => {
		const message = resultMessage(false, "Entry added.");
		expect(message.color).toBe(StatusColor.Warning);
		expect(message.content).toContain("Entry added.");
		expect(message.content).toContain("rebuild automatically");
	});
});

describe("buildListView", () => {
	it("shows an empty-state container when there are no entries", () => {
		const view = buildListView([], 0);
		expect(view).toHaveLength(1);
		expect(JSON.stringify(view[0].toJSON())).toContain("No entries yet");
	});

	it("renders the entry at the given index with pagination", () => {
		const entries = [entry({ problem: "First" }), entry({ problem: "Second" })];
		const json = JSON.stringify(buildListView(entries, 1)[0].toJSON());
		expect(json).toContain("Second");
		expect(json).toContain("entry 2 of 2");
	});

	it("clamps an out-of-range index into the valid range", () => {
		const entries = [entry({ problem: "Only" })];
		const json = JSON.stringify(buildListView(entries, 99)[0].toJSON());
		expect(json).toContain("Only");
		expect(json).toContain("entry 1 of 1");
	});

	it("includes notes when present", () => {
		const json = JSON.stringify(
			buildListView([entry({ notes: "Extra context" })], 0)[0].toJSON(),
		);
		expect(json).toContain("Extra context");
	});
});

describe("buildDeleteConfirmView", () => {
	it("carries the entry index in the confirm button", () => {
		const json = JSON.stringify(
			buildDeleteConfirmView(entry({ problem: "Doomed" }), 4)[0].toJSON(),
		);
		expect(json).toContain("Doomed");
		expect(json).toContain("kb_delete_confirm:4");
	});
});

describe("buildEntryModal", () => {
	it("builds an add modal with an empty custom id", () => {
		const json = buildEntryModal().toJSON();
		expect(json.custom_id).toBe(KB_ADD_MODAL_ID);
		expect(json.title).toContain("Add");
	});

	it("builds an edit modal prefilled with the entry values", () => {
		const modal = buildEntryModal({
			index: 2,
			value: entry({ problem: "P", solution: "S", notes: "N" }),
		});
		const json = modal.toJSON();
		expect(json.custom_id).toBe(`${KB_EDIT_MODAL_PREFIX}:2`);
		expect(json.title).toContain("Edit");
		const serialized = JSON.stringify(json);
		expect(serialized).toContain("P");
		expect(serialized).toContain("S");
		expect(serialized).toContain("N");
	});
});
