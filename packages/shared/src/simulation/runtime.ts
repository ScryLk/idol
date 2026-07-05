import type { DribbleOutcome } from '../formulas/dribble.js';
import { dist, type Point } from '../geometry/point.js';
import type { LevelScript } from '../schemas/level.js';
import { BALL_SPEED } from './field.js';
import { positionOnRoute } from './route.js';
import { simulateShot, type ShotResult, type ShotWorld } from './shot.js';
import { buildTrajectory, DEFAULT_TRAJECTORY_OPTIONS } from './trajectory.js';

/**
 * LevelRuntime — interpreta um LevelScript como máquina de fases de toque:
 * pausa (ready) → desenho → simulação → próxima fase. Todo o estado e as
 * regras são determinísticos e independentes de engine; a cena Phaser apenas
 * anima o que o runtime decidiu.
 *
 * O relógio do nível SÓ avança durante a simulação de um toque (o tempo fica
 * congelado enquanto o jogador mira). Rotas de atores usam esse relógio.
 */

/** Raio de recepção de passe ao redor do companheiro, em unidades de campo. */
export const PASS_RECEIVE_RADIUS = 55;

export type LevelPhase = 'ready' | 'complete' | 'failed';

export type FailReason = 'intercepted' | 'saved' | 'out' | 'objective' | 'dribble';

export interface RuntimeState {
  phase: LevelPhase;
  touches: number;
  passes: number;
  /** Dribles perfeitos concedidos pela roleta. */
  perfectDribbles: number;
  /** Dribles bem-sucedidos no total (normais + perfeitos). */
  dribbleSuccesses: number;
  rewinds: number;
  elapsed: number;
  ball: Point;
  /** Quem domina a bola: 'hero' ou o id de um companheiro. */
  controller: string;
  failReason: FailReason | null;
}

export interface TouchOutcome {
  trajectory: Point[];
  shot: ShotResult;
  /** Id do companheiro que recebeu o passe, se houve recepção. */
  passedTo: string | null;
  /** Fase do nível após o toque. */
  phase: LevelPhase;
  failReason: FailReason | null;
  /** Tempo do nível no INÍCIO deste toque (para animar rotas em sincronia). */
  startElapsed: number;
}

interface Snapshot {
  elapsed: number;
  ball: Point;
  controller: string;
  touches: number;
  passes: number;
  perfectDribbles: number;
  dribbleSuccesses: number;
  usedOpportunities: string[];
}

export interface ActorPositions {
  teammates: Record<string, Point>;
  defenders: Record<string, Point>;
}

export class LevelRuntime {
  private readonly script: LevelScript;
  private readonly world: ShotWorld;

  private phase: LevelPhase = 'ready';
  private elapsed = 0;
  private touches = 0;
  private passes = 0;
  private perfectDribbles = 0;
  private rewinds = 0;
  private ball: Point;
  private controller = 'hero';
  private failReason: FailReason | null = null;
  private dribbleSuccesses = 0;
  private usedOpportunities = new Set<string>();
  private readonly snapshots: Snapshot[] = [];

  constructor(script: LevelScript) {
    this.script = script;
    this.ball = { ...script.ball };
    this.world = {
      defenders: script.defenders.map((d) => ({
        id: d.id,
        position: d.position,
        interceptRadius: d.interceptRadius,
        ...(d.route ? { route: d.route } : {}),
      })),
      goalkeeper: {
        position: script.goalkeeper.position,
        arc: script.goalkeeper.arc,
      },
      speed: BALL_SPEED,
    };
  }

  getState(): RuntimeState {
    return {
      phase: this.phase,
      touches: this.touches,
      passes: this.passes,
      perfectDribbles: this.perfectDribbles,
      dribbleSuccesses: this.dribbleSuccesses,
      rewinds: this.rewinds,
      elapsed: this.elapsed,
      ball: { ...this.ball },
      controller: this.controller,
      failReason: this.failReason,
    };
  }

  /**
   * Oportunidade de drible acionável agora: nível em 'ready', bola dentro do
   * raio de uma oportunidade ainda não usada. A ROLETA NÃO RODA AQUI — o
   * sorteio é do servidor; o resultado volta via applyDribbleOutcome().
   */
  availableDribble(): LevelScript['dribbleOpportunities'][number] | null {
    if (this.phase !== 'ready') return null;
    for (const op of this.script.dribbleOpportunities) {
      if (!this.usedOpportunities.has(op.id) && dist(this.ball, op.position) <= op.radius) {
        return op;
      }
    }
    return null;
  }

  /**
   * Aplica o resultado da roleta (vindo do servidor ou do fallback local de
   * dev) à oportunidade acionável. Sucesso/perfeito contam para objetivos;
   * falha perde a bola (failReason 'dribble'). Snapshot antes, para rewind.
   */
  applyDribbleOutcome(opportunityId: string, outcome: DribbleOutcome): void {
    const op = this.availableDribble();
    if (!op || op.id !== opportunityId) {
      throw new Error(`applyDribbleOutcome: oportunidade '${opportunityId}' não está acionável`);
    }
    this.snapshots.push(this.takeSnapshot());
    this.usedOpportunities.add(opportunityId);
    if (outcome === 'failure') {
      this.phase = 'failed';
      this.failReason = 'dribble';
      return;
    }
    this.dribbleSuccesses += 1;
    if (outcome === 'perfect') this.perfectDribbles += 1;
  }

  /** Posições de todos os atores no instante `time` (default: relógio atual). */
  actorsAt(time: number = this.elapsed): ActorPositions {
    const teammates: Record<string, Point> = {};
    for (const t of this.script.teammates) {
      teammates[t.id] = positionOnRoute(t.route, time, t.position);
    }
    const defenders: Record<string, Point> = {};
    for (const d of this.script.defenders) {
      defenders[d.id] = positionOnRoute(d.route, time, d.position);
    }
    return { teammates, defenders };
  }

  /**
   * Executa um toque: constrói a trajetória a partir da bola atual, simula
   * deterministicamente e aplica as regras de passe/objetivo/falha.
   */
  executeTrace(raw: readonly Point[]): TouchOutcome {
    if (this.phase !== 'ready') {
      throw new Error(`executeTrace: nível não está em 'ready' (fase atual: ${this.phase})`);
    }

    this.snapshots.push(this.takeSnapshot());

    // O traço SEMPRE parte da bola atual — prepend se o desenho não começou nela.
    const first = raw[0];
    const anchored: Point[] =
      first && dist(first, this.ball) < 1 ? [...raw] : [{ ...this.ball }, ...raw];

    const startElapsed = this.elapsed;
    const trajectory = buildTrajectory(anchored, DEFAULT_TRAJECTORY_OPTIONS);
    const shot = simulateShot(trajectory, { ...this.world, timeOffset: startElapsed });

    this.touches += 1;
    this.elapsed = startElapsed + shot.time;
    this.ball = { ...shot.position };

    let passedTo: string | null = null;

    switch (shot.outcome) {
      case 'goal': {
        if (this.objectiveMet()) {
          this.phase = 'complete';
        } else {
          this.phase = 'failed';
          this.failReason = 'objective';
        }
        break;
      }
      case 'intercepted':
      case 'saved':
      case 'out': {
        this.phase = 'failed';
        this.failReason = shot.outcome;
        break;
      }
      case 'stopped': {
        // Recepção de passe: companheiro mais próximo dentro do raio, na
        // posição em que ele ESTÁ no instante da chegada da bola.
        let best: { id: string; pos: Point; d: number } | null = null;
        for (const t of this.script.teammates) {
          const pos = positionOnRoute(t.route, this.elapsed, t.position);
          const d = dist(this.ball, pos);
          if (d <= PASS_RECEIVE_RADIUS && (best === null || d < best.d)) {
            best = { id: t.id, pos, d };
          }
        }
        if (best && best.id !== this.controller) {
          this.passes += 1;
          this.controller = best.id;
          this.ball = { ...best.pos }; // bola domada no pé do recebedor
          passedTo = best.id;
        }
        break;
      }
    }

    return {
      trajectory,
      shot,
      passedTo,
      phase: this.phase,
      failReason: this.failReason,
      startElapsed,
    };
  }

  /**
   * Rewind com snapshot: desfaz o último toque (inclusive após falha).
   * Não permitido após completar o nível. Conta para o critério de estrelas.
   */
  rewind(): boolean {
    if (this.phase === 'complete') return false;
    const snap = this.snapshots.pop();
    if (!snap) return false;
    this.elapsed = snap.elapsed;
    this.ball = { ...snap.ball };
    this.controller = snap.controller;
    this.touches = snap.touches;
    this.passes = snap.passes;
    this.perfectDribbles = snap.perfectDribbles;
    this.dribbleSuccesses = snap.dribbleSuccesses;
    this.usedOpportunities = new Set(snap.usedOpportunities);
    this.phase = 'ready';
    this.failReason = null;
    this.rewinds += 1;
    return true;
  }

  private takeSnapshot(): Snapshot {
    return {
      elapsed: this.elapsed,
      ball: { ...this.ball },
      controller: this.controller,
      touches: this.touches,
      passes: this.passes,
      perfectDribbles: this.perfectDribbles,
      dribbleSuccesses: this.dribbleSuccesses,
      usedOpportunities: [...this.usedOpportunities],
    };
  }

  /** 0 = não completou; 1 = completou; 2/3 conforme critérios do script. */
  evaluateStars(): 0 | 1 | 2 | 3 {
    if (this.phase !== 'complete') return 0;
    if (this.meets(this.script.stars.three)) return 3;
    if (this.meets(this.script.stars.two)) return 2;
    return 1;
  }

  private meets(criterion: LevelScript['stars']['two']): boolean {
    if (criterion.maxTouches !== undefined && this.touches > criterion.maxTouches) return false;
    if (criterion.noRewind && this.rewinds > 0) return false;
    if (
      criterion.minPerfectDribbles !== undefined &&
      this.perfectDribbles < criterion.minPerfectDribbles
    ) {
      return false;
    }
    return true;
  }

  private objectiveMet(): boolean {
    const obj = this.script.objective;
    switch (obj.type) {
      case 'goal':
        return true;
      case 'goal_after_passes':
        return this.passes >= obj.minPasses;
      case 'goal_with_dribble':
        return this.dribbleSuccesses >= obj.minDribbles;
    }
  }
}
