import { version } from "@root/package.json";
import { ApplyOptions } from "@sapphire/decorators";
import { Listener, type ListenerOptions } from "@sapphire/framework";
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
}
