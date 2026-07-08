import { ContainerBuilder, TextDisplayBuilder } from "discord.js";

export enum StatusColor {
	Success = 0x57f287,
	Warning = 0xfee75c,
	Danger = 0xed4245,
	Neutral = 0x99aab5,
}

export function statusContainer(
	color: StatusColor,
	content: string,
): ContainerBuilder {
	return new ContainerBuilder()
		.setAccentColor(color)
		.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
}
