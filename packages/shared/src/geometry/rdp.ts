import { pointToSegmentDistance, type Point } from './point.js';

/**
 * Simplificação Ramer–Douglas–Peucker.
 * Remove pontos cuja distância perpendicular ao segmento envolvente é < epsilon.
 * Sempre preserva o primeiro e o último ponto.
 */
export function simplifyRdp(points: readonly Point[], epsilon: number): Point[] {
  if (epsilon < 0) throw new RangeError(`simplifyRdp: epsilon negativo (${epsilon})`);
  if (points.length <= 2) return [...points];

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  // Iterativo (pilha) para não estourar recursão com traços longos de dedo.
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    const a = points[start] as Point;
    const b = points[end] as Point;
    let maxDist = -1;
    let maxIndex = -1;
    for (let i = start + 1; i < end; i++) {
      const d = pointToSegmentDistance(points[i] as Point, a, b);
      if (d > maxDist) {
        maxDist = d;
        maxIndex = i;
      }
    }
    if (maxDist > epsilon && maxIndex !== -1) {
      keep[maxIndex] = true;
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }

  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    if (keep[i]) result.push(points[i] as Point);
  }
  return result;
}
