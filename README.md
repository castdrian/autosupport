# autosupport

A Discord bot that provides automated support using OpenAI Assistants API with vectorized knowledge bases.

## Showcase

<details markdown="block">
  <summary><strong>pyoncord</strong></summary>
  
<https://github.com/castdrian/autosupport/assets/22133246/731da373-dc1b-4738-b7ff-a098170b71d2>
</details>

## Features

- Automated support responses using OpenAI Assistants API
- Knowledge base management with vector search
- Forum thread support with user threads
- Human escalation workflow

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
