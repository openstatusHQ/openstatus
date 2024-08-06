FROM node:22-bookworm as dep

RUN npx -y playwright@1.46.0 install --with-deps

RUN npm install -g bun

RUN npm install -g pnpm

WORKDIR /app

COPY . .

# To keep the image small ;)
RUN rm -rf /app/apps/docs &&\
  rm -rf /app/apps/web &&\
  rm -rf /app/apps/server &&\
  rm -rf /app/packages/api &&\
  rm -rf /app/packages/integrations/vercel

RUN pnpm install
EXPOSE 3000

WORKDIR /app/apps/screenshot-service
CMD ["bun", "start"]
