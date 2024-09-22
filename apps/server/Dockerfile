FROM oven/bun AS deps
WORKDIR /app

# Copy only package.json and bun.lockb (if it exists)
COPY package.json bun.lockb* ./

RUN bun install --frozen-lockfile --ignore-scripts

FROM oven/bun AS builder
WORKDIR /app

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy project
COPY . .

# To keep the image small ;)
RUN rm -rf apps/docs apps/screenshot-service apps/web packages/api packages/integrations/vercel

# Compile the TypeScript application
WORKDIR /app/apps/server
RUN bun build --compile --sourcemap src/index.ts --outfile=app


FROM oven/bun AS runner
WORKDIR /app

# Copy the compiled application from the builder stage
COPY --from=builder /app/apps/server/app ./

EXPOSE 3000

CMD ["./app"]
