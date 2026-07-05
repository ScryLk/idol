import { describe, expect, it } from 'vitest';
import type { Point } from '../geometry/point.js';
import type { LevelScript } from '../schemas/level.js';
import { BALL_SPEED } from './field.js';
import { LevelRuntime, PASS_RECEIVE_RADIUS } from './runtime.js';
import { simulateShot } from './shot.js';

/** Nível sintético mínimo para exercitar o runtime. */
function makeScript(overrides: Partial<LevelScript> = {}): LevelScript {
  return {
    version: 1,
    metadata: { name: 'Teste', season: 1, ordinal: 1, difficulty: 1 },
    ball: { x: 360, y: 940 },
    hero: { position: { x: 360, y: 990 } },
    teammates: [],
    defenders: [],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.35, radius: 70 },
    },
    objective: { type: 'goal' },
    stars: { two: { maxTouches: 2 }, three: { maxTouches: 1, noRewind: true } },
    dribbleOpportunities: [],
    ...overrides,
  };
}

const cornerShot: Point[] = [
  { x: 330, y: 700 },
  { x: 300, y: 400 },
  { x: 280, y: 150 },
  { x: 278, y: 40 },
];

describe('LevelRuntime — fluxo básico', () => {
  it('gol direto completa o nível e avalia 3 estrelas', () => {
    const rt = new LevelRuntime(makeScript());
    const result = rt.executeTrace(cornerShot);
    expect(result.shot.outcome).toBe('goal');
    expect(result.phase).toBe('complete');
    expect(rt.getState().touches).toBe(1);
    expect(rt.evaluateStars()).toBe(3);
  });

  it('estrelas caem para 2 com mais toques e para 1 com rewind', () => {
    const rt = new LevelRuntime(makeScript());
    // toque 1: bola dominada no meio do campo
    rt.executeTrace([{ x: 360, y: 700 }]);
    expect(rt.getState().phase).toBe('ready');
    // rewind (perde o noRewind do 3 estrelas e o maxTouches=1)
    expect(rt.rewind()).toBe(true);
    rt.executeTrace([{ x: 360, y: 700 }]);
    const r = rt.executeTrace(cornerShot);
    expect(r.phase).toBe('complete');
    // touches=2 → cumpre two(maxTouches 2) mas não three(maxTouches 1, noRewind)
    expect(rt.evaluateStars()).toBe(2);
  });

  it('interceptação falha o nível com o motivo correto', () => {
    const rt = new LevelRuntime(
      makeScript({
        defenders: [{ id: 'z1', position: { x: 360, y: 600 }, interceptRadius: 55 }],
      }),
    );
    const r = rt.executeTrace([
      { x: 360, y: 750 },
      { x: 360, y: 500 },
    ]);
    expect(r.shot.outcome).toBe('intercepted');
    expect(r.phase).toBe('failed');
    expect(r.failReason).toBe('intercepted');
    expect(() => rt.executeTrace(cornerShot)).toThrow(/ready/);
  });

  it('gol sem cumprir minPasses falha com motivo objective', () => {
    const rt = new LevelRuntime(
      makeScript({ objective: { type: 'goal_after_passes', minPasses: 1 } }),
    );
    const r = rt.executeTrace(cornerShot);
    expect(r.shot.outcome).toBe('goal');
    expect(r.phase).toBe('failed');
    expect(r.failReason).toBe('objective');
    expect(rt.evaluateStars()).toBe(0);
  });
});

describe('LevelRuntime — passes', () => {
  const withTeammate = makeScript({
    teammates: [{ id: 'ponta', position: { x: 200, y: 650 } }],
    objective: { type: 'goal_after_passes', minPasses: 1 },
    stars: { two: { maxTouches: 3 }, three: { maxTouches: 2, noRewind: true } },
  });

  it('bola parada perto do companheiro vira passe e troca o controlador', () => {
    const rt = new LevelRuntime(withTeammate);
    const r = rt.executeTrace([
      { x: 280, y: 800 },
      { x: 210, y: 660 },
    ]);
    expect(r.shot.outcome).toBe('stopped');
    expect(r.passedTo).toBe('ponta');
    const s = rt.getState();
    expect(s.passes).toBe(1);
    expect(s.controller).toBe('ponta');
    // bola domada exatamente no pé do recebedor
    expect(s.ball).toEqual({ x: 200, y: 650 });
  });

  it('passe + gol cumpre o objetivo e dá 3 estrelas', () => {
    const rt = new LevelRuntime(withTeammate);
    rt.executeTrace([
      { x: 280, y: 800 },
      { x: 210, y: 660 },
    ]);
    const r = rt.executeTrace([
      { x: 230, y: 400 },
      { x: 262, y: 150 },
      { x: 272, y: 40 },
    ]);
    expect(r.phase).toBe('complete');
    expect(rt.evaluateStars()).toBe(3);
  });

  it('bola parada longe de todos NÃO é passe', () => {
    const rt = new LevelRuntime(withTeammate);
    const r = rt.executeTrace([{ x: 500, y: 800 }]);
    expect(r.shot.outcome).toBe('stopped');
    expect(r.passedTo).toBeNull();
    expect(rt.getState().passes).toBe(0);
    expect(rt.getState().controller).toBe('hero');
  });

  it('recepção usa a posição do companheiro NO INSTANTE da chegada (rota)', () => {
    const rt = new LevelRuntime(
      makeScript({
        teammates: [
          {
            id: 'infiltrado',
            position: { x: 550, y: 700 },
            route: [
              { x: 550, y: 700, t: 0 },
              { x: 450, y: 420, t: 2.2 },
            ],
          },
        ],
        objective: { type: 'goal_after_passes', minPasses: 1 },
      }),
    );
    // bola até (520, 645): chega em ~0.38s; o infiltrado estará perto de (533, 652)
    const r = rt.executeTrace([
      { x: 440, y: 790 },
      { x: 520, y: 645 },
    ]);
    expect(r.passedTo).toBe('infiltrado');
    const s = rt.getState();
    // bola foi domada na posição do ator em movimento, não na inicial
    expect(s.ball.x).toBeLessThan(550);
    expect(s.ball.y).toBeLessThan(700);
  });
});

describe('LevelRuntime — rewind e relógio', () => {
  it('rewind restaura elapsed, bola, controlador e contadores', () => {
    const rt = new LevelRuntime(makeScript());
    const before = rt.getState();
    rt.executeTrace([{ x: 360, y: 700 }]);
    const mid = rt.getState();
    expect(mid.elapsed).toBeGreaterThan(before.elapsed);
    expect(rt.rewind()).toBe(true);
    const after = rt.getState();
    expect(after.elapsed).toBe(before.elapsed);
    expect(after.ball).toEqual(before.ball);
    expect(after.touches).toBe(0);
    expect(after.rewinds).toBe(1);
    expect(after.phase).toBe('ready');
  });

  it('não permite rewind sem toques nem após completar', () => {
    const rt = new LevelRuntime(makeScript());
    expect(rt.rewind()).toBe(false);
    rt.executeTrace(cornerShot);
    expect(rt.getState().phase).toBe('complete');
    expect(rt.rewind()).toBe(false);
  });

  it('o relógio só avança com toques e as rotas seguem o relógio', () => {
    const rt = new LevelRuntime(
      makeScript({
        defenders: [
          {
            id: 'patrulha',
            position: { x: 100, y: 500 },
            interceptRadius: 40,
            route: [
              { x: 100, y: 500, t: 0 },
              { x: 600, y: 500, t: 2 },
            ],
          },
        ],
      }),
    );
    expect(rt.actorsAt().defenders['patrulha']).toEqual({ x: 100, y: 500 });
    rt.executeTrace([{ x: 360, y: 700 }]); // ~0.27s de percurso
    const s = rt.getState();
    const pos = rt.actorsAt().defenders['patrulha'] as Point;
    expect(s.elapsed).toBeCloseTo(240 / BALL_SPEED, 1);
    expect(pos.x).toBeGreaterThan(100); // patrulha andou enquanto a bola rolava
  });
});

describe('simulateShot com timeOffset e rotas (interceptação dinâmica)', () => {
  const path: Point[] = Array.from({ length: 60 }, (_, i) => ({ x: 360, y: 940 - i * 6 }));

  it('defensor parado longe não intercepta; em rota que cruza, intercepta', () => {
    const still = simulateShot(path, {
      defenders: [{ id: 'd', position: { x: 100, y: 700 }, interceptRadius: 40 }],
      speed: BALL_SPEED,
    });
    expect(still.outcome).toBe('stopped');

    const moving = simulateShot(path, {
      defenders: [
        {
          id: 'd',
          position: { x: 100, y: 700 },
          interceptRadius: 40,
          route: [
            { x: 100, y: 700, t: 0 },
            { x: 360, y: 700, t: 0.25 }, // chega ao caminho junto com a bola
          ],
        },
      ],
      speed: BALL_SPEED,
    });
    expect(moving.outcome).toBe('intercepted');
  });

  it('timeOffset desloca a rota: defensor já passou quando a bola chega', () => {
    const world = {
      defenders: [
        {
          id: 'd',
          position: { x: 360, y: 700 },
          interceptRadius: 40,
          route: [
            { x: 360, y: 700, t: 0 },
            { x: 360, y: 700, t: 1 },
            { x: 700, y: 700, t: 1.5 },
          ],
        },
      ],
      speed: BALL_SPEED,
    };
    // sem offset: defensor ainda está no caminho → intercepta
    expect(simulateShot(path, world).outcome).toBe('intercepted');
    // com offset 2s: defensor já saiu para (700,700) → passa limpo
    expect(simulateShot(path, { ...world, timeOffset: 2 }).outcome).toBe('stopped');
  });
});

describe('LevelRuntime — roleta de drible', () => {
  const withDribble = makeScript({
    objective: { type: 'goal_with_dribble', minDribbles: 1 },
    dribbleOpportunities: [{ id: 'op-1', position: { x: 360, y: 700 }, radius: 70, defense: 30 }],
    stars: {
      two: { maxTouches: 3 },
      three: { maxTouches: 2, minPerfectDribbles: 1, noRewind: true },
    },
  });

  it('oportunidade só fica acionável com a bola dentro do raio', () => {
    const rt = new LevelRuntime(withDribble);
    expect(rt.availableDribble()).toBeNull();
    rt.executeTrace([{ x: 360, y: 710 }]); // para a 10 unidades do centro
    expect(rt.availableDribble()?.id).toBe('op-1');
  });

  it('sucesso conta para o objetivo; perfeito conta para as estrelas', () => {
    const rt = new LevelRuntime(withDribble);
    rt.executeTrace([{ x: 360, y: 710 }]);
    rt.applyDribbleOutcome('op-1', 'perfect');
    const s = rt.getState();
    expect(s.dribbleSuccesses).toBe(1);
    expect(s.perfectDribbles).toBe(1);
    expect(s.phase).toBe('ready');
    // oportunidade consumida: não aciona de novo
    expect(rt.availableDribble()).toBeNull();
    // gol agora cumpre o objetivo e o perfeito garante a 3ª estrela
    const r = rt.executeTrace(cornerShot);
    expect(r.phase).toBe('complete');
    expect(rt.evaluateStars()).toBe(3);
  });

  it('gol sem drible falha o objetivo goal_with_dribble', () => {
    const rt = new LevelRuntime(withDribble);
    const r = rt.executeTrace(cornerShot);
    expect(r.phase).toBe('failed');
    expect(r.failReason).toBe('objective');
  });

  it('falha na roleta perde a bola e o rewind devolve a oportunidade', () => {
    const rt = new LevelRuntime(withDribble);
    rt.executeTrace([{ x: 360, y: 710 }]);
    rt.applyDribbleOutcome('op-1', 'failure');
    let s = rt.getState();
    expect(s.phase).toBe('failed');
    expect(s.failReason).toBe('dribble');

    expect(rt.rewind()).toBe(true);
    s = rt.getState();
    expect(s.phase).toBe('ready');
    expect(s.dribbleSuccesses).toBe(0);
    expect(rt.availableDribble()?.id).toBe('op-1'); // devolvida pelo snapshot
  });

  it('rejeita acionamento fora de hora ou de oportunidade errada', () => {
    const rt = new LevelRuntime(withDribble);
    expect(() => rt.applyDribbleOutcome('op-1', 'success')).toThrow(/acionável/);
    rt.executeTrace([{ x: 360, y: 710 }]);
    expect(() => rt.applyDribbleOutcome('outra', 'success')).toThrow(/acionável/);
  });

  it('sucesso normal sem perfeito não dá a 3ª estrela (minPerfectDribbles)', () => {
    const rt = new LevelRuntime(withDribble);
    rt.executeTrace([{ x: 360, y: 710 }]);
    rt.applyDribbleOutcome('op-1', 'success');
    rt.executeTrace(cornerShot);
    expect(rt.getState().phase).toBe('complete');
    expect(rt.evaluateStars()).toBe(2);
  });
});

describe('PASS_RECEIVE_RADIUS', () => {
  it('é um alvo generoso para toque (>= 44 unidades)', () => {
    expect(PASS_RECEIVE_RADIUS).toBeGreaterThanOrEqual(44);
  });
});
