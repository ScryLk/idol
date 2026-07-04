# Dev image: roda a API com tsx watch dentro do compose.
FROM node:22-slim

RUN corepack enable pnpm && apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN pnpm install --frozen-lockfile --filter @idol/api... --filter @idol/config

COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm --filter @idol/api db:generate

WORKDIR /workspace/apps/api
EXPOSE 3000
CMD ["pnpm", "dev"]
