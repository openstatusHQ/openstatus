FROM oven/bun

WORKDIR /app

# Copy project
COPY . .

RUN bun install

EXPOSE 3000

WORKDIR /app/apps/server

CMD ["bun", "start"]