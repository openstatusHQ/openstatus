# syntax=docker/dockerfile:1.11
# This file is generated by Dofigen v2.3.2
# See https://github.com/lenra-io/dofigen

# install
FROM oven/bun@sha256:e9382fda475d1ff0a939e925db3ca5a91b3b26cd71f23410dc5363262384bbc2 AS install
WORKDIR /app/
RUN \
    --mount=type=bind,target=package.json,source=package.json \
    --mount=type=bind,target=apps/workflows/package.json,source=apps/workflows/package.json \
    --mount=type=bind,target=packages/assertions/package.json,source=packages/assertions/package.json \
    --mount=type=bind,target=packages/db/package.json,source=packages/db/package.json \
    --mount=type=bind,target=packages/emails/package.json,source=packages/emails/package.json \
    --mount=type=bind,target=packages/notifications/discord/package.json,source=packages/notifications/discord/package.json \
    --mount=type=bind,target=packages/notifications/email/package.json,source=packages/notifications/email/package.json \
    --mount=type=bind,target=packages/notifications/ntfy/package.json,source=packages/notifications/ntfy/package.json \
    --mount=type=bind,target=packages/notifications/opsgenie/package.json,source=packages/notifications/opsgenie/package.json \
    --mount=type=bind,target=packages/notifications/pagerduty/package.json,source=packages/notifications/pagerduty/package.json \
    --mount=type=bind,target=packages/notifications/slack/package.json,source=packages/notifications/slack/package.json \
    --mount=type=bind,target=packages/notifications/twillio-sms/package.json,source=packages/notifications/twillio-sms/package.json \
    --mount=type=bind,target=packages/notifications/webhook/package.json,source=packages/notifications/webhook/package.json \
    --mount=type=bind,target=packages/utils/package.json,source=packages/utils/package.json \
    --mount=type=bind,target=packages/tsconfig/package.json,source=packages/tsconfig/package.json \
    --mount=type=bind,target=packages/tinybird/package.json,source=packages/tinybird/package.json \
    --mount=type=bind,target=packages/upstash/package.json,source=packages/upstash/package.json \
    --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --production --ignore-scripts --frozen-lockfile --verbose

# build
FROM oven/bun@sha256:e9382fda475d1ff0a939e925db3ca5a91b3b26cd71f23410dc5363262384bbc2 AS build
ENV NODE_ENV="production"
WORKDIR /app/apps/workflows
COPY \
    --link \
    "." "/app/"
COPY \
    --from=install \
    --link \
    "/app/node_modules" "/app/node_modules"
RUN bun build --compile --sourcemap --format=cjs src/index.ts --outfile=app

# runtime
FROM debian@sha256:e831d9a884d63734fe3dd9c491ed9a5a3d4c6a6d32c5b14f2067357c49b0b7e1 AS runtime
COPY \
    --from=build \
    --chown=1000:1000 \
    --chmod=555 \
    --link \
    "/app/apps/workflows/app" "/bin/"
USER 1000:1000
EXPOSE 3000
ENTRYPOINT ["/bin/app"]
