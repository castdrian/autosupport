import { version } from "@root/package.json";
import { getInmates, removeInmate } from "@src/database/db";
import { ApplyOptions } from "@sapphire/decorators";
import { Listener, type ListenerOptions } from "@sapphire/framework";
import { ActivityType, User } from "discord.js";

@ApplyOptions<ListenerOptions>({ once: true })
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

		setInterval(
			async () => {
				this.container.client.user?.setActivity({
					type: ActivityType.Custom,
					state: "automating support",
					name: "autosupport",
				});

				const inmates = await getInmates();
				if (inmates.length === 0) return;

				const now = new Date();

				for (const inmate of inmates) {
					if (inmate.releaseDate < now) {
						await this.container.client.guilds.cache
							.get(inmate.guildId)
							?.members.cache.get(inmate.id)
							?.roles.remove(inmate.confinementRoleId);

						await removeInmate(inmate.id);
					}
				}
			},
			30e3,
		);
	}
}
