import { Listener } from "@sapphire/framework";

export class ShardReadyListener extends Listener {
	public run(id: number) {
		this.container.logger.info(`Shard ${id} is connected!`);
	}
}
