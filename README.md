# autosupport

A Discord bot that provides automated support using the OpenAI responses API with vectorized knowledge bases.

## Showcase

<https://github.com/user-attachments/assets/bb470c81-2f21-4063-b02b-772cfbf1be61>
  
## Configuration

Create a `.env` file with the following:

```properties
DISCORD_TOKEN=your_discord_bot_token
DEV_GUILD_ID=optional_dev_guild_id
OPEN_AI_API_KEY=your_openai_api_key
OPEN_AI_ADMIN_API_KEY=optional_org_admin_key_with_api.usage.read_scope
```

`OPEN_AI_ADMIN_API_KEY` is only required for the `/usage` command — a separate org-level Admin API key (not a project key), created under Organization Settings > API Keys > Admin keys, with the `api.usage.read` scope enabled.

Add support data and per-guild instructions to `src/data.toml` following the format:

```toml
[instructions]
"GUILD_ID" = "System prompt / persona instructions for this guild"

[support]

[[support."GUILD_ID"]]
problem = "Question text"
solution = "Answer text"
notes = "Optional additional information"
```

To enable the **Request Human** button on assistant replies, create a forum tag on the support channel whose name contains "human" (case-insensitive), e.g. `Needs Human`. Without a matching tag, only the **Close Thread** button is shown.

## Commands

- `/info` — bot status, uptime, and version info
- `/settings info` — list configured support channels and knowledge base stats for the guild
- `/settings channels add|remove` — configure which forum channels the bot responds in
- `/usage` — current OpenAI cost usage (requires `OPEN_AI_ADMIN_API_KEY`)

## Behavior

- The bot only responds to messages in threads under a configured support (forum) channel.
- Messages are rate-limited per thread (4 messages/minute) and per user across all of a guild's threads (8 messages/minute) to prevent abuse.
- Image and file attachments are forwarded to the model as context, up to 4 attachments per message, 20 MB each; video/audio attachments are ignored.
- On the assistant's reply, anyone can read it, but only the person who started the thread (or a member with `Manage Threads`) can use the **Close Thread** / **Request Human** buttons.
- Threads with no activity for 24 hours are automatically archived.

## Usage

### Production

```bash
sudo docker compose up --build
```

### Development

```bash
bun start
```

### Testing

```bash
bun test
```
