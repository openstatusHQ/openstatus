FROM oven/bun

WORKDIR /app

# Copy project
COPY . .

# To keep the image small ;)
RUN rm -rf /app/apps/docs
RUN rm -rf /app/apps/screenshot-service
RUN rm -rf /app/apps/web
RUN rm -rf /app/packages/api
RUN rm -rf /app/packages/integrations/vercel

#  Temp solution for bun
RUN bun install --ignore-scripts

WORKDIR /app/apps/server

# Compile the TypeScript application
RUN bun build --compile --sourcemap src/index.ts --outfile=app

EXPOSE 3000

CMD ["./app"]