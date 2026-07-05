# Score Hero — Engenharia Reversa Completa

> **Documento de referência técnica e de game design**
> Elaborado como base para o projeto de recriação com mecânicas próprias (sistema de fãs, roleta de drible e patrocínios).
> Convenção: funcionalidades não documentadas oficialmente pela First Touch Games estão marcadas como **[Inferência]** — deduzidas do comportamento observável do jogo.

---

# 1. Visão Geral

## Objetivo do jogo

Conduzir a carreira de um jogador de futebol criado pelo usuário ("o Herói"), do banco de reservas de um clube pequeno até se tornar uma lenda mundial, completando níveis baseados em lances de partidas. Cada nível é um **puzzle de trajetórias**: o jogador desenha com o dedo o caminho de passes e chutes para cumprir o objetivo do lance (marcar, dar assistência, vencer por um placar específico).

## História

Narrativa linear de ascensão esportiva:

- O Herói começa como reserva desconhecido em um clube de baixa expressão.
- Ganha espaço no time titular através de boas atuações (níveis completados).
- Recebe propostas de transferência para clubes maiores conforme a carreira avança — o jogador escolhe entre ofertas em momentos-chave.
- É convocado para a seleção nacional (o jogador escolhe o país no início).
- Disputa e vence campeonatos nacionais, copas continentais e o mundial.
- A história é contada por cutscenes estáticas curtas (diálogos com técnico, manchetes de jornal, cenas de vestiário) entre temporadas. **[Inferência]** Não há ramificação narrativa real: as escolhas de clube alteram nomes/cores, mas a estrutura de níveis é a mesma.

## Gênero

- Puzzle esportivo por níveis (level-based sports puzzle)
- Simulação de carreira arcade
- Single-player com elementos sociais assíncronos

## Plataforma

- iOS e Android (mobile-first, portrait/landscape conforme versão)
- Controles 100% touch (swipe para traçar trajetória)

## Público-alvo

- Casual/mid-core, 12–35 anos
- Fãs de futebol que não querem a complexidade de um FIFA/eFootball
- Sessões curtas (1 nível = 30s a 2min) — público de jogo de bolso/commute

## Loop principal de gameplay

```
Selecionar nível → Assistir setup do lance → Desenhar trajetória (passe/chute)
→ Bola executa a física → Resultado (gol/assistência/interceptação/fora)
→ Sucesso: estrelas (1–3) + dinheiro + avanço narrativo
→ Falha: perde 1 vida OU gasta dinheiro em "rewind" para refazer o toque
→ Repetir até fechar a temporada → Cutscene → Próxima temporada
```

Loop de retenção externo: vidas limitadas regeneram com tempo real, criando sessões espaçadas; dinheiro escasso incentiva anúncios recompensados e IAP.

---

# 2. Mecânicas

## 2.1 Controle de trajetória (mecânica central)

- O jogo pausa quando o Herói (ou um companheiro que vai servi-lo) recebe a bola.
- O jogador **desenha uma linha com o dedo** a partir da bola até o destino.
- A linha desenhada define: direção, curva (efeito) e, implicitamente, força.
- Desenhar uma linha curva aplica efeito à bola — essencial para contornar barreiras, goleiros adiantados e defensores.
- Toques em sequência: em lances com múltiplos passes, o jogo pausa a cada recepção para o próximo desenho.
- **[Inferência]** A trajetória é convertida em uma curva paramétrica (Bézier/spline) e a física da bola interpola essa curva com ruído mínimo — a "física" é coreografada, não simulada de verdade.

## 2.2 Tipos de toque

- **Passe rasteiro**: linha curta/reta no chão.
- **Passe em profundidade**: linha para o espaço, companheiro corre na bola.
- **Lançamento/bola alta**: linha longa — o jogo decide elevar a bola para transpor defensores. **[Inferência]** A elevação é automática baseada na distância e em obstáculos na linha.
- **Chute**: linha em direção ao gol.
- **Chute colocado/curvado**: linha curva em direção ao gol.
- **Cabeceio**: quando a bola vem alta, o toque desenhado vira cabeçada.
- **Voleio/primeira**: recepções de bola aérea permitem finalização direta.
- **Cobranças de falta e pênalti**: níveis especiais com barreira e goleiro.
- **Escanteios**: cruzamento desenhado + segundo toque de finalização.

## 2.3 Sistema de estrelas (1–3 por nível)

- 1 estrela: cumprir o objetivo mínimo do nível.
- 2–3 estrelas: cumprir objetivos de excelência. **[Inferência]** Critérios observados: marcar com o Herói (e não só dar assistência), acertar o canto mais difícil, não desperdiçar toques, completar objetivos secundários ocultos ("marque de fora da área", "marque de cabeça").
- Estrelas acumuladas funcionam como gate de progressão em pontos da carreira (precisa de X estrelas para desbloquear a temporada seguinte) e alimentam conquistas.

## 2.4 Vidas (energia)

- O jogador tem um estoque máximo de vidas (5).
- Falhar um lance **e não usar rewind** consome 1 vida.
- Vidas regeneram com tempo real (1 vida a cada ~30 minutos **[Inferência]** — valor típico do gênero, consistente com o comportamento do timer).
- Vidas extras: assistir anúncio recompensado, comprar com dinheiro real, ou aguardar.

## 2.5 Rewind (refazer o toque)

- Ao errar um toque, o jogador pode pagar (moeda do jogo) para **voltar exatamente ao momento do erro** e redesenhar, sem perder vida nem reiniciar o nível.
- **[Inferência]** O custo do rewind aumenta a cada uso consecutivo no mesmo lance, criando pressão de gasto (sunk cost).
- É o principal ralo de moeda do jogo — o design de dificuldade dos níveis existe em função dele.

## 2.6 Movimento e IA de apoio

- O jogador **não controla o movimento dos jogadores** — apenas a bola.
- Companheiros correm em rotas pré-definidas por nível (coreografia).
- Defensores adversários têm zonas de interceptação: se a linha desenhada cruza o raio de alcance de um defensor sem curva/elevação suficiente, a bola é cortada. **[Inferência]** A interceptação é determinística por proximidade da trajetória, com tolerância que diminui em níveis avançados.
- Goleiros defendem chutes cuja trajetória passa dentro do seu arco de alcance; chutes colocados nos cantos ou com trajetória alta-baixa vencem o arco.

## 2.7 Condições de falha

- Bola interceptada por defensor.
- Chute defendido pelo goleiro ou para fora.
- Passe errado (nenhum companheiro alcança).
- Impedimento **[Inferência]**: passes em profundidade além da linha da zaga em timing errado são marcados como impedimento em alguns níveis.
- Não cumprir o placar-alvo do lance (ex.: precisava vencer por 2 gols e só fez 1).

## 2.8 Clima e ambientação

- Níveis variam entre dia/noite e condições visuais (chuva, neve).
- **[Inferência]** O clima é cosmético — não altera a física da bola de forma perceptível; serve para variedade visual entre temporadas.

## 2.9 Customização do Herói

- Editor de aparência: tom de pele, rosto, cabelo, barba, penteados desbloqueáveis.
- Nome e número da camisa.
- Escolha de nacionalidade (define a seleção da carreira).
- Itens de aparência adicionais comprados com moeda do jogo.

## 2.10 Transferências e escolha de clube

- Em pontos fixos da narrativa, o Herói recebe 2–3 propostas de clubes.
- A escolha define uniforme, cores e nomes vistos nos níveis seguintes.
- Clubes e ligas usam **nomes fictícios** (sem licenças oficiais); a versão com licença de atletas reais ficou restrita a edições específicas (Score! Hero com atletas de capa em campanhas pontuais). **[Inferência]** A estrutura de níveis não muda com a escolha — apenas skin.

## 2.11 Comemorações

- Após gols importantes, cutscene curta de comemoração.
- **[Inferência]** Comemorações adicionais desbloqueáveis em versões mais recentes (Score! Hero 2) como recompensa cosmética.

## Mecânicas ausentes (por design)

Não existem: crafting, construção, inventário de equipamentos, pets, montarias, mineração, agricultura, pesca, culinária, sobrevivência, magias, buffs/debuffs, sistema de dano/cura, parkour. O jogo é deliberadamente enxuto: **uma mecânica central (desenhar trajetória) explorada em profundidade**.

---

# 3. Interface (UI/UX)

## 3.1 Fluxo de telas

```
Splash → Menu principal → Mapa de temporadas → Seleção de nível → Gameplay
                                  ↓
              Loja | Perfil/Customização | Configurações | Conquistas | Rankings
```

## 3.2 Menu inicial

- Logo + botão "Jogar" central.
- Indicadores persistentes no topo: vidas (com timer de regeneração), saldo de moeda, saldo de "bux"/moeda premium quando aplicável.
- Acessos: loja, configurações, perfil, conquistas, ranking de amigos.
- Banner de promoções/eventos sazonais.

## 3.3 Login/Cadastro

- Jogo **não exige conta própria**: progresso local por padrão.
- Login social opcional (Google Play Games / Game Center / Facebook) para:
  - Save na nuvem e sincronização entre aparelhos.
  - Ranking entre amigos.
- **[Inferência]** Sem cadastro por e-mail/senha próprio; identidade delegada às plataformas.

## 3.4 Seleção de personagem / Editor do Herói

- Apresentado no primeiro boot (onboarding) e acessível depois via Perfil.
- Carrossel de opções de rosto/cabelo/pele + campo de nome + seletor de nacionalidade.

## 3.5 Mapa de temporadas (seleção de nível)

- Lista vertical/scroll de temporadas; cada temporada contém ~10 níveis.
- Cada nível mostra: número, estrelas obtidas (0–3), estado (bloqueado/disponível/completo).
- Gate visual quando estrelas insuficientes para avançar.

## 3.6 HUD in-game

- Placar e minuto do jogo (contextual do lance).
- Objetivo do nível (ex.: "Vença a partida", "Marque com o Herói").
- Botão de pausa.
- Botão/contador de rewind com custo.
- Indicador de toques da jogada (quando multi-passe).
- Linha desenhada renderizada em tempo real sob o dedo.

## 3.7 Loja

- Pacotes de moeda (IAP com preços em dinheiro real).
- Ofertas promocionais/bundles sazonais.
- Botão de anúncio recompensado (moeda ou vida grátis).
- Remoção de anúncios (compra única). **[Inferência]** Presente na maioria das versões.

## 3.8 Perfil

- Estatísticas de carreira: gols, assistências, troféus, estrelas totais.
- Galeria de troféus/conquistas.
- Editor de aparência.

## 3.9 Configurações

- Som/música (toggles separados).
- Idioma.
- Restaurar compras.
- Vincular/desvincular conta social.
- Créditos, política de privacidade, suporte.

## 3.10 Notificações

- Push: "Suas vidas estão cheias!", retenção D1/D7, promoções. **[Inferência]** Agendadas localmente com base no timer de vidas.
- In-game: toasts de conquista desbloqueada, oferta de rewind ao falhar.

## Telas inexistentes

Sem: mapa-múndi navegável, inventário, banco, chat, guildas, lista de amigos interna (delegada à plataforma), janelas de leilão.

---

# 4. Sistemas

## 4.1 Sistema de níveis e temporadas

- Conteúdo estruturado em temporadas (~10 níveis) somando 800+ níveis (expandido por updates).
- Cada nível é um script: posições iniciais, rotas dos NPCs, objetivo, critérios de estrelas.
- **[Inferência]** Níveis definidos em dados (JSON/binário proprietário) interpretados por um runtime único — é assim que a First Touch adiciona centenas de níveis por update sem mudar código.

## 4.2 Sistema de economia (moedas)

- **Dinheiro (moeda soft)**: ganho ao completar níveis (escala com estrelas), conquistas, anúncios recompensados, recompensas de login/eventos.
- Gasto em: rewinds (principal), cosméticos, vidas.
- **[Inferência]** A curva de ganho é deliberadamente inferior à curva de custo de rewind no mid/late game, empurrando para ads/IAP.

## 4.3 Sistema de vidas

- Estoque máximo 5; regeneração por timer real; refill por ad/IAP.
- Persistido com timestamp para funcionar offline (calcula regeneração ao reabrir). **[Inferência]**

## 4.4 Sistema de rewind

- Snapshot do estado do lance a cada toque; restaurar = repor snapshot.
- Custo progressivo por uso no mesmo lance. **[Inferência]**

## 4.5 Sistema de conquistas

- Conquistas por marcos: X gols, X assistências, X estrelas, vencer campeonatos, gols de falta, etc.
- Integração com Google Play Games/Game Center.

## 4.6 Sistema de ranking

- Leaderboards assíncronos por estrelas totais/progresso entre amigos da plataforma social.
- Sem PvP em tempo real.

## 4.7 Sistema de save

- Save local (arquivo serializado) + save em nuvem via conta social.
- **[Inferência]** Resolução de conflito por "maior progresso vence" ou escolha do usuário.

## 4.8 Sistema de anúncios

- Rewarded video (vidas, moeda), interstitials entre níveis (removíveis por IAP).
- Mediação de múltiplas redes de ads. **[Inferência]**

## 4.9 Sistema de IAP

- Pacotes de moeda em faixas de preço; validação de recibo nas lojas.
- Restaurar compras (obrigação das lojas).

## 4.10 Anti-cheat / Segurança

- **[Inferência]** Jogo essencialmente client-side; proteção limitada a: ofuscação do save, validação de recibo IAP server-side, e checagens básicas de integridade. Progresso é trivialmente editável por usuários avançados — aceitável porque não há PvP.

## 4.11 Sistema de eventos/promoções

- Ofertas sazonais na loja; edições temáticas. **[Inferência]** Eventos de gameplay recorrentes só se consolidaram no sucessor (Score! Hero 2 / Score! Match).

---

# 5. Personagens

## 5.1 Herói (jogador)

- Avatar customizável; sem atributos numéricos visíveis — a "habilidade" é do usuário, não do personagem.
- Evolução puramente narrativa (status de reserva → titular → capitão → lenda).

## 5.2 Companheiros de time (NPCs aliados)

- Sem identidade persistente relevante; executam rotas coreografadas por nível.
- **[Inferência]** Gerados a partir do elenco fictício do clube atual (nomes procedurais/da base de dados fictícia).

## 5.3 Adversários

- Defensores: zonas/raios de interceptação posicionados pelo level design.
- Goleiros: arco de defesa com reação à trajetória; qualidade cresce com a dificuldade (arco maior, reação mais rápida). **[Inferência]**

## 5.4 Técnico e figuras narrativas

- Técnico aparece nas cutscenes (dá feedback, anuncia titularidade, transferências).
- Manchetes de imprensa como dispositivo narrativo.

## 5.5 Atributos e comportamentos

- Não há fichas de atributos expostas. Toda a "IA" é paramétrica por nível: posição, raio, velocidade de reação, rota.

---

# 6. Itens

## 6.1 Categorias existentes

- **Moeda soft (dinheiro)**: obtida por gameplay, ads, IAP.
- **Vidas**: recurso consumível de tentativa.
- **Cosméticos**: cabelos, barbas, acessórios do Herói — comprados com moeda ou desbloqueados por progresso.
- **Pacotes IAP**: bundles de moeda (e ofertas com remoção de ads).

## 6.2 Categorias inexistentes

Sem armas, armaduras, ferramentas, materiais, recursos, chaves, consumíveis de gameplay (boosts), raridades ou itens lendários. A monetização é 100% moeda + conveniência, não poder.

---

# 7. Progressão

- **Sem XP e sem níveis de personagem.** A progressão é:
  1. **Estrutural**: níveis/temporadas completados (conteúdo linear).
  2. **De maestria**: estrelas por nível (replay para perfeccionismo).
  3. **Narrativa**: transferências, convocação, troféus coletivos e individuais (artilheiro da temporada, melhor jogador). **[Inferência]** Troféus concedidos por gatilhos de roteiro ao fechar temporadas, com condições de estrelas em alguns casos.
  4. **Cosmética**: aparências desbloqueadas.
- Gates de estrelas obrigam replay de níveis antigos com melhor desempenho — alonga o conteúdo sem produzir níveis novos.

---

# 8. Economia

## Fontes (faucets)

| Fonte                | Moeda         | Observação               |
| -------------------- | ------------- | ------------------------ |
| Completar nível      | Dinheiro      | Escala com estrelas      |
| Conquistas           | Dinheiro      | Marcos de carreira       |
| Anúncio recompensado | Dinheiro/vida | Limitado por cooldown    |
| IAP                  | Dinheiro      | Pacotes escalonados      |
| Login/promos         | Dinheiro      | Sazonal **[Inferência]** |

## Ralos (sinks)

| Ralo       | Custo               | Papel                                         |
| ---------- | ------------------- | --------------------------------------------- |
| Rewind     | Progressivo por uso | Ralo principal — converte frustração em gasto |
| Cosméticos | Fixo                | Expressão/vaidade                             |
| Vidas      | Fixo                | Conveniência de sessão                        |

- Sem comércio entre jogadores, leilão, mercado ou craft — economia de mão única (single-player fechada).
- **Regra de ouro do balanceamento observado [Inferência]**: o jogador free consegue terminar o jogo, mas ao custo de esperar vidas e repetir níveis; o pagante compra continuidade de sessão, não vantagem mecânica.

---

# 9. Multiplayer

- **Score Hero não possui multiplayer em tempo real.**
- Elementos sociais assíncronos:
  - Leaderboards de estrelas/progresso entre amigos (Google Play Games / Game Center / Facebook).
  - Convites/compartilhamento via share sheet do sistema.
- Sem servidores de partida, sincronização de estado, coop, PvP, guildas, chat ou matchmaking.
- Observação de mercado: a demanda por PvP foi atendida pela First Touch em um produto separado (Score! Match), mantendo o Hero como experiência solo — decisão que simplifica radicalmente o backend.

---

# 10. Inteligência Artificial

## 10.1 Defensores

- Cada defensor possui: posição (fixa ou rota curta), raio de interceptação e tempo de reação.
- Ao confirmar a trajetória desenhada, o sistema testa colisão entre a curva da bola e os volumes de interceptação ao longo do tempo. **[Inferência]** Teste determinístico (sample da curva por frame vs. posição projetada do defensor), sem aleatoriedade — o mesmo desenho produz sempre o mesmo resultado, essencial para o jogo ser um puzzle justo.
- Bolas altas passam por cima de defensores sem capacidade aérea; defensores altos/em posição cortam cruzamentos rasos.

## 10.2 Goleiros

- Arco de defesa: setor angular + alcance de mergulho a partir da posição.
- Parâmetros por nível: velocidade de reação, alcance, adiantamento.
- Chutes vencíveis por: colocação nos cantos extremos, curva que sai do arco e volta, elevação sobre goleiro adiantado (cavadinha), força em ângulo curto. **[Inferência]** A decisão defende/não defende é resolvida no momento do desenho — a animação de mergulho é coreografia do resultado já calculado.

## 10.3 Companheiros

- Sem tomada de decisão: seguem rotas gravadas (waypoints com timing).
- A recepção do passe "atrai" o companheiro num raio de tolerância — se a linha termina perto o suficiente da rota dele, ele ajusta a corrida para dominar. **[Inferência]** Essa tolerância é o "aim assist" do jogo.

## 10.4 Pathfinding

- Inexistente em runtime: todas as rotas são autoradas no editor de níveis. Não há navmesh nem A\*.

## 10.5 Resumo do paradigma

A IA do Score Hero é **paramétrica e determinística**, não comportamental. Isso é uma decisão central de design: puzzles exigem previsibilidade; frustração deve vir do desafio de execução, nunca de aleatoriedade da IA.

---

# 11. Eventos

- **Promoções de loja sazonais**: pacotes com desconto em datas comemorativas.
- **Atualizações de conteúdo** (novas temporadas) tratadas como eventos de re-engajamento, com push notification.
- **Edições temáticas** com atletas de capa em campanhas específicas.
- **[Inferência]** Sem sistema de eventos de gameplay diários/semanais no Score Hero original (sem passe de temporada, missões diárias ou chefes) — a agenda de retenção é o timer de vidas + novas temporadas. Eventos estruturados só aparecem no sucessor.

---

# 12. Mapas

- Não há mundo navegável. O "mapa" do jogo é a **lista de temporadas**.
- Variedade espacial por: estádios (pequeno → gigante conforme o clube), horário (dia/noite), clima visual (limpo/chuva/neve), gramado e torcida (densidade cresce com o prestígio do clube). **[Inferência]** Estádios são cenários reutilizados com re-skin de cores do clube.
- Sem regiões, biomas, dungeons, cidades ou zonas PvP.

---

# 13. Missões

Cada nível é uma missão. Tipologia dos objetivos:

| Tipo              | Exemplo                                | Frequência                                   |
| ----------------- | -------------------------------------- | -------------------------------------------- |
| Marcar            | "Marque o gol da vitória"              | Muito alta                                   |
| Assistir          | "Dê a assistência para o camisa 9"     | Alta                                         |
| Placar-alvo       | "Vença por 2 gols de diferença"        | Média                                        |
| Virada            | "Estão perdendo por 1 — vire o jogo"   | Média                                        |
| Bola parada       | "Marque de falta / converta o pênalti" | Média                                        |
| Sequência         | "Complete 3 passes e finalize"         | Alta                                         |
| Condição especial | "Marque de cabeça / de fora da área"   | Baixa (e como critério oculto de 3 estrelas) |

- Sem missões repetíveis/diárias/semanais formais; o replay é motivado pelas estrelas.
- Missões narrativas = níveis-âncora (estreia, clássico, final de copa) com cutscene.

---

# 14. Sistema Técnico

## 14.1 Arquitetura cliente/servidor

- **Cliente pesado, servidor mínimo.** Todo o gameplay roda offline no dispositivo.
- Serviços online: validação de IAP, ads, analytics, save em nuvem (delegado às plataformas), push.
- **[Inferência]** Engine própria da First Touch Games (compartilhada com Dream League Soccer), renderização 3D low-poly otimizada para dispositivos fracos.

## 14.2 Dados e salvamento

- Save local serializado (progresso, estrelas por nível, moeda, cosméticos, timestamp de vidas).
- Cloud save via Google Play Games/iCloud.
- Níveis como assets de dados versionados, baixáveis por update de app (sem CDN de conteúdo dinâmico no original). **[Inferência]**

## 14.3 Performance

- Alvo: 60fps em hardware modesto; cenas curtas com poucos atores (≤22 jogadores + bola).
- Assets: modelos low-poly, texturas atlas, animações esqueléticas compartilhadas entre todos os jogadores de campo. **[Inferência]**
- Carregamento por nível quase instantâneo (cena única re-parametrizada, não "fases" carregadas do zero).

## 14.4 Networking

- Apenas HTTPS para serviços auxiliares; sem netcode de gameplay.

---

# 15. Fluxo do Jogador

```
Instalação
  → Splash + criação do Herói (nome, aparência, nacionalidade)
  → Tutorial embutido nos níveis 1–5 (passe reto → passe curvo → chute → curva no chute)
  → Temporadas 1–3: herói reserva, lances simples, generosidade de moeda
  → Primeiro gate de estrelas (replay para polir níveis antigos)
  → Primeira proposta de transferência (momento narrativo forte)
  → Mid-game: multi-passes, defensores densos, goleiros rápidos; economia aperta
      → decisões por lance: gastar rewind vs. perder vida vs. esperar
  → Convocação para a seleção (arco paralelo)
  → Late game: níveis de precisão extrema, 3 estrelas como conteúdo de maestria
  → "Endgame": completar 100% das estrelas + aguardar novas temporadas por update
```

---

# 16. Fluxogramas

## 16.1 Boot/Login

```
Abrir app → Save local existe?
  ├─ Não → Onboarding (criar Herói) → Menu
  └─ Sim → Conta social vinculada?
        ├─ Sim → Comparar save local vs. nuvem → usar mais avançado → Menu
        └─ Não → Menu
```

## 16.2 Gameplay (um nível)

```
Selecionar nível → Tem vida (ou nível já pago)?
  ├─ Não → Oferecer: esperar / ad / comprar → voltar
  └─ Sim → Carregar script do lance → Cutscene de contexto (opcional)
      → LOOP DO LANCE:
          Bola chega a um pé controlável → PAUSA
          → Jogador desenha trajetória → Validar curva
          → Simular: interceptação? goleiro? fora? companheiro alcança?
              ├─ Toque bem-sucedido → objetivo cumprido?
              │     ├─ Sim → calcular estrelas → recompensa → próximo nível
              │     └─ Não → próximo toque (volta ao LOOP)
              └─ Falha → Oferecer REWIND (custo N)
                    ├─ Aceita → debita moeda → restaura snapshot → LOOP
                    └─ Recusa → -1 vida → reiniciar nível ou sair
```

## 16.3 Progressão

```
Nível completo → +moeda (por estrelas) → estrelas somam ao total
  → Fim de temporada? → Cutscene → gate de estrelas atingido?
      ├─ Sim → desbloquear próxima temporada (e eventos narrativos: transferência/convocação)
      └─ Não → indicar replay de níveis com <3 estrelas
```

---

# 17. Casos de Uso

O jogador pode:

- Criar e customizar o Herói (aparência, nome, número, nacionalidade)
- Selecionar e jogar níveis; repetir níveis completados
- Desenhar passes retos, curvos, em profundidade, lançamentos, cruzamentos
- Finalizar: chute rasteiro, colocado, de curva, cavadinha, cabeceio, voleio
- Cobrar faltas, pênaltis e escanteios
- Usar rewind para refazer um toque (gastando moeda)
- Assistir anúncio recompensado (vida/moeda)
- Comprar moeda via IAP; restaurar compras; remover anúncios
- Ganhar/gastar moeda; comprar cosméticos
- Escolher clube em janelas de transferência
- Acompanhar estatísticas de carreira e galeria de troféus
- Desbloquear conquistas; comparar progresso em leaderboards de amigos
- Vincular conta social; sincronizar save entre aparelhos
- Ajustar som, música e idioma; receber/desativar push

O jogador NÃO pode: controlar movimento dos atletas, defender, disputar PvP, negociar itens, conversar in-game, criar conteúdo.

---

# 18. Regras de Negócio

1. Um nível só é jogável se: temporada desbloqueada E (vida disponível OU nível já completado).
2. Falha sem rewind consome exatamente 1 vida; vidas nunca ficam negativas.
3. Vidas regeneram 1 a cada intervalo fixo até o teto de 5; o timer persiste offline.
4. Rewind: disponível apenas imediatamente após uma falha de toque; custo cresce por uso consecutivo no mesmo lance; reinicia ao reiniciar o nível. **[Inferência]**
5. Estrelas por nível são o MÁXIMO histórico (repetir com desempenho pior não rebaixa).
6. Recompensa de moeda integral apenas na primeira conclusão; replays pagam fração. **[Inferência]**
7. Gates de temporada exigem total acumulado de estrelas ≥ limiar definido.
8. A escolha de clube é irreversível até a próxima janela narrativa.
9. Interceptação/defesa é determinística: mesma trajetória ⇒ mesmo resultado.
10. Compras IAP creditam somente após validação de recibo; qualquer falha ⇒ rollback.
11. Conflito de save: prevalece o de maior progresso (ou escolha explícita do usuário).
12. Anúncio recompensado tem cooldown/limite diário. **[Inferência]**

---

# 19. Banco de Dados

Para uma recriação com backend próprio (o original guarda quase tudo no cliente):

```
users            (id, auth_provider, provider_id, created_at, last_login)
heroes           (id, user_id, name, shirt_number, nationality, appearance_json)
seasons          (id, ordinal, title, stars_gate, narrative_json)
levels           (id, season_id, ordinal, script_json, difficulty, version)
level_progress   (user_id, level_id, best_stars, completions, first_completed_at)
wallets          (user_id, soft_currency, updated_at)
currency_ledger  (id, user_id, delta, reason, ref_id, created_at)   -- auditoria
lives            (user_id, current, max, last_regen_at)
cosmetics        (id, slot, price, unlock_condition)
user_cosmetics   (user_id, cosmetic_id, equipped, acquired_at)
achievements     (id, code, condition_json, reward)
user_achievements(user_id, achievement_id, unlocked_at)
transfers        (id, user_id, from_club, to_club, season_id, chosen_at)
clubs            (id, name, colors_json, tier)
purchases        (id, user_id, store, product_id, receipt, status, created_at)
career_stats     (user_id, goals, assists, trophies_json, total_stars)
events/analytics (append-only: level_attempt, rewind_used, ad_watched, ...)
```

Chaves de design: `currency_ledger` como fonte de verdade da moeda (nunca só um saldo mutável); `script_json` versionado para hotfix de níveis injustos.

---

# 20. Arquitetura (módulos para recriação)

```
CLIENTE (jogo)
├── Core
│   ├── GameLoop / SceneManager
│   ├── InputModule (captura do traço, suavização da curva)
│   ├── TrajectoryModule (traço → spline → simulação da bola)
│   └── PhysicsLite (colisão bola × zonas de interceptação/goleiro)
├── Gameplay
│   ├── LevelRuntime (interpreta script_json)
│   ├── ActorController (rotas coreografadas, animação)
│   ├── OutcomeResolver (gol/corte/defesa/fora/impedimento)
│   ├── StarEvaluator (critérios de 1–3 estrelas)
│   └── RewindService (snapshots por toque)
├── Meta
│   ├── CareerManager (temporadas, narrativa, transferências)
│   ├── EconomyService (carteira, preços, recompensas)
│   ├── LivesService (timer, regeneração)
│   ├── CosmeticsService
│   └── AchievementService
├── Plataforma
│   ├── SaveService (local + nuvem, resolução de conflito)
│   ├── IAPService / AdsService / PushService
│   └── AnalyticsService
└── UI (menu, mapa de temporadas, HUD, loja, perfil, settings)

FERRAMENTA INTERNA
└── LevelEditor (posicionar atores, rotas, zonas, objetivos, exportar script_json)

BACKEND (mínimo)
├── AuthProxy (tokens das plataformas)
├── ReceiptValidator (IAP)
├── CloudSave API
├── LiveOps (config remota: preços, ofertas, gates)
└── Analytics ingest
```

---

# 21. APIs (backend mínimo)

```
POST /auth/social            -- troca token da plataforma por sessão
GET  /me                     -- perfil + carteira + vidas
GET  /levels/manifest?v=     -- versões de scripts (para hot-update de níveis)
POST /progress/level         -- {level_id, stars, attempt_stats}
POST /economy/spend          -- {reason: rewind|cosmetic, ref_id}   -- valida saldo
POST /economy/grant          -- interno: recompensas (assinado)
GET  /lives                  -- estado + próximo regen
POST /iap/validate           -- {store, receipt}
GET  /leaderboard/friends
POST /save/cloud  GET /save/cloud
GET  /liveops/config         -- preços, ofertas, feature flags
POST /analytics/batch
```

---

# 22. Classes (núcleo de domínio)

```
Hero, Appearance, Club, Season, Level, LevelScript
Actor (base) ← Teammate, Defender, Goalkeeper
Ball, Trajectory (pontos do traço → spline), TouchPhase
LevelRuntime, Snapshot, RewindService
OutcomeResolver, InterceptionZone, KeeperArc, StarEvaluator
Wallet, LedgerEntry, Price, RewardTable
LivesState, RegenTimer
Cosmetic, CosmeticSlot, Inventory (cosmético)
Achievement, AchievementProgress
CareerState, TransferOffer, Trophy, CareerStats
SaveGame, CloudSaveClient, ConflictResolver
IapProduct, Receipt, AdPlacement
UiScreen (base) ← MainMenu, SeasonMap, Hud, Shop, Profile, Settings
```

---

# 23. Diagramas (descrição)

- **Casos de uso (UML)**: ator "Jogador" ligado a: Jogar Nível, Desenhar Trajetória, Usar Rewind, Comprar Moeda, Customizar Herói, Ver Ranking; ator "Loja (Apple/Google)" ligado a Validar Compra; ator "Plataforma Social" ligado a Sincronizar Save/Leaderboard.
- **Classes**: Herança de `Actor`; composição `Level 1—* Actor`, `Level 1—1 LevelScript`; `LevelRuntime` depende de `TrajectoryModule`, `OutcomeResolver`, `RewindService`; `Wallet 1—* LedgerEntry`.
- **Sequência (toque)**: Jogador → InputModule (traço) → TrajectoryModule (spline) → OutcomeResolver (testes vs. Defenders/Keeper) → LevelRuntime (avança fase ou aciona RewindService) → UI (feedback).
- **Componentes**: pacotes Cliente (Core/Gameplay/Meta/UI) ↔ Backend (Auth, IAP, Save, LiveOps) via HTTPS; LevelEditor → publica scripts → manifest.
- **Estados (nível)**: Loading → Cutscene → AwaitingInput ⇄ Simulating → (TouchFailed → RewindOffer → AwaitingInput | LevelFailed) | LevelComplete → Rewarding.

---

# 24. Desenvolvimento — o que é preciso para recriar do zero

## Equipe mínima

1 game designer/level designer, 1–2 programadores gameplay, 1 programador backend/liveops (parcial), 1 artista 3D/2D, 1 animador (parcial), QA.

## Tecnologia (recomendação para o seu contexto)

- **Cliente**: Phaser 3 + TypeScript (2D top-down/isométrico estilizado) — a mecânica de trajetória é 100% viável em 2D e barateia MUITO a arte; alternativa 3D: Unity/Godot.
- **Traço → curva**: captura de pointer events, simplificação (Ramer–Douglas–Peucker), ajuste a Catmull-Rom/Bézier, reamostragem por comprimento para velocidade constante da bola.
- **Backend**: Node/Fastify + PostgreSQL + Redis (você já domina o stack) para carteira, saves, IAP e liveops.
- **Editor de níveis**: a peça mais subestimada — sem ele, produzir 100+ níveis é inviável. Pode ser uma cena especial do próprio Phaser com export JSON.

## Ordem de construção (marcos)

1. Protótipo do toque: desenhar traço → bola percorre → colisão com 1 defensor + goleiro (2–3 semanas de núcleo).
2. LevelRuntime + formato script_json + 10 níveis feitos à mão.
3. Editor de níveis interno.
4. Meta-jogo: estrelas, moeda, rewind, vidas.
5. Carreira/narrativa + temporadas.
6. Loja, ads, IAP, save em nuvem.
7. Polimento: game feel (câmera, slow-motion no chute, réplica de gol), áudio, onboarding.

## Riscos principais

- Tuning da curva do traço (se o desenho "não obedece", o jogo morre — reserve semanas para isso).
- Produção de conteúdo (níveis) é o custo dominante do projeto.
- Balancear economia sem ser predatório.

---

# 25. Melhorias — tornando o jogo superior ao original

As melhorias abaixo incorporam os sistemas já desenhados para o seu projeto:

## 25.1 Sistema de Fãs (ranking + motor econômico)

Substitui a progressão puramente narrativa por uma **reputação quantificada**:

- Fãs ganhos por desempenho (gols > assistências; golaços > gols comuns; dribles bem-sucedidos).
- Fãs nunca são gastos — funcionam como ranking público e como **desbloqueador/multiplicador** de patrocínios.
- Tiers exponenciais: Amador (0) → Local (10k) → Regional (30k) → Nacional (80k) → Global (200k), com multiplicador de renda x1 → x1,5 → x2 → x3 → x5.
- Decay suave apenas por sequência de más atuações (nunca por erro isolado); piso mínimo de fãs para nenhum save ficar morto.

## 25.2 Roleta de Drible com Zona Perfeita (nova mecânica de risco)

Adiciona uma decisão de risco que o original não tem:

- Em lances marcados, o jogador pode tentar o drible: roleta com fatias Perfeito (dourada), Sucesso (verde) e Falha (vermelha).
- Chance = 50 + (Drible − Defesa)×0,6 − Fadiga×0,25 + Pity − Cadeia×12, clamp 5–95.
- Zona Perfeita ≈ 25% da fatia de sucesso (cresce levemente com o atributo): concede 1,5× fãs **e um drible extra** (push-your-luck).
- Cada elo da cadeia: −12% de chance, roleta gira mais rápido, multiplicador de fãs +0,5×.
- Sucesso normal encerra a cadeia naturalmente (limite orgânico); falha no meio da cadeia perde a posse em contra-ataque.
- Pity de +5% após falha (teto 20%) para suavizar frustração.
- Game feel: hit-stop ~100ms + zoom + partículas douradas no Perfeito.

## 25.3 Patrocínios com trade-off (economia com identidade)

Substitui a economia de mão única por **decisões econômicas reais**:

- Três arquétipos de contrato:
  - **Autêntico** (marca local): +150 fãs/partida, R$ 250/partida — motor de crescimento.
  - **Equilibrado** (marca esportiva): +40 fãs, R$ 600 — estabilidade.
  - **Mercenário** (aposta/cripto): −120 fãs, R$ 1.500 — colheita de curto prazo.
- Pagamento multiplicado pelo tier de fãs ⇒ estratégia ótima: crescer com autêntico, "colher" com mercenário no tier alto, sem deixar despencar de tier (sistema autorregulado).
- Contratos com duração fixa (10 partidas) — assinar é compromisso.
- Slots de patrocínio: 1 no início, até 3 no late game.

## 25.4 Melhorias adicionais sobre o original

- **Loop fechado e retroalimentado**: drible gera fãs → fãs sobem tier → tier multiplica patrocínio → dinheiro compra atributos/cosméticos → atributos aumentam a fatia verde da roleta.
- **Atributos leves do Herói** (Drible, Finalização, Passe) compráveis com dinheiro — dá sentido de build sem virar pay-to-win se o teto for atingível free.
- **Economia menos punitiva**: substituir vidas por "moral da torcida" ligada aos fãs, ou manter vidas mas com refill por desempenho.
- **Eventos semanais** (desafios de drible, "clássico da rodada") — lacuna clara do original.
- **Replay/compartilhamento de golaços** (export GIF/vídeo curto) — marketing orgânico gratuito.
- **Modo treino** sem custo de vida para praticar o traço.
- **Acessibilidade**: modo daltônico na roleta (padrões além de cor), sensibilidade do traço ajustável.
- **LiveOps desde o dia 1**: preços, chances e gates via config remota para balancear sem update de app.

---

_Documento gerado em 04/07/2026 para o projeto de recriação em Phaser + TypeScript._
