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
GITHUB_TOKEN=optional_token_with_contents_write_on_this_repo
ERROR_WEBHOOK_URL=optional_discord_webhook_url_for_error_alerts
```

`OPEN_AI_ADMIN_API_KEY` is only required for the `/usage` command — a separate org-level Admin API key (not a project key), created under Organization Settings > API Keys > Admin keys, with the `api.usage.read` scope enabled.

`GITHUB_TOKEN` is only required for the `/knowledgebase add|edit|delete` commands — a token with `contents:write` on this repository. When an admin edits the knowledge base in-app, the change is committed back to `src/data.toml` (with `[skip ci]` so it doesn't trigger a redeploy) and the OpenAI vector store is rebuilt live, so no restart is needed. In production (1Password / Docker) this is read from a `github token` field on the autosupport 1Password item instead.

`ERROR_WEBHOOK_URL` is optional — when set, every error-level log line is also posted to that Discord webhook (capped at 5 posts/minute to avoid spamming the channel during an outage), so you find out about a production error without having to check container logs.

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
- `/settings info` — configured support channels, knowledge base stats, support role, and how many threads are currently waiting on a human, for the guild
- `/settings channels add|remove` — configure which forum channels the bot responds in
- `/settings support-role [role]` — set the role pinged when a thread requests human assistance; omit `role` to clear it
- `/knowledgebase list` — page through the guild's knowledge base entries
- `/knowledgebase add` — add an entry via a modal (problem, solution, optional notes)
- `/knowledgebase edit <entry>` — edit an entry (autocomplete by problem) via a prefilled modal
- `/knowledgebase delete <entry>` — delete an entry (autocomplete by problem) after a confirmation prompt
- `/usage` — current OpenAI cost usage (requires `OPEN_AI_ADMIN_API_KEY`); org-wide across all guilds sharing the same API key, not guild-specific

The `/knowledgebase add|edit|delete` commands require a `Manage Messages` permission and a configured `GITHUB_TOKEN` (see Configuration); each change is committed to `src/data.toml` with `[skip ci]` and the OpenAI vector store is rebuilt live.

## Behavior

- The bot only responds to messages in threads under a configured support (forum) channel.
- Messages are rate-limited per thread (4 messages/minute) and per user across all of a guild's threads (8 messages/minute) to prevent abuse.
- Image and file attachments are forwarded to the model as context, up to 4 attachments per message, 20 MB each; video/audio attachments are ignored.
- On the assistant's reply, anyone can read it, but only the person who started the thread (or a member with `Manage Threads`) can use the **Close Thread** / **Request Human** buttons.
- Clicking **Request Human** opens a short modal asking what the user needs help with (optional); the answer is posted alongside the pause notice so whoever picks up the thread has context immediately. A **Resume AI** button on that notice re-enables the assistant for the thread.
- Conversation history and human-escalation state are persisted to the database, so they survive a bot restart.
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

The SQLite database path defaults to `autosupport.db`; override it with the `DATABASE_PATH` env var (e.g. for pointing at a different file, or `:memory:`).

### Testing

```bash
bun run test
```

Runs against an in-memory database (`DATABASE_PATH=:memory:`, set by the `test` script). Running `bun test` directly instead skips that and will read/write your local `autosupport.db`.
