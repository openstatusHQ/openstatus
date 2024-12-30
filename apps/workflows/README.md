# Workflows

## Development

To install dependencies:

```sh
bun install
```

To run:

```sh
bun run dev
```

open <http://localhost:3000>

## Deploy

From root

```bash
flyctl deploy --config apps/workflows/fly.toml --dockerfile  apps/workflows/Dockerfile
```

## Docker

The Dockerfile is generated thanks to [Dofigen](https://github.com/lenra-io/dofigen).
To generate the Dockerfile, run the following command from the `apps/workflows` directory:

```bash
# Update the dependent image versions
dofigen update
# Generate the Dockerfile
dofigen gen
```
