# autosupport

A Discord bot that provides automated support using the OpenAI Assistants API with vectorized knowledge bases.

## Showcase

<details markdown="block">
  <summary><strong>video</strong></summary>
  
  <https://github.com/user-attachments/assets/bb470c81-2f21-4063-b02b-772cfbf1be61>
  
</details>

## Configuration

Create a `.env` file with the following:

```properties
DISCORD_TOKEN=your_discord_bot_token
DEV_GUILD_ID=optional_dev_guild_id
OPEN_AI_API_KEY__GUILD_ID=your_openai_api_key
OPEN_AI_ASSISTANT_ID__GUILD_ID=your_openai_assistant_id
```

Add support data to `src/data.toml` following the format:

```toml
[support]

[[support."GUILD_ID"]]
problem = "Question text"
solution = "Answer text"
notes = "Optional additional information"
```

## Usage

### Production

```bash
sudo docker compose up --build
```

### Development

```bash
bun start
```
