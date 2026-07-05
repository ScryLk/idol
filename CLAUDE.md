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

pnpm --filter @idol/game test:e2e   # E2E Playwright (builda + serve via vite preview)
# Em ambiente com Chromium pré-instalado fora do cache do Playwright:
#   PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm --filter @idol/game test:e2e
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

## Decisões de arquitetura (M1)

- **Todo o pipeline do traço vive em `packages/shared`** (`geometry/` + `simulation/`), não no
  Phaser: RDP → Catmull-Rom uniforme → reamostragem por comprimento de arco
  (`buildTrajectory`), e a simulação (`simulateShot`) decide o resultado ANTES da animação.
  O cliente só captura pointer e anima. Isso permite ao servidor revalidar lances no futuro.
- **Parâmetros do traço** (`DEFAULT_TRAJECTORY_OPTIONS`): epsilon RDP 8, 12 samples/segmento,
  reamostragem a cada 6 unidades. Velocidade da bola: 900 unidades/s (`BALL_SPEED`).
- **Campo**: gol no TOPO; linha de gol `y=60`, boca do gol `x∈[260,460]` (`simulation/field.ts`).
- **Ordem determinística de detecção** a cada passo da trajetória: 1) interceptação de defensor
  (distância ≤ raio), 2) defesa do goleiro (dentro do raio E do arco angular), 3) cruzamento da
  linha de gol (x interpolado; dentro da boca = gol, fora = fora), 4) saída lateral/fundo.
  Trajetória que termina dentro do campo = `stopped` (bola dominada).
- **Hot path sem alocação**: pontos crus do traço em `Float32Array` pré-alocado (2048) com
  filtro de distância mínima de 4 unidades (suavização para dedo).
- **Hook E2E**: `window.__IDOL_E2E__` expõe `{ready, shots, lastOutcome}`; o Playwright desenha
  com eventos reais de mouse no canvas (mesmo caminho de input de touch).

## Decisões de arquitetura (M2)

- **`LevelRuntime` vive em `packages/shared`** e é a única autoridade de regras do nível
  (fases de toque, passes, objetivos, estrelas, rewind). A `LevelScene` do Phaser apenas
  captura o traço e ANIMA o `TouchOutcome` retornado.
- **Relógio do nível**: o tempo só avança durante a simulação de um toque (congela na mira).
  Rotas de atores (`positionOnRoute`, interpolação linear por waypoints com t crescente) usam
  esse relógio; `simulateShot` ganhou `timeOffset` e a interceptação avalia onde o defensor
  ESTARÁ em cada passo, não onde começou.
- **Passe**: bola que para (`stopped`) a ≤ 55 unidades (`PASS_RECEIVE_RADIUS`) de um
  companheiro — na posição dele NO INSTANTE da chegada — vira passe: `passes++`, o
  controlador troca e a bola é domada no pé do recebedor. Parar longe de todos mantém a
  posse no ponto de parada (toque livre).
- **Objetivo não cumprido no gol** (ex.: `goal_after_passes` sem os passes) = falha com
  `failReason: 'objective'` — o gol não "meio conta".
- **Rewind com snapshot**: pilha de snapshots (elapsed, bola, controlador, contadores) tirada
  antes de cada toque; rewind desfaz o último toque (inclusive após falha), proibido após
  completar, e conta para o critério `noRewind` de estrelas.
- **Estrelas**: 1 = completar; 2/3 se os critérios (`maxTouches`, `noRewind`,
  `minPerfectDribbles`) do script forem cumpridos — avaliados pelo runtime, nunca pela cena.
- **Níveis 1–10 feitos à mão** em `packages/shared/src/levels/season1.ts` com **teste de
  solvabilidade**: cada nível tem uma solução scriptada que precisa completá-lo com 3
  estrelas, senão o build quebra (`season1.test.ts`). O seed usa esses 10 e gera os 11–20.
- **Seleção de nível no cliente**: `?level=N` (1–10); completar navega para o seguinte.

## Decisões de arquitetura (M3)

- **O sorteio da roleta roda NO SERVIDOR** (`POST /gameplay/dribble`): `DribbleService` com
  RNG injetável (seedável em teste), porta de persistência `DribbleRepo` (Prisma em produção,
  memória em teste). Cada giro atualiza pity/cadeia/fãs do perfil numa transação, registra
  `FanEvent` e loga `DribbleSpin` (antifraude/auditoria).
- **DoD do M3**: `dribble.integration.test.ts` roda 10k giros com seed 2026 e prova
  (a) igualdade EXATA giro a giro com a referência das fórmulas canônicas, (b) taxas de
  sucesso/perfeito dentro de ±1.5pp das médias analíticas, (c) invariantes de pity (teto 20,
  zera em sucesso) e cadeia ao longo de toda a sequência.
- **Runtime**: `availableDribble()` (bola dentro do raio de oportunidade não usada, fase
  'ready') e `applyDribbleOutcome()` (falha → `failReason 'dribble'`; sucesso conta para
  `goal_with_dribble`; perfeito conta para `minPerfectDribbles`). Oportunidades consumidas
  entram no snapshot — rewind as devolve.
- **Cliente**: `DribbleClient` tenta o servidor (`VITE_API_URL` + `?user=`) e cai para um
  fallback local com as MESMAS fórmulas de shared, RNG seedável via `?seed=` — só para
  dev/E2E; nunca é fonte de verdade de economia. Seeds úteis (drible 50 vs defesa 30):
  7 = perfeito, 1 = falha.
- **Roleta visual** (`RouletteOverlay`): setores proporcionais à zona/chance REAIS do giro e a
  roda para exatamente na rolagem sorteada — a animação nunca inventa resultado. Voltas e
  velocidade crescem com a cadeia; Perfeito tem hit-stop + zoom de câmera.
- Nível 7 ganhou a primeira oportunidade de drible (`drible-meia-lua`), opcional para o
  objetivo mas útil para treinar o push-your-luck.

## Decisões de arquitetura (M4)

- **Um único `MetaRepo`** (porta de persistência do meta: users, perfis, sponsors, contratos,
  ledger, fan events) com implementações Prisma e memória — os testes de integração rodam o
  loop inteiro via HTTP sem banco.
- **Relógio injetável em tudo** (`nowMs: () => number` no `MetaService` e no `buildApp`):
  nenhum `Date.now()` nas regras. O teste do DoD "espera" 30min avançando um clock fake.
- **Carteira**: nenhuma coluna de saldo; `walletBalance = SUM(ledger)`. Pagamentos de
  patrocínio são `LedgerEntry(sponsor_payout)` com o id do contrato como referência.
- **Tier do pagamento é avaliado no INÍCIO da partida** (fãs antes dos deltas dela) — decisão
  registrada; evita que o próprio delta do mercenário rebaixe o pagamento da mesma partida.
- **Piso de fãs por evento**: os deltas (desempenho, depois cada patrocínio) são aplicados em
  sequência com `applyFanDelta` (piso 500 em cada passo), todos auditáveis em `FanEvent`.
- **Vidas**: fórmula `computeLives/consumeLife/nextLifeAtMs` em shared (1 vida/30min, teto 5,
  consumo com estoque cheio inicia o timer). Fonte de verdade é o cálculo LAZY nas leituras;
  o job BullMQ (`lives-regen-batch`, a cada 5min) só materializa no banco. Completar partida
  consome 1 vida (`409 no_lives` sem estoque).
- **Auth**: JWT via `@fastify/jwt` (claim `sub`), argon2 nos hashes; `/auth/register` cria
  user + perfil com defaults. Rotas do meta exigem Bearer. A rota do drible (M3) ainda aceita
  `userId` no corpo — unificar na M6. Dica: nomes de fila BullMQ não aceitam `:`.
- **Cliente**: `ApiClient` com sessão dev automática (usuário seed) e degradação offline —
  sem `VITE_API_URL` o gameplay segue e o meta mostra aviso. Ao completar nível, envia
  `rating = estrelas/3` (best effort). `MetaScene` lista os 15 patrocinadores com trade-off
  explícito e motivo de bloqueio; toda regra é do servidor.

## Decisões de arquitetura (M5)

- **Ponte editor → game via URL**: `encodeLevelScript/decodeLevelScript` em shared (JSON →
  UTF-8 → base64url); o game aceita `?level=custom#<payload>` (ou localStorage
  `idol:custom-level`), SEMPRE validado pelo schema — payload adulterado cai para o nível 1.
  Motivo: editor (5174) e game (5173) são origens distintas; localStorage não atravessa.
- **`EditorStore` sem framework** (observável por listeners, `structuredClone` por mutação):
  draft sempre estrutural, validação Zod no export/import/playtest. `pick()` para seleção por
  toque, `exportPlayUrl()` gera o link jogável.
- **Waypoints com timing automático**: t cresce pela distância a 150 u/s (`ROUTE_SPEED`);
  waypoint 0 nasce na posição do ator com t=0 — rotas sempre passam no refinamento de t
  estritamente crescente do schema.
- **Playtest in-place usa o MESMO `LevelRuntime` do game** (passes, objetivos, estrelas,
  rewind reais). Sem roleta no playtest — o sorteio é do servidor; oportunidades aparecem
  como marcadores.
- **Sidebar DOM re-renderiza a cada mutação do store** — simples e correto, mas um clique que
  corre junto com um re-render pode se perder (padrão: interações E2E esperam o estado via
  `window.__IDOL_EDITOR__` antes do próximo clique).

## Decisões de arquitetura (M6)

- **Progresso local offline-first**: best-of de estrelas por nível em localStorage
  (`progressStore`), sincronização com o servidor via fila de pendências fica para o M7.
- **Gates de estrelas em shared** (`levels/gates.ts`): nível N exige o N−1 completado E um
  total mínimo (4→5★, 7→10★, 10→16★); teste garante que todo gate é atingível.
- **Fluxo de cenas**: RouterScene decide pela URL (`?level=` → nível; senão mapa). Navegação
  entre mapa/nível continua por URL (recarrega) — mantém E2E e deep links simples; cenas
  meta (carreira/transferência/craque) trocam via `scene.start`.
- **Transferências** (`levels/clubs.ts`): 2 clubes por tier, cosmético no MVP; clube atual em
  localStorage; tier vem do `/me` quando a API está disponível (senão Amador).
- **Customização**: cor da camisa + número do craque em localStorage, aplicados na cena.
- **Áudio procedural WebAudio** (sem assets, sem Howler por ora): osciladores com envelope
  para clique/chute/passe/gol/falha/perfeito; `unlock()` no primeiro pointerdown de cada
  cena (regra de gesto do mobile).
- **Game feel**: slow-motion (0.35×) + zoom 1.12 nos últimos ~160 u de um chute que VAI ser
  gol (o resultado já é conhecido antes da animação), shake de câmera na falha, rastro de
  partículas na bola e confete no gol (textura gerada em runtime).
- **Onboarding**: dicas fixas nos níveis 1–5 + demo de traço fantasma no primeiro acesso ao
  nível 1 (some no primeiro toque; flag `idol:onboarded`).
- **Flake conhecida de E2E**: clique disparado no exato frame do shake de falha pode se
  perder no headless; os specs clicam REWIND com retry (`expect().toPass`). Padrão a seguir
  em interações logo após efeitos de câmera.

### Checklist "sessão de 15 minutos sem travas" (DoD M6 — validar manualmente)

- [ ] Novo jogador: mapa abre com só o nível 1 liberado; demo + dica explicam o traço
- [ ] Níveis 1–5 têm dica visível e são completáveis sem instrução externa
- [ ] Falhar mostra motivo + caminho claro de retry (REWIND); nunca beco sem saída
- [ ] Gates comunicam o que falta ("precisa de N★ no total")
- [ ] CARREIRA/TRANSFERIR/CRAQUE abrem e voltam sem estado perdido
- [ ] Áudio só toca após o primeiro toque (sem warning de autoplay no console)
- [ ] Status: **pendente em aparelho físico** — flows cobertos por E2E no desktop

### Checklist de validação manual do traço em aparelho Android físico (obrigatório por marco)

Rodar `pnpm --filter @idol/game dev` e abrir `http://<ip-da-máquina>:5173` no aparelho
(mesma rede Wi-Fi). Validar:

- [ ] O traço começa ao tocar na bola (raio generoso de 110 unidades) e NÃO começa em toques
      longe dela
- [ ] Desenhar com o dedo produz curva suave, sem "dentes" (RDP + Catmull-Rom calibrados)
- [ ] Nenhum scroll/zoom do browser durante o desenho (`touch-action: none`)
- [ ] A bola percorre exatamente a curva desenhada em velocidade constante
- [ ] Resultado idêntico ao desenhar o mesmo traço duas vezes (determinismo)
- [ ] 60fps estáveis durante desenho e animação (DevTools remoto → Performance)
- [ ] Sem safe area cortando HUD em aparelho com notch
- [ ] Status: **pendente** — nenhum aparelho físico disponível neste ambiente; validar antes
      de fechar o M1 em produto (a DoD automatizada — E2E Playwright — está verde)

## Estado dos marcos

- ✅ **M0 — Fundação**: monorepo, docker-compose (postgres/redis/api/adminer), CI, fórmulas +
  testes em shared (100% de cobertura), Prisma schema + migration `init` + seed
  (1 usuário, 20 níveis, 15 patrocinadores), scaffolds do game/editor.
- ✅ **M1 — Núcleo do traço**: geometria e simulação determinística em shared (93 testes,
  100% de cobertura), cena Phaser com campo/bola/herói/2 defensores/goleiro, captura de
  traço por pointer, 3 testes E2E Playwright (gol, defesa, interceptação + reinício) com
  eventos reais de input. Pendência não-bloqueante: checklist manual em aparelho físico.
- ✅ **M2 — LevelRuntime + 10 níveis**: runtime determinístico em shared (fases de toque,
  passes, objetivos, avaliador de estrelas, rewind com snapshot, rotas temporizadas com
  interceptação dinâmica), 10 níveis feitos à mão com teste de solvabilidade (126 testes,
  ~99% de cobertura em shared), LevelScene interpretando LevelScript com HUD e botão de
  rewind, 3 E2E (gol 3★ + navegação, interceptação + rewind, passe obrigatório).
- ✅ **M3 — Roleta de Drible**: sorteio no servidor com RNG seedável + persistência
  transacional (perfil/FanEvent/DribbleSpin), teste de integração de 10k giros com seed
  (igualdade exata + distribuição ±1.5pp + invariantes), roleta visual com setores reais,
  velocidade por cadeia e hit-stop no Perfeito, integração completa no LevelRuntime com
  rewind devolvendo a oportunidade. 5/5 E2E.
- ✅ **M4 — Meta-jogo**: auth JWT, `/me`, `/sponsors`, `/contracts`, `/gameplay/match`;
  carteira só por ledger, fãs por eventos com piso, tiers multiplicando pagamentos,
  contratos de 10 partidas concluindo sozinhos, vidas com regen por timer (lazy + job
  BullMQ), tela de contratos no cliente com sessão dev automática. DoD: teste de integração
  HTTP do loop completo (registrar → jogar → subir a Local → assinar mercenário → payout
  ×1.5 → fãs caindo → contrato completo em 10 → sem vidas → regen) + smoke no Postgres real.
- ✅ **M5 — Editor de níveis**: EditorStore testado (posicionar/arrastar atores, rotas com
  waypoints de timing automático, arcos/zonas, objetivos/estrelas, export/import validado),
  cena Phaser de edição + playtest in-place com o LevelRuntime real, link "jogar no game"
  com payload base64url. DoD: E2E monta nível na UI do editor, exporta, e outro E2E joga um
  nível exportado no game via ?level=custom sem tocar em código. 7 E2E game + 2 E2E editor.
- ✅ **M6 — Carreira, UI meta e polimento**: mapa da temporada com gates de estrelas
  (shared + testes), progresso local best-of, transferências por tier, customização do
  craque, onboarding (dicas 1–5 + demo no nível 1), áudio WebAudio procedural, game feel
  (slow-motion no gol, shake na falha, rastro + confete). 2 novos E2E de carreira;
  9 E2E game + 2 editor no total.
- ⬜ M7 Capacitor (empacotamento mobile).

### Notas do M0

- O teste estatístico da roleta usa tolerância de ±1.5pp em 10k giros com seed fixa (2σ ≈ 0.8pp).
- CI tem dois jobs: `checks` (lint → typecheck → unit + gate de cobertura) e `migrations`
  (migrate + seed contra Postgres 16 real via service container). Integração com
  Testcontainers e E2E Playwright entram a partir do M1.
- O Dockerfile da API é dev-only (`tsx watch`); imagem de produção fica para depois.
- Checklist de validação manual do traço em aparelho físico será adicionado aqui no M1.
