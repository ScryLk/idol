import { describe, expect, it } from 'vitest';
import type { Point } from '../geometry/point.js';
import { polylineLength } from '../geometry/resample.js';
import { BALL_SPEED, GOAL_LINE_Y, GOAL_MOUTH_X_MAX, GOAL_MOUTH_X_MIN } from './field.js';
import { simulateShot, type GoalkeeperState, type ShotWorld } from './shot.js';
import { buildTrajectory, DEFAULT_TRAJECTORY_OPTIONS } from './trajectory.js';

/** Trajetória reta vertical de (x, fromY) até (x, toY), passo `step`. */
function verticalPath(x: number, fromY: number, toY: number, step = 6): Point[] {
  const out: Point[] = [];
  const dir = Math.sign(toY - fromY);
  for (let y = fromY; dir > 0 ? y <= toY : y >= toY; y += dir * step) out.push({ x, y });
  return out;
}

const gk: GoalkeeperState = {
  position: { x: 360, y: 110 },
  arc: { centerAngle: Math.PI / 2, halfAngle: 0.55, radius: 85 },
};

const world = (overrides: Partial<ShotWorld> = {}): ShotWorld => ({
  defenders: [
    { id: 'zagueiro-1', position: { x: 200, y: 500 }, interceptRadius: 40 },
    { id: 'zagueiro-2', position: { x: 520, y: 500 }, interceptRadius: 40 },
  ],
  goalkeeper: gk,
  speed: BALL_SPEED,
  ...overrides,
});

describe('simulateShot', () => {
  it('chute no canto entra: gol', () => {
    // x=280 evita os defensores (dist mínima 80) e o arco do goleiro
    const r = simulateShot(verticalPath(280, 940, 40), world());
    expect(r.outcome).toBe('goal');
    expect(r.position.y).toBe(GOAL_LINE_Y);
    expect(r.position.x).toBe(280);
  });

  it('chute no meio: goleiro defende (arco)', () => {
    const r = simulateShot(verticalPath(360, 940, 40), world());
    expect(r.outcome).toBe('saved');
    // defendido na borda do alcance do goleiro
    expect(r.position.y).toBeGreaterThan(gk.position.y);
    expect(r.position.y).toBeLessThanOrEqual(gk.position.y + gk.arc.radius + 6);
  });

  it('mesma altura mas fora do arco angular: não defende', () => {
    // passa a 80 de distância horizontal do goleiro — dentro do raio 85,
    // mas o ângulo (quase horizontal) está fora do arco de 0.55 rad
    const r = simulateShot(verticalPath(281, 130, 40), world({ defenders: [] }));
    expect(r.outcome).toBe('goal');
  });

  it('trajetória cruza o raio de um defensor: interceptada', () => {
    const r = simulateShot(verticalPath(210, 940, 40), world());
    expect(r.outcome).toBe('intercepted');
    expect(r.defenderId).toBe('zagueiro-1');
  });

  it('cruza a linha de gol fora da boca: fora', () => {
    const r = simulateShot(verticalPath(100, 300, 40), world({ defenders: [] }));
    expect(r.outcome).toBe('out');
    expect(r.position.x).toBeLessThan(GOAL_MOUTH_X_MIN);
  });

  it('interpola o x exato do cruzamento da linha de gol', () => {
    // diagonal que cruza y=60 entre dois samples
    const path: Point[] = [
      { x: 250, y: 100 },
      { x: 290, y: 20 },
    ];
    const r = simulateShot(path, world({ defenders: [], goalkeeper: undefined as never }));
    expect(r.outcome).toBe('goal');
    expect(r.position.x).toBeCloseTo(270, 6); // metade do caminho vertical
    expect(r.position.x).toBeGreaterThanOrEqual(GOAL_MOUTH_X_MIN);
    expect(r.position.x).toBeLessThanOrEqual(GOAL_MOUTH_X_MAX);
  });

  it('sai pela lateral: fora', () => {
    const path: Point[] = [
      { x: 700, y: 800 },
      { x: 715, y: 790 },
      { x: 730, y: 780 },
    ];
    const r = simulateShot(path, world({ defenders: [] }));
    expect(r.outcome).toBe('out');
  });

  it('trajetória curta termina no campo: bola dominada (stopped)', () => {
    const r = simulateShot(verticalPath(360, 940, 700), world());
    expect(r.outcome).toBe('stopped');
    expect(r.position).toEqual({ x: 360, y: 700 });
  });

  it('tempo do evento = distância percorrida / velocidade', () => {
    const r = simulateShot(verticalPath(280, 940, 40, 6), world({ speed: 900 }));
    const expected = (940 - GOAL_LINE_Y) / 900;
    expect(r.time).toBeCloseTo(expected, 1);
  });

  it('é determinística: mesma trajetória ⇒ mesmo resultado', () => {
    const path = verticalPath(280, 940, 40);
    expect(simulateShot(path, world())).toEqual(simulateShot(path, world()));
  });

  it('rejeita entradas inválidas', () => {
    expect(() => simulateShot([], world())).toThrow(RangeError);
    expect(() => simulateShot(verticalPath(280, 940, 40), world({ speed: 0 }))).toThrow(RangeError);
  });
});

describe('buildTrajectory (pipeline completo)', () => {
  // traço "de dedo": ruidoso, denso
  const raw: Point[] = Array.from({ length: 120 }, (_, i) => ({
    x: 360 + Math.sin(i / 9) * 60 + (i % 3) - 1,
    y: 940 - i * 7,
  }));

  it('é determinístico', () => {
    expect(buildTrajectory(raw)).toEqual(buildTrajectory(raw));
  });

  it('preserva início e fim do traço', () => {
    const out = buildTrajectory(raw);
    expect(out[0]?.x).toBeCloseTo(raw[0]?.x ?? 0, 6);
    expect(out[0]?.y).toBeCloseTo(raw[0]?.y ?? 0, 6);
    const last = out[out.length - 1] as Point;
    const rawLast = raw[raw.length - 1] as Point;
    expect(last.x).toBeCloseTo(rawLast.x, 6);
    expect(last.y).toBeCloseTo(rawLast.y, 6);
  });

  it('reamostra com espaçamento ~uniforme', () => {
    const out = buildTrajectory(raw);
    const total = polylineLength(out);
    const avg = total / (out.length - 1);
    expect(avg).toBeLessThanOrEqual(DEFAULT_TRAJECTORY_OPTIONS.spacing + 0.5);
  });

  it('entrada com < 2 pontos passa direto', () => {
    expect(buildTrajectory([{ x: 1, y: 2 }])).toEqual([{ x: 1, y: 2 }]);
  });

  it('pipeline + simulação: traço curvo ao canto marca gol', () => {
    // curva saindo da bola, desviando dos zagueiros e entrando no canto esquerdo
    const rawShot: Point[] = [];
    for (let i = 0; i <= 100; i++) {
      const t = i / 100;
      rawShot.push({ x: 360 - 80 * t, y: 940 - 900 * t });
    }
    const traj = buildTrajectory(rawShot);
    const r = simulateShot(traj, world());
    expect(r.outcome).toBe('goal');
  });
});
