import { describe, expect, it } from 'vitest';
import { LevelScript, parseLevelScript } from './level.js';

export const validLevel = {
  version: 1,
  metadata: { name: 'Estreia', season: 1, ordinal: 1, difficulty: 1 },
  ball: { x: 360, y: 900 },
  hero: { position: { x: 360, y: 950 } },
  teammates: [
    {
      id: 'atacante-1',
      position: { x: 200, y: 600 },
      route: [
        { x: 200, y: 600, t: 0 },
        { x: 300, y: 400, t: 1.5 },
      ],
    },
  ],
  defenders: [{ id: 'zagueiro-1', position: { x: 360, y: 500 }, interceptRadius: 40 }],
  goalkeeper: {
    position: { x: 360, y: 120 },
    arc: { centerAngle: Math.PI / 2, halfAngle: Math.PI / 4, radius: 90 },
  },
  objective: { type: 'goal' as const },
  stars: { two: { maxTouches: 3 }, three: { maxTouches: 2, noRewind: true } },
  dribbleOpportunities: [{ id: 'drible-1', position: { x: 360, y: 450 }, radius: 60, defense: 30 }],
};

describe('LevelScript', () => {
  it('aceita um nível válido completo', () => {
    expect(() => parseLevelScript(validLevel)).not.toThrow();
  });

  it('roundtrip JSON preserva a validade (contrato do editor)', () => {
    const roundtripped: unknown = JSON.parse(JSON.stringify(validLevel));
    expect(parseLevelScript(roundtripped)).toEqual(validLevel);
  });

  it('rejeita versão desconhecida', () => {
    expect(() => parseLevelScript({ ...validLevel, version: 2 })).toThrow();
  });

  it('rejeita coordenadas fora do campo 720×1280', () => {
    expect(() => parseLevelScript({ ...validLevel, ball: { x: 721, y: 0 } })).toThrow();
    expect(() => parseLevelScript({ ...validLevel, ball: { x: 0, y: -1 } })).toThrow();
  });

  it('rejeita rota com timestamps não crescentes', () => {
    const bad = {
      ...validLevel,
      teammates: [
        {
          id: 't1',
          position: { x: 0, y: 0 },
          route: [
            { x: 0, y: 0, t: 1 },
            { x: 10, y: 10, t: 1 },
          ],
        },
      ],
    };
    expect(() => parseLevelScript(bad)).toThrow(/estritamente crescente/);
  });

  it('rejeita rota com menos de 2 waypoints', () => {
    const bad = {
      ...validLevel,
      teammates: [{ id: 't1', position: { x: 0, y: 0 }, route: [{ x: 0, y: 0, t: 0 }] }],
    };
    expect(() => parseLevelScript(bad)).toThrow();
  });

  it('rejeita objetivo com payload inválido', () => {
    expect(() =>
      parseLevelScript({ ...validLevel, objective: { type: 'goal_after_passes', minPasses: 0 } }),
    ).toThrow();
    expect(() => parseLevelScript({ ...validLevel, objective: { type: 'hat_trick' } })).toThrow();
  });

  it('rejeita raio de interceptação não positivo', () => {
    const bad = {
      ...validLevel,
      defenders: [{ id: 'd1', position: { x: 0, y: 0 }, interceptRadius: 0 }],
    };
    expect(() => parseLevelScript(bad)).toThrow();
  });

  it('safeParse expõe erros estruturados para o editor', () => {
    const result = LevelScript.safeParse({});
    expect(result.success).toBe(false);
  });
});
