import { describe, expect, test } from "bun:test";
import { MAX_TEXT_DISPLAY_LENGTH } from "@utils/autosupport";
import { StatusColor, statusContainer } from "@utils/statusMessage";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	SectionBuilder,
	TextDisplayBuilder,
} from "discord.js";

const DISCORD_TEXT_DISPLAY_CHAR_LIMIT = 4000;

describe("Discord Components V2 structural limits", () => {
	test("a TextDisplay at exactly Discord's 4000-character cap does not throw", () => {
		expect(() =>
			new TextDisplayBuilder()
				.setContent("a".repeat(DISCORD_TEXT_DISPLAY_CHAR_LIMIT))
				.toJSON(),
		).not.toThrow();
	});

	test("a TextDisplay one character past Discord's cap throws", () => {
		expect(() =>
			new TextDisplayBuilder()
				.setContent("a".repeat(DISCORD_TEXT_DISPLAY_CHAR_LIMIT + 1))
				.toJSON(),
		).toThrow();
	});

	test("MAX_TEXT_DISPLAY_LENGTH stays under Discord's per-component character cap", () => {
		expect(MAX_TEXT_DISPLAY_LENGTH).toBeLessThanOrEqual(
			DISCORD_TEXT_DISPLAY_CHAR_LIMIT,
		);
	});

	test("a chunk at exactly MAX_TEXT_DISPLAY_LENGTH builds without throwing", () => {
		expect(() =>
			new TextDisplayBuilder()
				.setContent("a".repeat(MAX_TEXT_DISPLAY_LENGTH))
				.toJSON(),
		).not.toThrow();
	});
});

describe("statusContainer payload validity", () => {
	test("produces a valid payload for every StatusColor", () => {
		for (const color of [
			StatusColor.Success,
			StatusColor.Warning,
			StatusColor.Danger,
			StatusColor.Neutral,
		]) {
			expect(() =>
				statusContainer(color, "test message").toJSON(),
			).not.toThrow();
		}
	});

	test("rejects content past Discord's per-component character cap", () => {
		expect(() =>
			statusContainer(
				StatusColor.Danger,
				"a".repeat(DISCORD_TEXT_DISPLAY_CHAR_LIMIT + 1),
			).toJSON(),
		).toThrow();
	});
});

describe("escalation announcement shape", () => {
	test("a SectionBuilder with a button accessory produces a valid payload", () => {
		const section = new SectionBuilder()
			.addTextDisplayComponents(
				new TextDisplayBuilder().setContent(
					"AI responses are paused for this thread.",
				),
			)
			.setButtonAccessory(
				new ButtonBuilder()
					.setLabel("Resume AI")
					.setEmoji("🔄")
					.setStyle(ButtonStyle.Secondary)
					.setCustomId("resume_ai"),
			);

		const payload = section.toJSON();
		expect(payload.accessory).toBeDefined();
		expect(payload.components).toHaveLength(1);
	});
});

describe("thread action row shape", () => {
	test("a single-button row produces a valid payload", () => {
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel("Close Thread")
				.setEmoji("✅")
				.setStyle(ButtonStyle.Success)
				.setCustomId("close_thread"),
		);

		expect(() => row.toJSON()).not.toThrow();
	});

	test("a two-button row produces a valid payload", () => {
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setLabel("Close Thread")
				.setEmoji("✅")
				.setStyle(ButtonStyle.Success)
				.setCustomId("close_thread"),
			new ButtonBuilder()
				.setLabel("Request Human")
				.setEmoji("🙋")
				.setStyle(ButtonStyle.Danger)
				.setCustomId("request_human"),
		);

		expect(() => row.toJSON()).not.toThrow();
	});
});
