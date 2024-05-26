import { Command } from '@sapphire/framework';
import {
	ActionRowBuilder,
	ApplicationCommandType,
	Message,
	MessageComponentInteraction,
	MessageContextMenuCommandInteraction,
	PermissionFlagsBits,
	StringSelectMenuBuilder
} from 'discord.js';
import { request } from 'undici';
import { config } from '@src/config';

interface Intent {
	id: string;
	name: string;
}

export class UtteranceCommand extends Command {
	public override async contextMenuRun(interaction: MessageContextMenuCommandInteraction) {
		try {
			if (!interaction.isMessageContextMenuCommand && !(interaction.targetMessage instanceof Message)) return;
			const intents = (await request('https://api.wit.ai/intents', { headers: { Authorization: `Bearer ${config.witAiToken}` } }).then((res) =>
				res.body.json()
			)) as Intent[];

			const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				new StringSelectMenuBuilder().setCustomId('select_intent').addOptions(
					intents.map((intent) => ({
						label: intent.name,
						value: intent.name
					}))
				)
			);
			const res = await interaction.reply({ components: [row], ephemeral: true });

			const collectorFilter = (i: MessageComponentInteraction) => i.user.id === interaction.user.id;
			try {
				const confirmation = await res.awaitMessageComponent({ filter: collectorFilter, time: 10_000 });
				if (!confirmation.isStringSelectMenu()) return await res.delete();

				if (confirmation.customId === 'select_intent') {
					const intent = intents.find((intent) => intent.name === confirmation.values[0]);
					if (!intent) return await res.delete();
					const resp = await request('https://api.wit.ai/utterances', {
						method: 'POST',
						headers: { IncomingHttpHeaders: 'application/json', Authorization: `Bearer ${config.witAiToken}` },
						body: JSON.stringify([{ text: interaction.targetMessage.content, intent: intent.name, entities: [], traits: [] }])
					}).then((res) => res.body.json());
					console.log(resp);
					await confirmation.update({ content: 'This currently does not work because the wit api is under maintenance or whatever the fuck is going on there.', components: [] });
					// await confirmation.update({ content: 'Training intent classifier with selected message.', components: [] });
				}
			} catch (ex) {
				await res.delete();
			}
		} catch (ex) {
			this.container.logger.error(ex);
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerContextMenuCommand((builder) =>
			builder //
				.setName('Train Phrase')
				.setType(ApplicationCommandType.Message)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		);
	}
}
