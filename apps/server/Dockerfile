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

# Run Database migrations
WORKDIR /app/packages/db
ENV DATABASE_URL=$DATABASE_URL
ENV DATABASE_AUTH_TOKEN=$DATABASE_AUTH_TOKEN
RUN bun run migrate

EXPOSE 3000

WORKDIR /app/apps/server

CMD ["bun", "start"]