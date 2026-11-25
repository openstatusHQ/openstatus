# Workflows

## Development

To install dependencies:

```sh
pnpm install
```

To run:

```sh
pnpm dev
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
# Install Dofigen
cargo install dofigen
# Update the dependent image versions
dofigen update
# Generate the Dockerfile
dofigen gen
```
