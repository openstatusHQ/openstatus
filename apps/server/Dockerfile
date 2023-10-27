FROM oven/bun

WORKDIR /app

# Copy project
COPY . .

# To keep the image small ;)
RUN rm -rf /app/apps/docs
RUN rm -rf /app/apps/web
RUN rm -rf /packages/api
RUN rm -rf /packages/integrations/vercel


RUN bun install

EXPOSE 3000

WORKDIR /app/apps/server

CMD ["bun", "start"]