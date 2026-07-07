import pkg from "@root/package.json";
import { Command, version as sapphver } from "@sapphire/framework";
import { version as bunver } from "bun";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
	ContainerBuilder,
	version as djsver,
	MessageFlags,
	SectionBuilder,
	TextDisplayBuilder,
	ThumbnailBuilder,
	time,
} from "discord.js";
import { cpu, mem, osInfo } from "systeminformation";

export class InfoCommand extends Command {
	public override async chatInputRun(interaction: ChatInputCommandInteraction) {
		await interaction.deferReply();
		try {
			const { readyAt } = this.container.client;
			const uptimeString = time(readyAt ?? new Date(), "R");

			const { cores, manufacturer, brand } = await cpu();
			const { total } = await mem();
			const { distro, release, arch } = await osInfo();

			const tsver = pkg.devDependencies.typescript.replace(/^[\^~]/, "");
			const osString = `${distro} ${release} ${arch}`;
			const cpuString = `${cores}x ${manufacturer} ${brand}`;
			const memoryString = `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB / ${Math.round(
				total / 1024 / 1024,
			)} MB`;

			const content = new TextDisplayBuilder().setContent(
				`${pkg.name} [v${pkg.version}](<https://github.com/castdrian/autosupport>)\n${pkg.description}\n\n**Uptime:** Container started ${uptimeString}\n**System:** ${osString}\n**CPU:** ${cpuString}\n**Memory Usage:** ${memoryString}\n\n**Bun:** [v${bunver}](<https://bun.sh/>)\n**TypeScript:** [v${tsver}](<https://www.typescriptlang.org/>)\n**Discord.js:** [v${djsver}](<https://discord.js.org/>)\n**Sapphire:** [v${sapphver}](<https://www.sapphirejs.dev/>)`,
			);

			const section = new SectionBuilder()
				.addTextDisplayComponents(content)
				.setThumbnailAccessory(
					new ThumbnailBuilder().setURL(
						this.container.client.user?.displayAvatarURL() ?? "",
					),
				);

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setLabel("Contact")
					.setStyle(ButtonStyle.Link)
					.setURL("discord://-/users/224617799434108928"),
				new ButtonBuilder()
					.setLabel("GitHub")
					.setStyle(ButtonStyle.Link)
					.setURL("https://github.com/castdrian/autosupport"),
			);

			const container = new ContainerBuilder()
				.addSectionComponents(section)
				.addActionRowComponents(row);

			await interaction.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		} catch (ex) {
			this.container.logger.error(ex);
			await interaction.editReply({
				content: "Sorry, I couldn't gather the info right now.",
			});
		}
	}

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName("info")
				.setDescription("info about autosupport"),
		);
	}
}
