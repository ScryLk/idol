import type { Point } from './point.js';

/**
 * Amostra uma spline Catmull-Rom (uniforme) que passa por todos os pontos de
 * controle. Extremidades são duplicadas (clamp) para a curva começar e terminar
 * exatamente no primeiro e último ponto.
 */
export function catmullRomSpline(points: readonly Point[], samplesPerSegment: number): Point[] {
  if (!Number.isInteger(samplesPerSegment) || samplesPerSegment < 1) {
    throw new RangeError(`catmullRomSpline: samplesPerSegment inválido (${samplesPerSegment})`);
  }
  if (points.length < 2) return [...points];

  const pt = (i: number): Point => points[Math.max(0, Math.min(points.length - 1, i))] as Point;
  const out: Point[] = [{ ...pt(0) }];

  for (let seg = 0; seg < points.length - 1; seg++) {
    const p0 = pt(seg - 1);
    const p1 = pt(seg);
    const p2 = pt(seg + 1);
    const p3 = pt(seg + 2);
    for (let s = 1; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x:
          0.5 *
          (2 * p1.x +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y:
          0.5 *
          (2 * p1.y +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  return out;
}
