import { describe, expect, it } from 'vitest';
import { positionOnRoute, type TimedPoint } from './route.js';

const route: TimedPoint[] = [
  { x: 0, y: 0, t: 1 },
  { x: 100, y: 0, t: 2 },
  { x: 100, y: 50, t: 4 },
];

describe('positionOnRoute', () => {
  it('sem rota → fallback (cópia, não referência)', () => {
    const fallback = { x: 7, y: 8 };
    const p = positionOnRoute(undefined, 5, fallback);
    expect(p).toEqual(fallback);
    expect(p).not.toBe(fallback);
    expect(positionOnRoute([], 5, fallback)).toEqual(fallback);
  });

  it('antes do primeiro waypoint fica nele', () => {
    expect(positionOnRoute(route, 0, { x: 9, y: 9 })).toEqual({ x: 0, y: 0 });
    expect(positionOnRoute(route, 1, { x: 9, y: 9 })).toEqual({ x: 0, y: 0 });
  });

  it('interpola linearmente dentro de um trecho', () => {
    expect(positionOnRoute(route, 1.5, { x: 0, y: 0 })).toEqual({ x: 50, y: 0 });
    expect(positionOnRoute(route, 3, { x: 0, y: 0 })).toEqual({ x: 100, y: 25 });
  });

  it('chega exatamente nos waypoints nos seus instantes', () => {
    expect(positionOnRoute(route, 2, { x: 0, y: 0 })).toEqual({ x: 100, y: 0 });
    expect(positionOnRoute(route, 4, { x: 0, y: 0 })).toEqual({ x: 100, y: 50 });
  });

  it('depois do último waypoint permanece nele', () => {
    expect(positionOnRoute(route, 99, { x: 0, y: 0 })).toEqual({ x: 100, y: 50 });
  });
});
