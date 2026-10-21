# ZeroScam Admin en Docker

## Todo junto (recomendado)

Para levantar **MySQL + API + este panel** con un solo comando, usa el
`docker-compose.yml` del repo de la API:
[zeroScamBorrador/DOCKER.md](https://github.com/Soldsanty1000/zeroScamBorrador/blob/master/DOCKER.md).
Ese compose construye este panel a partir de esta carpeta.

## Solo el panel

Úsalo cuando la API ya corre en otro lado. El panel se abre en
**http://localhost:3001** y busca la API en `NEXT_PUBLIC_API_URL`.

```bash
cp .env.example .env        # en Windows: copy .env.example .env
docker compose up -d --build
```

| Variable              | Para qué                                              | Default                 |
| --------------------- | ----------------------------------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | URL de la API, vista desde el navegador del usuario   | `http://localhost:3000` |
| `ADMIN_PORT`          | Puerto donde se abre el panel                         | `3001`                  |

`NEXT_PUBLIC_API_URL` queda **fija dentro de la imagen al construirla**. Si la
cambias, reconstruye con `docker compose up -d --build`. Si la API está en otra
PC de la red, usa su IP (ej. `http://192.168.1.50:3000`), no `localhost`.

## Pasar la imagen en un archivo, sin el código

```bash
# Si las otras PCs son Windows o Intel, construye para amd64:
docker buildx build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=http://localhost:3000 \
  -t zeroscam-admin:latest --load .
docker save zeroscam-admin:latest -o zeroscam-admin.tar
```

En la otra PC:

```bash
docker load -i zeroscam-admin.tar
docker run -d --name zeroscam-admin -p 3001:3001 --restart unless-stopped zeroscam-admin:latest
```

> Una imagen hecha en una Mac con Apple Silicon (arm64) **no** corre en PCs
> Windows/Intel (amd64) a menos que uses `--platform linux/amd64`.
