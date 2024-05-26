# autosupport

autosupport using intent classification and ocr

## Showcase

<https://github.com/castdrian/autosupport/assets/22133246/5e2b318b-e588-483f-8690-47fd62c17f69>

<https://github.com/castdrian/autosupport/assets/22133246/ce73df8e-d9bc-4caa-9235-1568d21f1c0c>

## Usage

wit.ai project: <https://wit.ai/apps/748238623724119>

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
sudo docker-compose up --build
```
