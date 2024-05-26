import { ApplyOptions } from '@sapphire/decorators';
import { type ListenerOptions, Listener } from '@sapphire/framework';
import { ActivityType, User } from 'discord.js';
import { version } from '@root/package.json';

@ApplyOptions<ListenerOptions>({ once: true })
export class ReadyListener extends Listener {
	public async run() {
		await this.container.client.application?.fetch();
		const { username, id } = this.container.client.user!;
		this.container.logger.info(`Successfully logged in as ${username} (${id}) v${version}`);

		if (this.container.client.application?.owner instanceof User) {
			await this.container.client.application.owner.send(`Successfully logged in as ${username} (${id}) v${version}`).catch(() => null);
		}
		setInterval(() => this.container.client.user?.setActivity({ type: ActivityType.Custom, state: 'automating support', name: 'autosupport' }), 30e3);
	}
}
