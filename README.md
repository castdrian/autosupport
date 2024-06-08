# autosupport

autosupport using intent classification and ocr

## Showcase
<details markdown="block">
  <summary><strong>pyoncord</strong></summary>
  
<https://github.com/castdrian/autosupport/assets/22133246/731da373-dc1b-4738-b7ff-a098170b71d2>
</details>

## Usage

wit.ai project: <https://wit.ai/apps/768983281890362>\
To copy the wit project please refer to https://wit.ai/docs/recipes#export-your-app

To fine tune the response sensitivity you can adjust the minimum confidence [here](https://github.com/castdrian/autosupport/blob/1eea6694f32d71b8c58a0cef7e349c165c4c05cc/src/autosupport.ts#L15C47-L15C50)

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
