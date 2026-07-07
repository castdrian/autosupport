import { Listener } from "@sapphire/framework";
import type { CloseEvent } from "discord.js";

export class ShardDisconnectListener extends Listener {
	public run(event: CloseEvent, id: string) {
		this.container.logger.info(
			`Shard ${id} disconnected:\nCode: ${event.code}\nReason: ${event.reason}`,
		);
	}
}
