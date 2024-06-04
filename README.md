# autosupport

autosupport using intent classification and ocr

## Showcase

<https://github.com/castdrian/autosupport/assets/22133246/731da373-dc1b-4738-b7ff-a098170b71d2>

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
