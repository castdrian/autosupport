# autosupport

autosupport using intent classification and ocr

## Showcase

<https://github.com/castdrian/autosupport/assets/22133246/2a603a5a-8e94-430e-a1f6-988e187c6e5b>

## Usage

wit.ai project: <https://wit.ai/apps/768983281890362>

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
