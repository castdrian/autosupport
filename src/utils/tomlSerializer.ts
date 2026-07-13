import type data from "@src/data.toml";

type TomlData = typeof data;

// Escapes a value for use inside a TOML basic (single-line, double-quoted)
// string. Newlines and other control characters become escape sequences so the
// value always stays on one line and re-parses to exactly what went in.
export function escapeBasicString(value: string): string {
	let result = "";
	for (const char of value) {
		const code = char.codePointAt(0) ?? 0;
		switch (char) {
			case "\\":
				result += "\\\\";
				break;
			case '"':
				result += '\\"';
				break;
			case "\b":
				result += "\\b";
				break;
			case "\t":
				result += "\\t";
				break;
			case "\n":
				result += "\\n";
				break;
			case "\f":
				result += "\\f";
				break;
			case "\r":
				result += "\\r";
				break;
			default:
				// Remaining control characters must be escaped as \uXXXX per the
				// TOML spec; everything else can pass through verbatim.
				if (code <= 0x1f || code === 0x7f) {
					result += `\\u${code.toString(16).padStart(4, "0")}`;
				} else {
					result += char;
				}
		}
	}
	return result;
}

function basicString(value: string): string {
	return `"${escapeBasicString(value)}"`;
}

// Escapes a value for use inside a TOML multi-line basic string ("""..."""),
// used only for the instruction blocks so they keep their readable formatting.
function escapeMultilineString(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"""/g, '""\\"');
}

// A guild id is a purely numeric key; it still has to be quoted when used as a
// TOML key (both in bare tables and dotted table headers).
function quotedKey(key: string): string {
	return `"${escapeBasicString(key)}"`;
}

// Serializes the in-memory data.toml object back into TOML text. Instruction
// blocks are emitted as multi-line strings to preserve their formatting; the
// support entries we actually manage are emitted as basic strings.
export function serializeDataToml(source: TomlData): string {
	const lines: string[] = [];

	lines.push("[instructions]");
	for (const [guildId, instructions] of Object.entries(source.instructions)) {
		// Bun's TOML parser does not trim the newline after the opening """, so
		// the value is emitted verbatim between the delimiters to round-trip
		// exactly (the stored value already carries its own leading newline).
		lines.push(
			`${quotedKey(guildId)} = """${escapeMultilineString(instructions)}"""`,
		);
	}

	lines.push("");
	lines.push("[support]");
	for (const [guildId, entries] of Object.entries(source.support)) {
		for (const entry of entries) {
			lines.push("");
			lines.push(`[[support.${quotedKey(guildId)}]]`);
			lines.push(`problem = ${basicString(entry.problem)}`);
			lines.push(`solution = ${basicString(entry.solution)}`);
			if (entry.notes != null && entry.notes.length > 0) {
				lines.push(`notes = ${basicString(entry.notes)}`);
			}
		}
	}

	return `${lines.join("\n")}\n`;
}
