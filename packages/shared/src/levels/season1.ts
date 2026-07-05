import type { LevelScript } from '../schemas/level.js';

/**
 * Temporada 1, níveis 1–10 — feitos à mão (M2).
 * Progressão: chute livre → mira no canto → desvio de zagueiros → corredores →
 * passes obrigatórios → companheiro em movimento → defesa fechada.
 *
 * Todos são validados pelo schema Zod e têm SOLUÇÃO SCRIPTADA testada em
 * season1.test.ts — um nível que não pode ser completado quebra o build.
 */

const meta = (ordinal: number, name: string, difficulty: number) => ({
  name,
  season: 1,
  ordinal,
  difficulty,
});

const kickoff = { ball: { x: 360, y: 940 }, hero: { position: { x: 360, y: 990 } } };

export const SEASON1_LEVELS: LevelScript[] = [
  // 1 — sem defensores; goleiro tímido. Aprende: desenhar o traço até o gol.
  {
    version: 1,
    metadata: meta(1, 'Primeiro Toque', 1),
    ...kickoff,
    teammates: [],
    defenders: [],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.35, radius: 70 },
    },
    objective: { type: 'goal' },
    stars: { two: { maxTouches: 2 }, three: { maxTouches: 1, noRewind: true } },
    dribbleOpportunities: [],
  },

  // 2 — goleiro cobre o centro; aprende a mirar no canto.
  {
    version: 1,
    metadata: meta(2, 'Mira no Canto', 1),
    ...kickoff,
    teammates: [],
    defenders: [],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.7, radius: 95 },
    },
    objective: { type: 'goal' },
    stars: { two: { maxTouches: 2 }, three: { maxTouches: 1, noRewind: true } },
    dribbleOpportunities: [],
  },

  // 3 — primeiro zagueiro no meio do caminho.
  {
    version: 1,
    metadata: meta(3, 'Zagueiro Central', 1),
    ...kickoff,
    teammates: [],
    defenders: [{ id: 'zagueiro-1', position: { x: 360, y: 600 }, interceptRadius: 55 }],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.4, radius: 75 },
    },
    objective: { type: 'goal' },
    stars: { two: { maxTouches: 2 }, three: { maxTouches: 1, noRewind: true } },
    dribbleOpportunities: [],
  },

  // 4 — corredor central estreito, curva para o canto no fim.
  {
    version: 1,
    metadata: meta(4, 'Corredor', 2),
    ...kickoff,
    teammates: [],
    defenders: [
      { id: 'zagueiro-1', position: { x: 250, y: 650 }, interceptRadius: 50 },
      { id: 'zagueiro-2', position: { x: 470, y: 650 }, interceptRadius: 50 },
    ],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.55, radius: 85 },
    },
    objective: { type: 'goal' },
    stars: { two: { maxTouches: 2 }, three: { maxTouches: 1, noRewind: true } },
    dribbleOpportunities: [],
  },

  // 5 — primeiro passe obrigatório (tabela com o ponta).
  {
    version: 1,
    metadata: meta(5, 'Tabela', 2),
    ...kickoff,
    teammates: [{ id: 'ponta-esquerda', position: { x: 200, y: 650 } }],
    defenders: [{ id: 'zagueiro-1', position: { x: 360, y: 620 }, interceptRadius: 55 }],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.45, radius: 80 },
    },
    objective: { type: 'goal_after_passes', minPasses: 1 },
    stars: { two: { maxTouches: 3 }, three: { maxTouches: 2, noRewind: true } },
    dribbleOpportunities: [],
  },

  // 6 — triangulação: dois passes antes do gol.
  {
    version: 1,
    metadata: meta(6, 'Triangulação', 2),
    ...kickoff,
    teammates: [
      { id: 'ponta-esquerda', position: { x: 180, y: 700 } },
      { id: 'meia-direita', position: { x: 520, y: 480 } },
    ],
    defenders: [
      { id: 'zagueiro-1', position: { x: 360, y: 650 }, interceptRadius: 50 },
      { id: 'zagueiro-2', position: { x: 360, y: 350 }, interceptRadius: 50 },
    ],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.45, radius: 75 },
    },
    objective: { type: 'goal_after_passes', minPasses: 2 },
    stars: { two: { maxTouches: 4 }, three: { maxTouches: 3, noRewind: true } },
    dribbleOpportunities: [],
  },

  // 7 — defesa fechada: três zagueiros, só a ala esquerda respira.
  {
    version: 1,
    metadata: meta(7, 'Defesa Fechada', 3),
    ...kickoff,
    teammates: [],
    defenders: [
      { id: 'zagueiro-1', position: { x: 250, y: 550 }, interceptRadius: 50 },
      { id: 'zagueiro-2', position: { x: 470, y: 550 }, interceptRadius: 50 },
      { id: 'volante', position: { x: 360, y: 380 }, interceptRadius: 55 },
    ],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.5, radius: 80 },
    },
    objective: { type: 'goal' },
    stars: { two: { maxTouches: 2 }, three: { maxTouches: 1, noRewind: true } },
    // parar a bola na meia-lua permite arriscar a roleta de drible (M3)
    dribbleOpportunities: [
      { id: 'drible-meia-lua', position: { x: 360, y: 700 }, radius: 70, defense: 30 },
    ],
  },

  // 8 — pivô em movimento: passe no espaço para o atacante que infiltra.
  {
    version: 1,
    metadata: meta(8, 'Pivô', 3),
    ...kickoff,
    teammates: [
      {
        id: 'centroavante',
        position: { x: 550, y: 700 },
        route: [
          { x: 550, y: 700, t: 0 },
          { x: 450, y: 420, t: 2.2 },
        ],
      },
    ],
    defenders: [{ id: 'zagueiro-1', position: { x: 300, y: 600 }, interceptRadius: 55 }],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.5, radius: 80 },
    },
    objective: { type: 'goal_after_passes', minPasses: 1 },
    stars: { two: { maxTouches: 3 }, three: { maxTouches: 2, noRewind: true } },
    dribbleOpportunities: [],
  },

  // 9 — cerco: quatro zagueiros; a saída é o corredor da direita.
  {
    version: 1,
    metadata: meta(9, 'Cerco', 3),
    ...kickoff,
    teammates: [],
    defenders: [
      { id: 'zagueiro-1', position: { x: 250, y: 700 }, interceptRadius: 55 },
      { id: 'zagueiro-2', position: { x: 430, y: 650 }, interceptRadius: 50 },
      { id: 'volante', position: { x: 320, y: 420 }, interceptRadius: 50 },
      { id: 'lateral', position: { x: 150, y: 350 }, interceptRadius: 45 },
    ],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.6, radius: 88 },
    },
    objective: { type: 'goal' },
    stars: { two: { maxTouches: 2 }, three: { maxTouches: 1, noRewind: true } },
    dribbleOpportunities: [],
  },

  // 10 — rodada final: dois passes, um marcador em patrulha.
  {
    version: 1,
    metadata: meta(10, 'Rodada Final', 4),
    ...kickoff,
    teammates: [
      { id: 'ponta-esquerda', position: { x: 160, y: 680 } },
      { id: 'meia-direita', position: { x: 560, y: 500 } },
    ],
    defenders: [
      { id: 'zagueiro-1', position: { x: 360, y: 780 }, interceptRadius: 50 },
      {
        id: 'volante-patrulha',
        position: { x: 280, y: 320 },
        interceptRadius: 45,
        route: [
          { x: 280, y: 320, t: 0 },
          { x: 200, y: 320, t: 3 },
        ],
      },
    ],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.55, radius: 85 },
    },
    objective: { type: 'goal_after_passes', minPasses: 2 },
    stars: { two: { maxTouches: 4 }, three: { maxTouches: 3, noRewind: true } },
    dribbleOpportunities: [],
  },
];

/** Busca um nível da temporada 1 pelo ordinal (1-based). */
export function getSeason1Level(ordinal: number): LevelScript | undefined {
  return SEASON1_LEVELS.find((l) => l.metadata.ordinal === ordinal);
}
