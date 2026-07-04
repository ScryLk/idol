# PROMPT DE DESENVOLVIMENTO — IDOL

> **Como usar**: cole este prompt no Claude Code (ou outra ferramenta agêntica) na raiz de um diretório vazio, junto com o arquivo `score-hero-engenharia-reversa.md` no mesmo diretório. Este prompt também serve de base para o `CLAUDE.md` do projeto.

---

## PAPEL

Você é um engenheiro de software sênior especializado em desenvolvimento de jogos web (Phaser 3 + TypeScript) e backends Node.js. Sua missão é desenvolver o **IDOL**, um jogo de futebol por níveis inspirado em Score Hero, porém com três sistemas próprios que o diferenciam. Trabalhe de forma incremental, com commits pequenos e testes desde o primeiro marco.

## FONTE DE VERDADE

O arquivo `score-hero-engenharia-reversa.md` (na raiz do projeto) é o documento de referência completo. Regras de uso:

1. As **seções 1–24** descrevem a base mecânica e arquitetural (loop de gameplay, trajetórias, níveis, estrelas, economia, fluxogramas, regras de negócio, banco de dados, módulos, APIs e classes). Implemente-as adaptadas ao contexto 2D descrito abaixo.
2. A **seção 25 NÃO é opcional**: os sistemas de Fãs, Roleta de Drible com Zona Perfeita e Patrocínios com trade-off são o core do IDOL e devem ser tratados como cidadãos de primeira classe, não como melhorias tardias.
3. Em conflito entre este prompt e o documento, este prompt vence.

## O JOGO EM UMA FRASE

O jogador desenha trajetórias de passes e chutes para resolver lances de futebol, arrisca dribles numa roleta push-your-luck, e converte desempenho em **fãs** — a reputação que desbloqueia e multiplica **patrocínios**, alguns dos quais pagam mais em troca da própria torcida.

## STACK OBRIGATÓRIA

### Monorepo
- **pnpm workspaces** com estrutura:
```
idol/
├── apps/
│   ├── game/        # Phaser 3 + TypeScript + Vite (cliente)
│   ├── editor/      # Editor de níveis (Vite + TS, pode reusar cenas do game)
│   └── api/         # Backend Fastify 5 + TypeScript
├── packages/
│   ├── shared/      # Tipos, schemas Zod, fórmulas de gameplay (isomórfico)
│   └── config/      # ESLint, TSConfig, Prettier compartilhados
├── docker-compose.yml
├── CLAUDE.md
└── score-hero-engenharia-reversa.md
```

### Cliente (apps/game)
- **Phaser 3.80+** com **TypeScript 5** strict e **Vite 6**
- Visão 2D top-down do campo, arte placeholder (formas geométricas + sprites simples) até o marco de polimento
- Gerenciamento de estado meta-jogo fora do Phaser: **Zustand**
- Áudio: **Howler.js** (ou o audio nativo do Phaser)
- PWA-ready (vite-plugin-pwa) para instalação mobile

### Backend (apps/api)
- **Fastify 5** + TypeScript, validação com **Zod** (fastify-type-provider-zod)
- **PostgreSQL 16** com **Prisma** (schema conforme seção 19 do documento, adaptado)
- **Redis 7** para: sessões, rate limiting, cache de leaderboard, timer de vidas
- Autenticação: **JWT** próprio (registro por e-mail/senha com argon2) — sem dependência de plataforma social no MVP
- **BullMQ** para jobs (regeneração de vidas em batch, decay de fãs, expiração de contratos)

### Qualidade e testes (ambiente completo)
- **Vitest** para unit e integration em todos os workspaces
- **Playwright** para E2E do cliente (fluxos: completar nível, usar rewind, girar roleta, assinar patrocínio)
- **Testcontainers** (ou docker-compose de teste) para integração da API com Postgres/Redis reais
- **ESLint 9 flat config + Prettier** compartilhados via packages/config
- **GitHub Actions**: lint → typecheck → unit → integration → E2E em PRs
- **Husky + lint-staged** para pre-commit
- Cobertura mínima exigida: **90% em packages/shared** (fórmulas de gameplay), 70% no restante

### Infra local
- `docker-compose.yml` com: postgres, redis, api (dev), adminer
- Seeds completos: `pnpm db:seed` cria usuário de teste, 20 níveis, 3 patrocinadores por tier, atributos iniciais
- `.env.example` documentado; a API valida env com Zod no boot e falha rápido

## FÓRMULAS CANÔNICAS (packages/shared — testadas exaustivamente)

Estas fórmulas são contrato. Implementá-las em `packages/shared/src/formulas/` com testes unitários cobrindo bordas:

```ts
// Roleta de drible
chance = clamp(50 + (drible - defesa) * 0.6 - fadiga * 0.25 + pity - cadeia * 12, 5, 95)
perfeito = max(2, round(chance * (0.25 + drible * 0.001)))
pity: +5 por falha, teto 20, zera em qualquer sucesso
cadeia: sucesso normal encerra; perfeito estende (+1) e multiplica fãs em (1 + cadeia * 0.5)
fãs do drible: base = 100 + defesa * 3; perfeito paga base * 1.5 * multiplicador

// Tiers de fãs
Amador 0 (x1) | Local 10_000 (x1.5) | Regional 30_000 (x2) | Nacional 80_000 (x3) | Global 200_000 (x5)
piso de fãs: 500 (nunca abaixo)

// Patrocínios (valores base, multiplicados pelo tier no pagamento)
Autêntico:   +150 fãs/partida, $250/partida
Equilibrado: +40 fãs/partida,  $600/partida
Mercenário:  -120 fãs/partida, $1500/partida
contratos duram 10 partidas; slots: 1 (início) → 3 (late game)

// Fãs por desempenho em partida: 60–140 conforme avaliação do lance
```

O sorteio da roleta DEVE rodar **no servidor** (endpoint `/gameplay/dribble`), com o cliente apenas animando o resultado — antifraude básico desde o dia 1. Use RNG seedável para testes determinísticos.

## FORMATO DE NÍVEL (script_json)

Defina em packages/shared um schema Zod `LevelScript` contendo: posições iniciais (bola, herói, companheiros com rotas de waypoints+timing, defensores com raio de interceptação, goleiro com arco), objetivo do nível, critérios de estrelas, oportunidades de drible (posições onde a roleta pode ser acionada) e metadados (temporada, ordinal, dificuldade). O game e o editor consomem o MESMO schema.

## MARCOS DE ENTREGA (implemente nesta ordem, cada um com testes e demo funcional)

### M0 — Fundação
Monorepo, docker-compose, CI, packages/shared com TODAS as fórmulas + testes, Prisma schema + migrations + seed. **DoD**: `pnpm test` verde, `docker compose up` sobe tudo.

### M1 — Núcleo do traço
Cena Phaser: campo, bola, 1 herói, 2 defensores, goleiro. Capturar traço (pointer), simplificar (Ramer–Douglas–Peucker), ajustar Catmull-Rom, reamostrar por comprimento, bola percorre a curva. Detecção determinística: interceptação (distância trajetória×raio ao longo do tempo), defesa do goleiro (arco), gol, fora. **DoD**: E2E Playwright completa um gol desenhando um traço programático.

### M2 — LevelRuntime + 10 níveis
Interpretar `LevelScript`, fases de toque (pausa → desenho → simulação → próxima fase), objetivos e avaliador de estrelas, rewind com snapshot. 10 níveis feitos à mão no seed. **DoD**: jogar os 10 níveis do início ao fim no browser.

### M3 — Roleta de Drible
UI da roleta (Perfeito/Sucesso/Falha) integrada aos lances, giro com easing e velocidade crescente por cadeia, resultado vindo do servidor, hit-stop + zoom no Perfeito, pity e cadeia funcionando conforme fórmulas. **DoD**: teste de integração provando distribuição estatística correta em 10k giros com seed.

### M4 — Meta-jogo: fãs, tiers, patrocínios, economia
Carteira com ledger (nunca saldo mutável direto), fãs por partida, tiers com multiplicador, tela de contratos com os 3 arquétipos, duração de 10 partidas via BullMQ, vidas com regeneração por timer. **DoD**: E2E do loop completo — jogar → ganhar fãs → subir tier → assinar mercenário → ver pagamento multiplicado → fãs caindo.

### M5 — Editor de níveis
App separado: posicionar atores, desenhar rotas com waypoints, definir zonas/arcos, objetivos e estrelas, testar o nível in-place, exportar/importar `script_json` validado pelo schema. **DoD**: criar um nível novo no editor e jogá-lo no game sem tocar em código.

### M6 — Carreira, UI meta e polimento
Mapa de temporadas com gates de estrelas, transferências, customização básica do herói, HUD final, game feel (câmera, slow-motion no chute, partículas), áudio, onboarding (níveis 1–5 tutoriais). **DoD**: sessão de 15 minutos de um jogador novo sem travas.

## REGRAS DE TRABALHO

1. TypeScript strict em tudo; proibido `any` não justificado.
2. Toda fórmula de gameplay vive em packages/shared com teste — nunca duplicada em cliente e servidor.
3. Commits convencionais (feat/fix/test/chore) pequenos e frequentes; um PR por marco no mínimo.
4. Cada endpoint: schema Zod de entrada/saída, teste de integração, tratamento de erro tipado.
5. Determinismo: passes/chutes NUNCA têm aleatoriedade (mesma trajetória ⇒ mesmo resultado); RNG existe SOMENTE na roleta de drible, no servidor, seedável.
6. Nada de segredos hardcoded; env validada com Zod.
7. Ao concluir cada marco: atualizar `CLAUDE.md` com decisões de arquitetura tomadas e como rodar/testar o marco.
8. Antes de implementar qualquer sistema, releia a seção correspondente do `score-hero-engenharia-reversa.md` (seções 16–18 têm os fluxogramas e regras de negócio; seção 19 o modelo de dados; seção 25 as mecânicas exclusivas do IDOL).

## FORA DE ESCOPO (não implemente agora)

Multiplayer em tempo real, IAP/pagamentos reais, anúncios, login social, i18n além de pt-BR, arte final, notificações push. Deixe as costuras (interfaces/serviços) preparadas, mas sem integração.

## COMECE POR

Apresente um plano curto do M0 (estrutura de pastas + lista de arquivos que criará), execute, rode os testes e mostre o resultado antes de seguir para o M1.
