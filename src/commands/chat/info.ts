import { Command, version as sapphver } from '@sapphire/framework';
import { version as bunver } from 'bun';
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, type ChatInputCommandInteraction, version as djsver, time } from 'discord.js';
import { cpu, mem, osInfo } from 'systeminformation';
import { version as tsver } from 'typescript';

import pkg from '@root/package.json';

export class InfoCommand extends Command {
	public override async chatInputRun(interaction: ChatInputCommandInteraction) {
		try {
			const { readyAt } = this.container.client;
			const uptimeString = time(readyAt ?? new Date(), 'R');

			const { cores, manufacturer, brand } = await cpu();
			const { total } = await mem();
			const { distro, release, arch } = await osInfo();

			const osString = `${distro} ${release} ${arch}`;
			const cpuString = `${cores}x ${manufacturer} ${brand}`;
			const memoryString = `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB / ${Math.round(
				total / 1024 / 1024,
			)} MB`;

			const embed = {
				title: pkg.name,
				description: `${pkg.name} [v${pkg.version}](<https://github.com/castdrian/autosupport>)\n${pkg.description}\n\n**Uptime:** Container started ${uptimeString}\n**System:** ${osString}\n**CPU:** ${cpuString}\n**Memory Usage:** ${memoryString}\n\n**Bun:** [v${bunver}](<https://bun.sh/>)\n**TypeScript:** [v${tsver}](<https://www.typescriptlang.org/>)\n**Discord.js:** [v${djsver}](<https://discord.js.org/>)\n**Sapphire:** [v${sapphver}](<https://www.sapphirejs.dev/>)`,
				thumbnail: {
					url: this.container.client.user?.displayAvatarURL() ?? '',
				},
			};

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel('Contact')
					.setStyle(ButtonStyle.Link)
					.setURL('discord://-/users/224617799434108928'),
				new ButtonBuilder().setLabel('GitHub').setStyle(ButtonStyle.Link).setURL('https://github.com/castdrian/autosupport'),
			);

			await interaction.reply({ embeds: [embed], components: [row] });
		} catch (ex) {
			this.container.logger.error(ex);
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName('info')
				.setDescription('info about autosupport'),
		);
	}
}