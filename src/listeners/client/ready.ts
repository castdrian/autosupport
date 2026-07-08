import { version } from "@root/package.json";
import { ApplyOptions } from "@sapphire/decorators";
import { Listener, type ListenerOptions } from "@sapphire/framework";
import data from "@src/data.toml";
import { getGuildSettingsIfExists } from "@src/database/db";
import { getOpenAIClient } from "@utils/autosupport";
import { ensureKnowledgeBaseFile } from "@utils/fileManager";
import { sweepStaleThreads } from "@utils/threadSweeper";
import { ActivityType, Events, User } from "discord.js";

const STALE_THREAD_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_FILE = "healthcheck.tmp";

@ApplyOptions<ListenerOptions>({ once: true, event: Events.ClientReady })
export class ReadyListener extends Listener {
	public async run() {
		if (!this.container.client.isReady()) return;
		await this.container.client.application?.fetch();

		const { username, id } = this.container.client.user;
		this.container.logger.info(
			`Successfully logged in as ${username} (${id}) v${version}`,
		);

		if (this.container.client.application?.owner instanceof User) {
			await this.container.client.application.owner
				.send(`Successfully logged in as ${username} (${id}) v${version}`)
				.catch(() => null);
		}

		this.warmKnowledgeBases().catch((error) =>
			this.container.logger.error(`Knowledge base warmup failed: ${error}`),
		);

		setInterval(async () => {
			this.container.client.user?.setActivity({
				type: ActivityType.Custom,
				state: "automating support",
				name: "autosupport",
			});
		}, 30e3);

		setInterval(async () => {
			if (!this.container.client.isReady()) return;
			await sweepStaleThreads(this.container.client).catch((error) =>
				this.container.logger.error(`Failed to sweep stale threads: ${error}`),
			);
		}, STALE_THREAD_SWEEP_INTERVAL_MS);

		const writeHeartbeat = () =>
			Bun.write(HEARTBEAT_FILE, Date.now().toString()).catch((error) =>
				this.container.logger.error(`Failed to write heartbeat file: ${error}`),
			);

		await writeHeartbeat();
		setInterval(writeHeartbeat, HEARTBEAT_INTERVAL_MS);
	}

	private async warmKnowledgeBases(): Promise<void> {
		const candidateGuildIds = Object.keys(data.support).filter((guildId) =>
			this.container.client.guilds.cache.has(guildId),
		);
		if (!candidateGuildIds.length) return;

		const settingsEntries = await Promise.all(
			candidateGuildIds.map(async (guildId) => ({
				guildId,
				settings: await getGuildSettingsIfExists(guildId),
			})),
		);
		const guildIds = settingsEntries
			.filter(({ settings }) => (settings?.channelIds.length ?? 0) > 0)
			.map(({ guildId }) => guildId);
		if (!guildIds.length) return;

		const openai = getOpenAIClient();
		this.container.logger.info(
			`Warming knowledge base for ${guildIds.length} guild(s)...`,
		);

		const results = await Promise.allSettled(
			guildIds.map((guildId) => ensureKnowledgeBaseFile(guildId, openai)),
		);
		const failed = results.filter((r) => r.status === "rejected").length;
		this.container.logger.info(
			`Knowledge base warmup complete: ${results.length - failed}/${results.length} succeeded.`,
		);
		if (failed > 0) {
			this.container.logger.error(
				`Knowledge base warmup failed for ${failed} guild(s).`,
			);
		}
	}
}
