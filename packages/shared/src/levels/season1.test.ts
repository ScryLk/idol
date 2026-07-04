import { describe, expect, it } from 'vitest';
import type { Point } from '../geometry/point.js';
import { parseLevelScript } from '../schemas/level.js';
import { LevelRuntime } from '../simulation/runtime.js';
import { getSeason1Level, SEASON1_LEVELS } from './season1.js';

/**
 * Solução scriptada de cada nível: sequência de toques (traços em coordenadas
 * de jogo; o runtime ancora cada traço na bola atual). Se um nível deixar de
 * ser completável com 3 estrelas por sua solução, este teste quebra o build —
 * é a garantia executável do DoD "jogar os 10 níveis do início ao fim".
 */
const SOLUTIONS: Record<number, Point[][]> = {
  1: [
    [
      { x: 330, y: 700 },
      { x: 300, y: 400 },
      { x: 280, y: 150 },
      { x: 278, y: 40 },
    ],
  ],
  2: [
    [
      { x: 330, y: 700 },
      { x: 290, y: 400 },
      { x: 272, y: 150 },
      { x: 270, y: 40 },
    ],
  ],
  3: [
    [
      { x: 300, y: 750 },
      { x: 252, y: 500 },
      { x: 258, y: 200 },
      { x: 272, y: 40 },
    ],
  ],
  4: [
    [
      { x: 360, y: 660 },
      { x: 330, y: 400 },
      { x: 285, y: 150 },
      { x: 278, y: 40 },
    ],
  ],
  5: [
    // passe para o ponta-esquerda…
    [
      { x: 280, y: 800 },
      { x: 208, y: 658 },
    ],
    // …e finalização no canto esquerdo
    [
      { x: 228, y: 400 },
      { x: 260, y: 150 },
      { x: 272, y: 40 },
    ],
  ],
  6: [
    // ponta-esquerda…
    [
      { x: 260, y: 820 },
      { x: 188, y: 708 },
    ],
    // …meia-direita…
    [
      { x: 350, y: 588 },
      { x: 512, y: 486 },
    ],
    // …gol no canto direito
    [
      { x: 490, y: 300 },
      { x: 452, y: 150 },
      { x: 446, y: 40 },
    ],
  ],
  7: [
    [
      { x: 220, y: 720 },
      { x: 158, y: 500 },
      { x: 190, y: 220 },
      { x: 272, y: 40 },
    ],
  ],
  8: [
    // passe no espaço: o centroavante infiltra e encontra a bola
    [
      { x: 440, y: 790 },
      { x: 522, y: 648 },
    ],
    // finalização do pivô no canto direito
    [
      { x: 500, y: 400 },
      { x: 460, y: 150 },
      { x: 448, y: 40 },
    ],
  ],
  9: [
    [
      { x: 550, y: 620 },
      { x: 598, y: 300 },
      { x: 470, y: 100 },
      { x: 452, y: 40 },
    ],
  ],
  10: [
    // ponta-esquerda…
    [
      { x: 250, y: 820 },
      { x: 168, y: 688 },
    ],
    // …lançamento para o meia-direita…
    [
      { x: 350, y: 600 },
      { x: 548, y: 508 },
    ],
    // …gol no canto direito (o volante-patrulha já saiu da zona)
    [
      { x: 520, y: 300 },
      { x: 468, y: 150 },
      { x: 452, y: 40 },
    ],
  ],
};

describe('SEASON1_LEVELS — integridade', () => {
  it('há exatamente 10 níveis, ordinais 1..10, temporada 1', () => {
    expect(SEASON1_LEVELS).toHaveLength(10);
    expect(SEASON1_LEVELS.map((l) => l.metadata.ordinal)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(SEASON1_LEVELS.every((l) => l.metadata.season === 1)).toBe(true);
  });

  it('todos passam pelo schema Zod LevelScript', () => {
    for (const level of SEASON1_LEVELS) {
      expect(() => parseLevelScript(level)).not.toThrow();
    }
  });

  it('dificuldade nunca regride mais que 1 ponto entre níveis vizinhos', () => {
    for (let i = 1; i < SEASON1_LEVELS.length; i++) {
      const prev = SEASON1_LEVELS[i - 1]?.metadata.difficulty ?? 0;
      const cur = SEASON1_LEVELS[i]?.metadata.difficulty ?? 0;
      expect(cur).toBeGreaterThanOrEqual(prev - 1);
    }
  });

  it('getSeason1Level busca por ordinal', () => {
    expect(getSeason1Level(3)?.metadata.name).toBe('Zagueiro Central');
    expect(getSeason1Level(99)).toBeUndefined();
  });
});

describe.each(SEASON1_LEVELS.map((l) => [l.metadata.ordinal, l.metadata.name] as const))(
  'Nível %i — %s',
  (ordinal) => {
    it('é completável com 3 estrelas pela solução scriptada', () => {
      const script = getSeason1Level(ordinal);
      expect(script).toBeDefined();
      const solution = SOLUTIONS[ordinal];
      expect(solution, `nível ${ordinal} sem solução scriptada`).toBeDefined();

      const rt = new LevelRuntime(script as NonNullable<typeof script>);
      for (const trace of solution as Point[][]) {
        const r = rt.executeTrace(trace);
        expect(
          r.phase,
          `nível ${ordinal}: toque falhou com ${r.shot.outcome} em (${r.shot.position.x.toFixed(0)}, ${r.shot.position.y.toFixed(0)})`,
        ).not.toBe('failed');
      }
      expect(rt.getState().phase).toBe('complete');
      expect(rt.evaluateStars()).toBe(3);
    });
  },
);
