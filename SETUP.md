# IDOL — Guia de Instalação e Execução Local

Passo a passo completo para rodar o projeto do zero na sua máquina, do clone até
o build Android. Comandos testados em Linux/macOS; no Windows, use WSL2.

---

## 1. Pré-requisitos

| Ferramenta                                | Versão              | Para quê                      | Verificar                |
| ----------------------------------------- | ------------------- | ----------------------------- | ------------------------ |
| **Node.js**                               | ≥ 22                | tudo                          | `node --version`         |
| **pnpm**                                  | 10.x (via corepack) | monorepo                      | `pnpm --version`         |
| **Docker** + Compose                      | qualquer recente    | Postgres/Redis/API            | `docker compose version` |
| **Git**                                   | —                   | clone                         | `git --version`          |
| _(opcional)_ **JDK 17** + **Android SDK** | —                   | só para o build Android (AAB) | `java --version`         |

Ativando o pnpm (vem embutido no Node via corepack):

```bash
corepack enable pnpm
corepack prepare pnpm@10.12.1 --activate
```

---

## 2. Clone e instalação

```bash
git clone https://github.com/ScryLk/idol.git
cd idol
pnpm install
```

> Os build scripts nativos necessários (prisma, argon2, esbuild) já estão
> aprovados em `pnpm-workspace.yaml` (`onlyBuiltDependencies`) — não precisa
> rodar `pnpm approve-builds`.

---

## 3. Variáveis de ambiente

```bash
cp .env.example .env
```

O `.env` padrão já funciona com o docker-compose local. Cada variável está
documentada no próprio arquivo. A API valida tudo com Zod no boot e **falha
rápido** com mensagem clara se algo estiver errado.

Para produção, gere um segredo novo: `openssl rand -hex 32` → `JWT_SECRET`.

---

## 4. Banco, Redis e API (Docker)

```bash
docker compose up -d          # postgres:16 + redis:7 + api (porta 3000) + adminer (porta 8080)
```

Na primeira vez (ou após mudar o schema), aplique as migrations e o seed:

```bash
pnpm --filter @idol/api db:generate   # gera o Prisma Client
pnpm db:migrate                       # aplica as migrations
pnpm db:seed                          # dados de desenvolvimento
```

O seed cria:

- usuário de teste: **teste@idol.dev** / senha **idol-dev-123**
- 20 níveis da temporada 1 (10 feitos à mão + 10 gerados)
- 15 patrocinadores (3 arquétipos × 5 tiers)

Conferindo se está tudo no ar:

```bash
curl http://localhost:3000/health      # → {"status":"ok",...}
# Adminer (UI do banco): http://localhost:8080  (sistema: PostgreSQL,
# servidor: postgres, usuário/senha/base: idol)
```

> **Alternativa sem Docker para a API**: com Postgres/Redis locais rodando,
> `pnpm --filter @idol/api dev` sobe a API com hot-reload (tsx watch).

---

## 5. Rodando o jogo

```bash
pnpm --filter @idol/game dev
# → http://localhost:5173
```

- O gameplay funciona **100% offline** — sem API você joga normalmente e as
  partidas ficam numa fila local que sincroniza quando a API voltar.
- Para ligar o meta-jogo (fãs, patrocínios, vidas, roleta oficial no servidor),
  crie `apps/game/.env.local` com:

  ```
  VITE_API_URL=http://localhost:3000
  ```

  O cliente faz login automático com o usuário seed.

**URLs úteis em dev:**

| URL                        | O que abre                                                   |
| -------------------------- | ------------------------------------------------------------ |
| `/`                        | mapa da temporada                                            |
| `/?level=7`                | direto no nível 7 (1–10)                                     |
| `/?level=custom#<payload>` | nível exportado pelo editor                                  |
| `/?level=7&seed=7`         | fallback local da roleta com seed fixa (7=perfeito, 1=falha) |

**Testar no celular (mesma rede Wi-Fi):** o dev server já sobe com `host:true`;
abra `http://<ip-da-sua-máquina>:5173` no aparelho.

---

## 6. Rodando o editor de níveis

```bash
pnpm --filter @idol/editor dev
# → http://localhost:5174
```

Monte o nível (arraste atores, desenhe rotas, defina objetivo/estrelas),
clique **▶ Testar** para jogar in-place, e **⇩ Exportar** para gerar o JSON e o
link "jogar no game" (funciona com o game rodando na porta 5173).

---

## 7. Testes

```bash
pnpm test                                   # unit + integração de todos os workspaces
pnpm --filter @idol/shared test:coverage    # gate de 90% de cobertura nas fórmulas
pnpm lint && pnpm typecheck                 # qualidade
```

**E2E (Playwright)** — na primeira vez, instale o Chromium do Playwright:

```bash
pnpm --filter @idol/game exec playwright install --with-deps chromium
pnpm --filter @idol/game test:e2e      # 9 specs do jogo
pnpm --filter @idol/editor test:e2e    # 2 specs do editor
```

> Os E2E buildam e servem o app sozinhos (vite preview) — não precisa de dev
> server nem de API rodando.

---

## 8. Build web / PWA

```bash
pnpm --filter @idol/game build     # gera apps/game/dist com service worker (PWA)
pnpm --filter @idol/game preview   # serve o build em http://localhost:4173
```

O PWA é instalável direto do navegador (Android/desktop) — canal beta sem loja.

---

## 9. Build Android (Capacitor)

Requer **JDK 17** e **Android SDK** (Android Studio resolve os dois).

```bash
# 1. ícones nativos (uma vez; precisa de rede para o sharp/libvips)
pnpm --filter @idol/game gen:icons
cd apps/game && npx @capacitor/assets generate --android --assetPath resources && cd ../..

# 2. build de release (vite build + cap sync + gradlew bundleRelease)
pnpm build:android
# AAB em: apps/game/android/app/build/outputs/bundle/release/
```

Para **assinar** o AAB, configure um `signingConfig` no
`apps/game/android/app/build.gradle` apontando para seu keystore local —
**nunca** commite keystore ou senhas (use variáveis de ambiente do Gradle).

Para desenvolver no aparelho: `cd apps/game && npx cap run android` (ou abra
`apps/game/android` no Android Studio). Checklist completo de publicação na
Play Store está no `CLAUDE.md`.

---

## 10. Resumo do dia a dia

```bash
docker compose up -d              # backend no ar
pnpm --filter @idol/game dev      # jogar
pnpm --filter @idol/editor dev    # criar níveis
pnpm test                         # antes de commitar (husky roda lint-staged sozinho)
```

---

## 11. Problemas comuns

| Sintoma                                 | Causa provável                                     | Solução                                                                                              |
| --------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| API sai na hora com erro de env         | `.env` ausente/inválido                            | `cp .env.example .env` e leia a mensagem (ela aponta o campo)                                        |
| `P1001: Can't reach database`           | Postgres não subiu                                 | `docker compose up -d postgres` e aguarde o healthcheck                                              |
| Migrations falham com banco sujo        | volume antigo                                      | `docker compose down -v && docker compose up -d` e repita migrate+seed                               |
| Roleta “não usa o servidor”             | `VITE_API_URL` ausente                             | crie `apps/game/.env.local` (passo 5) e reinicie o dev server                                        |
| E2E: `browserType.launch` falhou        | Chromium do Playwright ausente                     | rode o `playwright install` do passo 7 (ou aponte `PLAYWRIGHT_CHROMIUM_PATH` para um Chromium local) |
| Erro nativo do argon2/prisma no install | build scripts bloqueados por versão antiga do pnpm | confirme `pnpm --version` = 10.x e reinstale com `pnpm install --force`                              |
| `gradlew: command not found`            | build Android fora da pasta                        | use `pnpm build:android` a partir da raiz                                                            |
| Porta 3000/5173/5174 ocupada            | outro processo                                     | pare o processo ou ajuste `PORT`/`--port`                                                            |

---

## 12. Mapa do repositório

```
apps/game       jogo (Phaser 3 + Vite + Capacitor + PWA)
apps/editor     editor de níveis (Phaser + sidebar DOM)
apps/api        backend (Fastify 5 + Prisma + BullMQ)
packages/shared fórmulas, schemas, geometria, simulação e LevelRuntime (isomórfico)
packages/config ESLint/Prettier/TSConfig compartilhados
CLAUDE.md       decisões de arquitetura, estado dos marcos e checklists
```

Documentos de referência: `idol-prompt-desenvolvimento.md` (prompt vencedor em
conflitos) e `score-hero-engenharia-reversa.md` (design de referência).
