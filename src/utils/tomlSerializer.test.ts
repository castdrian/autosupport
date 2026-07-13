import { describe, expect, it } from "bun:test";
import { escapeBasicString, serializeDataToml } from "@utils/tomlSerializer";

// Bun's runtime TOML parser lets us assert the serializer produces text that
// round-trips back to the exact structure we serialized.
const parseToml = (
	Bun as unknown as { TOML: { parse(input: string): unknown } }
).TOML.parse;

const GUILD_ID = "950850315601711176";

describe("escapeBasicString", () => {
	it("escapes control characters, quotes and backslashes", () => {
		expect(escapeBasicString('a"b\\c')).toBe('a\\"b\\\\c');
		expect(escapeBasicString("line1\nline2\ttab")).toBe("line1\\nline2\\ttab");
		expect(escapeBasicString(String.fromCharCode(0))).toBe("\\u0000");
	});

	it("leaves ordinary unicode untouched", () => {
		expect(escapeBasicString("naur cunt 🇦🇺")).toBe("naur cunt 🇦🇺");
	});
});

describe("serializeDataToml", () => {
	it("round-trips instructions and support entries", () => {
		const data = {
			instructions: {
				[GUILD_ID]: "You are a support bot.\nBe helpful.\n",
			},
			support: {
				[GUILD_ID]: [
					{ problem: "How do I X?", solution: "Do Y." },
					{
						problem: "Issue with Z?",
						solution: 'Use "the fix".',
						notes: "Multi\nline\nnotes with \\ backslash",
					},
				],
			},
		};

		const serialized = serializeDataToml(data);
		const parsed = parseToml(serialized) as typeof data;

		expect(parsed).toEqual(data);
	});

	it("omits empty notes", () => {
		const data = {
			instructions: {},
			support: {
				[GUILD_ID]: [{ problem: "P", solution: "S", notes: "" }],
			},
		};

		const parsed = parseToml(serializeDataToml(data)) as {
			support: Record<string, Array<Record<string, unknown>>>;
		};

		expect(parsed.support[GUILD_ID][0]).toEqual({
			problem: "P",
			solution: "S",
		});
		expect("notes" in parsed.support[GUILD_ID][0]).toBe(false);
	});

	it("handles multiple guilds", () => {
		const data = {
			instructions: {
				"111111111111111111": "one",
				"222222222222222222": "two",
			},
			support: {
				"111111111111111111": [{ problem: "a", solution: "b" }],
				"222222222222222222": [
					{ problem: "c", solution: "d" },
					{ problem: "e", solution: "f" },
				],
			},
		};

		const parsed = parseToml(serializeDataToml(data));

		expect(parsed).toEqual(data);
	});
});
