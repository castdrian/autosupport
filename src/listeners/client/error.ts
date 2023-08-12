import { Listener } from '@sapphire/framework';

export class ErrorListener extends Listener {
	public run(err: Error) {
		this.container.logger.error(`Application error: ${err.stack}`);
	}
}
