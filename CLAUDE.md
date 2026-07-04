# IDOL — Guia do Projeto

Jogo de futebol por níveis (inspirado em Score Hero): o jogador desenha trajetórias de passes e
chutes, arrisca dribles numa roleta push-your-luck e converte desempenho em **fãs** — a reputação
que desbloqueia e multiplica **patrocínios**, alguns dos quais pagam mais em troca da própria
torcida.

**Fonte de verdade**: `idol-prompt-desenvolvimento.md` (prompt de desenvolvimento). O documento
`score-hero-engenharia-reversa.md` referenciado pelo prompt **não está presente no repositório**
— quando houver conflito ou lacuna, o prompt vence e as decisões tomadas ficam registradas aqui.

## Stack

- **Monorepo**: pnpm workspaces (`apps/game`, `apps/editor`, `apps/api`, `packages/shared`, `packages/config`)
- **Cliente**: Phaser 3.90 + TypeScript 5 strict + Vite 6, mobile-first (portrait 720×1280, `Phaser.Scale.FIT`), Zustand **vanilla** (sem React) para estado meta-jogo, Capacitor 7 no M7
- **Backend**: Fastify 5 + `fastify-type-provider-zod`, PostgreSQL 16 + Prisma, Redis 7, BullMQ, JWT + argon2
- **Qualidade**: Vitest, ESLint 9 flat + Prettier (compartilhados via `@idol/config`), Husky + lint-staged, GitHub Actions

## Comandos

```bash
pnpm install                 # instala tudo (build scripts aprovados no pnpm-workspace.yaml)
pnpm test                    # testes de todos os workspaces
pnpm --filter @idol/shared test:coverage   # gate de 90% de cobertura nas fórmulas
pnpm lint && pnpm typecheck

docker compose up -d         # postgres + redis + api (porta 3000) + adminer (porta 8080)
pnpm --filter @idol/api db:generate        # prisma generate
pnpm db:migrate              # aplica migrations (DATABASE_URL do .env)
pnpm db:seed                 # usuário teste (teste@idol.dev / idol-dev-123), 20 níveis, 15 patrocinadores

pnpm --filter @idol/game dev     # cliente em http://localhost:5173 (host:true p/ aparelho físico)
pnpm --filter @idol/editor dev   # editor em http://localhost:5174
```

Env: copie `.env.example` para `.env`. A API valida env com Zod no boot e falha rápido
(`apps/api/src/env.ts`).

## Regras invioláveis

1. **Toda fórmula de gameplay vive em `packages/shared/src/formulas/`** com teste — nunca
   duplicada em cliente e servidor. Cobertura mínima 90% (gate no vitest config).
2. **Determinismo**: passes/chutes nunca têm aleatoriedade. RNG existe SOMENTE na roleta de
   drible, **no servidor**, seedável (`createRng` em `packages/shared/src/rng.ts`).
3. **Carteira nunca tem saldo mutável**: saldo = soma do ledger (`LedgerEntry`). Fãs idem:
   eventos em `FanEvent`, total denormalizado com piso de 500.
4. TypeScript strict; `any` proibido sem justificativa. Commits convencionais pequenos.
5. Todo endpoint: schema Zod de entrada/saída + teste + erro tipado.
6. O game e o editor consomem o MESMO schema `LevelScript` (`packages/shared/src/schemas/level.ts`).

## Fórmulas canônicas (implementadas e testadas em `packages/shared`)

- **Roleta de drible** (`formulas/dribble.ts`): chance, zona perfeita, pity (+5/falha, teto 20,
  zera em sucesso), cadeia (perfeito estende, sucesso normal encerra), fãs do drible.
- **Tiers de fãs** (`formulas/fans.ts`): Amador→Global (x1→x5), piso 500, fãs por partida 60–140.
- **Patrocínios** (`formulas/sponsorship.ts`): Autêntico/Equilibrado/Mercenário, contratos de 10
  partidas, pagamento × multiplicador do tier.

## Decisões de arquitetura (M0)

- **Multiplicador do perfeito usa a cadeia na ENTRADA do giro**: 1º perfeito (cadeia 0) paga
  base×1.5×1.0; 2º (cadeia 1) paga base×1.5×1.5; etc. O doc era ambíguo.
- **Sucesso normal paga a base sem multiplicador**; falha paga 0 fãs.
- **Slots de patrocínio por tier** (doc omisso): Amador/Local = 1, Regional = 2, Nacional/Global = 3.
- **Fãs por partida**: mapeamento linear `round(60 + rating × 80)` com rating normalizado [0,1].
- **Delta de fãs de patrocínio NÃO multiplica pelo tier** — só o pagamento em dinheiro multiplica.
- **RNG**: mulberry32 (32-bit, rápido, determinístico) — suficiente para gameplay, não para cripto.
- **Zustand vanilla** no cliente: o game não usa React; Phaser lê/assina o store diretamente.
- **Coordenadas de nível** em unidades da resolução base portrait (x∈[0,720], y∈[0,1280]).
- **Roleta no servidor**: cada giro é persistido em `DribbleSpin` (antifraude/auditoria).
- **Prisma 6** (estável) em vez do 7 recém-lançado.

## Estado dos marcos

- ✅ **M0 — Fundação**: monorepo, docker-compose (postgres/redis/api/adminer), CI, fórmulas +
  57 testes em shared (100% de cobertura), Prisma schema + migration `init` + seed
  (1 usuário, 20 níveis, 15 patrocinadores), scaffolds do game/editor.
- ⬜ M1 núcleo do traço · M2 LevelRuntime + 10 níveis · M3 roleta · M4 meta-jogo · M5 editor ·
  M6 carreira/polimento · M7 Capacitor.

### Notas do M0

- O teste estatístico da roleta usa tolerância de ±1.5pp em 10k giros com seed fixa (2σ ≈ 0.8pp).
- CI tem dois jobs: `checks` (lint → typecheck → unit + gate de cobertura) e `migrations`
  (migrate + seed contra Postgres 16 real via service container). Integração com
  Testcontainers e E2E Playwright entram a partir do M1.
- O Dockerfile da API é dev-only (`tsx watch`); imagem de produção fica para depois.
- Checklist de validação manual do traço em aparelho físico será adicionado aqui no M1.
