import { dist, type Point } from './point.js';

/** Comprimento total de uma polilinha. */
export function polylineLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += dist(points[i - 1] as Point, points[i] as Point);
  }
  return total;
}

/**
 * Reamostra a polilinha em pontos equidistantes por comprimento de arco.
 * Preserva exatamente o primeiro e o último ponto — é o passo que dá à bola
 * velocidade constante ao percorrer a curva.
 */
export function resampleBySpacing(points: readonly Point[], spacing: number): Point[] {
  if (spacing <= 0) throw new RangeError(`resampleBySpacing: spacing inválido (${spacing})`);
  if (points.length < 2) return [...points];

  const out: Point[] = [{ ...(points[0] as Point) }];
  let carry = 0; // distância já percorrida dentro do segmento atual até o próximo sample

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    const segLen = dist(a, b);
    if (segLen === 0) continue;
    let d = spacing - carry;
    while (d <= segLen) {
      const t = d / segLen;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += spacing;
    }
    carry = segLen - (d - spacing);
  }

  const last = points[points.length - 1] as Point;
  const tail = out[out.length - 1] as Point;
  if (tail.x !== last.x || tail.y !== last.y) out.push({ ...last });
  return out;
}
