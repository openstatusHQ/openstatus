# OpenStatus Server

## Tech

- Bun
- HonoJS

## Deploy

From root

```bash
flyctl deploy --config apps/server/fly.toml --dockerfile  apps/server/Dockerfile
```

## Docker

Build the docker image locally

```bash
docker build . -t registry.fly.io/openstatus-docker:openstatus-docker-v0  --file  ./apps/server/Dockerfile --platform linux/amd64
```

if you want to run the docker image locally

```bash
docker run -p 3000:3000  registry.fly.io/openstatus-docker:openstatus-docker-v0
```

Push to Fly Registry

```bash
docker push registry.fly.io/openstatus-docker:openstatus-docker-v0

```

Deploy to Fly

```bash
flyctl deploy --app openstatus-docker \
  --image registry.fly.io/openstatus-docker:openstatus-docker-v0
```
