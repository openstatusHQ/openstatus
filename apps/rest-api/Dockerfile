FROM oven/bun



WORKDIR /app
COPY pnpm-lock.yaml ./
COPY bun.lockb ./

# Copy project
COPY . .

RUN bun install

EXPOSE 3000

WORKDIR /app/apps/rest-api

CMD ["bun", "start"]