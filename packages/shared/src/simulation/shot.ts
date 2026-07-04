import { angleDiff, dist, type Point } from '../geometry/point.js';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_LINE_Y,
  GOAL_MOUTH_X_MAX,
  GOAL_MOUTH_X_MIN,
} from './field.js';

/**
 * Simulação determinística do chute: a bola percorre a trajetória reamostrada
 * em velocidade constante e cada passo é checado, nesta ordem:
 *   1. interceptação por defensor (distância ≤ raio)
 *   2. defesa do goleiro (dentro do raio E dentro do arco angular)
 *   3. cruzamento da linha de gol (dentro da boca → gol; fora → fora)
 *   4. saída do campo pelas laterais/fundo
 * Se a trajetória termina sem evento, o resultado é 'stopped' (bola dominada).
 * NUNCA há aleatoriedade aqui — mesma trajetória ⇒ mesmo resultado.
 */

export interface DefenderState {
  id: string;
  position: Point;
  interceptRadius: number;
}

export interface GoalkeeperState {
  position: Point;
  arc: {
    /** Ângulo central do arco de defesa, em radianos. */
    centerAngle: number;
    /** Meia-abertura do arco, em radianos. */
    halfAngle: number;
    /** Alcance do goleiro, em unidades de campo. */
    radius: number;
  };
}

export type ShotOutcome = 'goal' | 'intercepted' | 'saved' | 'out' | 'stopped';

export interface ShotResult {
  outcome: ShotOutcome;
  /** Posição onde o evento ocorreu. */
  position: Point;
  /** Índice do ponto da trajetória onde o evento ocorreu. */
  index: number;
  /** Instante do evento em segundos (comprimento percorrido / velocidade). */
  time: number;
  /** Defensor responsável, quando outcome = 'intercepted'. */
  defenderId?: string;
}

export interface ShotWorld {
  defenders: readonly DefenderState[];
  goalkeeper?: GoalkeeperState;
  /** Velocidade da bola em unidades de campo por segundo. */
  speed: number;
}

function insideGoalMouth(x: number): boolean {
  return x >= GOAL_MOUTH_X_MIN && x <= GOAL_MOUTH_X_MAX;
}

export function simulateShot(path: readonly Point[], world: ShotWorld): ShotResult {
  if (path.length === 0) throw new RangeError('simulateShot: trajetória vazia');
  if (world.speed <= 0) throw new RangeError(`simulateShot: velocidade inválida (${world.speed})`);

  let traveled = 0;
  for (let i = 0; i < path.length; i++) {
    const p = path[i] as Point;
    if (i > 0) traveled += dist(path[i - 1] as Point, p);
    const time = traveled / world.speed;

    // 1. Interceptação
    for (const d of world.defenders) {
      if (dist(p, d.position) <= d.interceptRadius) {
        return { outcome: 'intercepted', position: { ...p }, index: i, time, defenderId: d.id };
      }
    }

    // 2. Defesa do goleiro (raio + arco angular)
    const gk = world.goalkeeper;
    if (gk) {
      const dToGk = dist(p, gk.position);
      if (dToGk <= gk.arc.radius) {
        const angle = Math.atan2(p.y - gk.position.y, p.x - gk.position.x);
        if (Math.abs(angleDiff(angle, gk.arc.centerAngle)) <= gk.arc.halfAngle) {
          return { outcome: 'saved', position: { ...p }, index: i, time };
        }
      }
    }

    // 3. Cruzamento da linha de gol
    if (p.y <= GOAL_LINE_Y) {
      let crossX = p.x;
      if (i > 0) {
        const prev = path[i - 1] as Point;
        const dy = p.y - prev.y;
        if (dy !== 0) {
          const t = (GOAL_LINE_Y - prev.y) / dy;
          crossX = prev.x + (p.x - prev.x) * t;
        }
      }
      return {
        outcome: insideGoalMouth(crossX) ? 'goal' : 'out',
        position: { x: crossX, y: GOAL_LINE_Y },
        index: i,
        time,
      };
    }

    // 4. Saída pelas laterais ou fundo
    if (p.x < 0 || p.x > FIELD_WIDTH || p.y > FIELD_HEIGHT) {
      return { outcome: 'out', position: { ...p }, index: i, time };
    }
  }

  const last = path[path.length - 1] as Point;
  return {
    outcome: 'stopped',
    position: { ...last },
    index: path.length - 1,
    time: traveled / world.speed,
  };
}
