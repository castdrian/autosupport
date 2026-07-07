import { Listener } from "@sapphire/framework";

export class ShardErrorListener extends Listener {
	public run(error: Error, shardID: number) {
		this.container.logger.error(
			`Shard ${shardID} has encountered a connection error:\n${error.stack}`,
		);
	}
}
