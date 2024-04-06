FROM node:20-bookworm as dep

RUN npx -y playwright@1.43.0 install --with-deps

RUN npm install -g bun

RUN npm install -g pnpm

WORKDIR /app

COPY . .

# To keep the image small ;)
RUN rm -rf /app/apps/docs
RUN rm -rf /app/apps/web
RUN rm -rf /app/apps/server

RUN rm -rf /app/packages/api
RUN rm -rf /app/packages/integrations/vercel

RUN pnpm install
EXPOSE 3000

WORKDIR /app/apps/screenshot-service

CMD ["bun", "start"]