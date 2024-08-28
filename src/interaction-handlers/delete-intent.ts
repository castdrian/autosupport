import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import { config } from "@src/config";
import { witIntents } from "@utils/wit";
import type { AutocompleteInteraction } from "discord.js";

export class DeleteIntentAutocompleteHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Autocomplete,
		});
	}

	public override async run(
		interaction: AutocompleteInteraction,
		result: InteractionHandler.ParseResult<this>,
	) {
		return interaction.respond(result);
	}

	public override async parse(interaction: AutocompleteInteraction) {
		if (!interaction.guildId) return this.none();
		if (interaction.commandName !== "settings") return this.none();

		const focusedOption = interaction.options.getFocused(true);

		switch (focusedOption.name) {
			case "intent": {
				const intents = await witIntents(
					config.witAiServerToken[interaction.guildId],
				);
				return this.some(
					intents
						.filter((intent) => intent.name.includes(focusedOption.value))
						.slice(0, 25)
						.map((match) => ({ name: match.name, value: match.name })),
				);
			}
			default:
				return this.none();
		}
	}
}
