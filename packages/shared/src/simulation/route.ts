import type { Point } from '../geometry/point.js';

/** Waypoint temporizado: o ator deve estar em (x, y) no instante t (segundos). */
export interface TimedPoint {
  x: number;
  y: number;
  t: number;
}

/**
 * Posição de um ator numa rota de waypoints no instante `time` (interpolação
 * linear por trecho). Antes do primeiro waypoint fica nele; depois do último,
 * permanece no último. Sem rota → `fallback` (posição inicial do ator).
 */
export function positionOnRoute(
  route: readonly TimedPoint[] | undefined,
  time: number,
  fallback: Point,
): Point {
  if (!route || route.length === 0) return { x: fallback.x, y: fallback.y };

  const first = route[0] as TimedPoint;
  if (time <= first.t) return { x: first.x, y: first.y };

  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1] as TimedPoint;
    const b = route[i] as TimedPoint;
    if (time <= b.t) {
      const span = b.t - a.t;
      const k = span > 0 ? (time - a.t) / span : 1;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
  }

  const last = route[route.length - 1] as TimedPoint;
  return { x: last.x, y: last.y };
}
