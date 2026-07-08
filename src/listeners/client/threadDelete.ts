import { ApplyOptions } from "@sapphire/decorators";
import { Listener, type ListenerOptions } from "@sapphire/framework";
import {
	clearThreadEscalated,
	deleteThreadResponsesForThread,
} from "@src/database/db";
import { type AnyThreadChannel, Events } from "discord.js";

@ApplyOptions<ListenerOptions>({ event: Events.ThreadDelete })
export class ThreadDeleteListener extends Listener {
	public async run(thread: AnyThreadChannel) {
		try {
			await clearThreadEscalated(thread.id);
			await deleteThreadResponsesForThread(thread.id);
		} catch (error) {
			this.container.logger.error(
				`Failed to clean up thread state for deleted thread ${thread.id}: ${error}`,
			);
		}
	}
}
