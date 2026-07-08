import { Logger, type LogLevel } from "@sapphire/framework";
import { WebhookClient } from "discord.js";

const MAX_REPORTS_PER_WINDOW = 5;
const REPORT_WINDOW_MS = 60_000;
const MAX_CONTENT_LENGTH = 1900;

export class ErrorReportingLogger extends Logger {
	private readonly webhook: WebhookClient | undefined;
	private reportTimestamps: number[] = [];

	public constructor(level: LogLevel, webhookUrl: string | undefined) {
		super(level);
		this.webhook = webhookUrl
			? new WebhookClient({ url: webhookUrl })
			: undefined;
	}

	public override error(...values: readonly unknown[]): void {
		super.error(...values);
		this.report(values);
	}

	public override fatal(...values: readonly unknown[]): void {
		super.fatal(...values);
		this.report(values);
	}

	private report(values: readonly unknown[]): void {
		if (!this.webhook) return;

		const now = Date.now();
		this.reportTimestamps = this.reportTimestamps.filter(
			(timestamp) => now - timestamp < REPORT_WINDOW_MS,
		);
		if (this.reportTimestamps.length >= MAX_REPORTS_PER_WINDOW) return;
		this.reportTimestamps.push(now);

		const content = values
			.map((value) =>
				value instanceof Error ? (value.stack ?? value.message) : String(value),
			)
			.join(" ")
			.slice(0, MAX_CONTENT_LENGTH);

		this.webhook
			.send({ content: `\`\`\`\n${content}\n\`\`\`` })
			.catch(() => null);
	}
}
