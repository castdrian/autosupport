import { Command, Listener } from "@sapphire/framework";
import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    type ChatInputCommandInteraction,
    type ButtonInteraction,
} from "discord.js";
import { config } from "@src/config";
import { getDeveloperRoleId } from "@src/database/db";

export class DeveloperCommand extends Command {
    public override async chatInputRun(
        interaction: ChatInputCommandInteraction
    ) {
        try {
            const developerRoleId = await getDeveloperRoleId(
                interaction.guildId
            );
            if (!developerRoleId) {
                await interaction.reply({
                    content: "Developer role not configured for this server.",
                    ephemeral: true,
                });
                return;
            }

            const embed = {
                title: "Grant Access to Development Category",
                description:
                    "By clicking the 'Grant Access' button, you will gain access to the development category. By doing so, you agree not to misuse this category and to use the support channel when necessary.",
            };

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel("Grant Access")
                    .setStyle(ButtonStyle.Primary)
                    .setCustomId("grant_access")
            );

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });
        } catch (ex) {
            this.container.logger.error(ex);
        }
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder //
                .setName("developer")
                .setDescription("Grants access to the development category")
        );
    }
}

export class GrantAccessButtonListener extends Listener {
    public async run(interaction: ButtonInteraction) {
        if (
            !!interaction.inGuild() ||
            !(interaction.targetMember instanceof GuildMember)
        )
            return;

        if (!interaction.isButton() || interaction.customId !== "grant_access")
            return;

        if (!responseCache.has(interaction.guildId)) return;

        const developerRoleId = await getDeveloperRoleId(interaction.guildId);
        if (!developerRoleId) {
            await interaction.reply({
                content: "Developer role not configured for this server.",
                ephemeral: true,
            });
            return;
        }

        const role = interaction.guild?.roles.cache.get(developerRoleId);
        if (role) {
            const member = await interaction.guild?.members.fetch(
                interaction.user.id
            );
            if (member) {
                await member.roles.add(role);
                await interaction.reply({
                    content:
                        "You have been granted access to the development category.",
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content:
                        "There was an error fetching your user information.",
                    ephemeral: true,
                });
            }
        } else {
            await interaction.reply({
                content: "Developer role not found.",
                ephemeral: true,
            });
        }
    }
}
