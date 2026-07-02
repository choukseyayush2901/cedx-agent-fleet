FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl

ENV DATABASE_URL=file:./dev.db
ENV SEED_DIR=seed
ENV REPLAY_LLM=true

COPY package*.json ./


RUN npm ci

COPY . .

RUN npm run prisma:generate
RUN npm run build


ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]