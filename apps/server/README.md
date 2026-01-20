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

The Dockerfile is generated thanks to [Dofigen](https://github.com/lenra-io/dofigen). To generate the Dockerfile, run the following command from the `apps/server` directory:

```bash
# Update the dependent image versions
dofigen update
# Generate the Dockerfile
dofigen gen
```
