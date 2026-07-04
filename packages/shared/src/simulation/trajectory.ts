import { catmullRomSpline } from '../geometry/catmullRom.js';
import type { Point } from '../geometry/point.js';
import { simplifyRdp } from '../geometry/rdp.js';
import { resampleBySpacing } from '../geometry/resample.js';

/**
 * Pipeline canônico do traço (mesma implementação no cliente e no servidor):
 * pontos crus do pointer → simplificação RDP → ajuste Catmull-Rom →
 * reamostragem por comprimento de arco.
 *
 * Determinismo é contrato: mesma entrada ⇒ mesma trajetória, sem RNG.
 */
export interface TrajectoryOptions {
  /** Tolerância RDP em unidades de campo (calibrada para dedo, não mouse). */
  epsilon: number;
  /** Subdivisões da spline por segmento simplificado. */
  samplesPerSegment: number;
  /** Espaçamento da reamostragem em unidades de campo. */
  spacing: number;
}

export const DEFAULT_TRAJECTORY_OPTIONS: TrajectoryOptions = {
  epsilon: 8,
  samplesPerSegment: 12,
  spacing: 6,
};

export function buildTrajectory(
  raw: readonly Point[],
  options: TrajectoryOptions = DEFAULT_TRAJECTORY_OPTIONS,
): Point[] {
  if (raw.length < 2) return [...raw];
  const simplified = simplifyRdp(raw, options.epsilon);
  const smooth = catmullRomSpline(simplified, options.samplesPerSegment);
  return resampleBySpacing(smooth, options.spacing);
}
