# autosupport

autosupport using intent classification and ocr

## Showcase

<details markdown="block">
  <summary><strong>pyoncord</strong></summary>
  
<https://github.com/castdrian/autosupport/assets/22133246/731da373-dc1b-4738-b7ff-a098170b71d2>
</details>

## Usage

wit.ai project: <https://wit.ai/apps/768983281890362>\
To copy the wit project please refer to <https://wit.ai/docs/recipes#export-your-app>

To fine tune the response sensitivity you can adjust the minimum confidence [here](https://github.com/castdrian/autosupport/blob/dev/src/data.toml)

### Production

```bash
sudo docker run --name=autosupport --restart=unless-stopped ghcr.io/castdrian/autosupport:main --env-file .env
```

### Development

#### Local

```bash
bun start
```

#### Docker

```bash
sudo docker compose up --build
```
