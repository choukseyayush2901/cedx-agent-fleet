FROM --platform=linux/amd64 node:20-bookworm-slim AS app

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL=file:./dev.db
ENV SEED_DIR=seed
ENV REPLAY_LLM=true

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
