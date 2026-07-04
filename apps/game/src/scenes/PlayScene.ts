import Phaser from 'phaser';
import {
  BALL_SPEED,
  buildTrajectory,
  DEFAULT_TRAJECTORY_OPTIONS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_LINE_Y,
  GOAL_MOUTH_X_MAX,
  GOAL_MOUTH_X_MIN,
  simulateShot,
  type Point,
  type ShotResult,
  type ShotWorld,
} from '@idol/shared';

type SceneState = 'aiming' | 'tracing' | 'moving' | 'result';

/** Raio ao redor da bola onde o traço pode começar (generoso para dedo). */
const TRACE_START_RADIUS = 110;
/** Distância mínima entre pontos crus capturados (suavização para dedo). */
const MIN_POINT_DISTANCE = 4;
/** Comprimento mínimo do traço para valer um chute. */
const MIN_TRACE_LENGTH = 60;
/** Capacidade do buffer de pontos crus — pré-alocado, zero alocação no hot path. */
const MAX_RAW_POINTS = 2048;

const OUTCOME_LABEL: Record<ShotResult['outcome'], string> = {
  goal: 'GOL!',
  intercepted: 'INTERCEPTADO',
  saved: 'DEFENDEU O GOLEIRO',
  out: 'PRA FORA',
  stopped: 'BOLA DOMINADA',
};

import '../e2eHook.js';

/**
 * M1 — núcleo do traço: campo 2D top-down, 1 herói, 2 defensores e goleiro.
 * O jogador desenha o traço a partir da bola; o pipeline determinístico de
 * @idol/shared (RDP → Catmull-Rom → reamostragem → simulação) decide o
 * resultado ANTES da animação começar — a cena apenas anima.
 */
export class PlayScene extends Phaser.Scene {
  private state: SceneState = 'aiming';

  // Buffers pré-alocados do traço (hot path do pointermove não aloca)
  private readonly rawX = new Float32Array(MAX_RAW_POINTS);
  private readonly rawY = new Float32Array(MAX_RAW_POINTS);
  private rawCount = 0;

  private ball!: Phaser.GameObjects.Arc;
  private traceGfx!: Phaser.GameObjects.Graphics;
  private outcomeText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  private path: Point[] = [];
  private shot: ShotResult | null = null;
  private traveled = 0;

  private readonly ballStart: Point = { x: 360, y: 940 };

  private readonly world: ShotWorld = {
    defenders: [
      { id: 'zagueiro-1', position: { x: 200, y: 500 }, interceptRadius: 40 },
      { id: 'zagueiro-2', position: { x: 520, y: 500 }, interceptRadius: 40 },
    ],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.55, radius: 85 },
    },
    speed: BALL_SPEED,
  };

  constructor() {
    super('play');
  }

  create(): void {
    this.drawField();
    this.drawActors();

    this.traceGfx = this.add.graphics();
    this.ball = this.add.circle(this.ballStart.x, this.ballStart.y, 12, 0xffffff);
    this.ball.setStrokeStyle(2, 0x222222);

    this.outcomeText = this.add
      .text(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, '', {
        fontSize: '64px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.hintText = this.add
      .text(FIELD_WIDTH / 2, FIELD_HEIGHT - 60, 'Desenhe o chute a partir da bola', {
        fontSize: '28px',
        color: '#d0f0d0',
      })
      .setOrigin(0.5);

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);

    window.__IDOL_E2E__ = { ready: true, shots: 0, lastOutcome: null };
  }

  private drawField(): void {
    const g = this.add.graphics();
    // gramado com faixas
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 === 0 ? 0x2e7d32 : 0x1b5e20);
      g.fillRect(0, i * (FIELD_HEIGHT / 8), FIELD_WIDTH, FIELD_HEIGHT / 8);
    }
    // linha de gol e boca do gol
    g.lineStyle(4, 0xffffff, 0.9);
    g.lineBetween(0, GOAL_LINE_Y, FIELD_WIDTH, GOAL_LINE_Y);
    g.fillStyle(0xeeeeee, 0.9);
    g.fillRect(GOAL_MOUTH_X_MIN, GOAL_LINE_Y - 34, GOAL_MOUTH_X_MAX - GOAL_MOUTH_X_MIN, 34);
    g.fillStyle(0x111111, 1);
    g.fillRect(GOAL_MOUTH_X_MIN, GOAL_LINE_Y - 30, GOAL_MOUTH_X_MAX - GOAL_MOUTH_X_MIN, 26);
    // grande área e círculo central (decorativos)
    g.lineStyle(3, 0xffffff, 0.5);
    g.strokeRect(160, GOAL_LINE_Y, 400, 220);
    g.strokeCircle(FIELD_WIDTH / 2, 900, 100);
  }

  private drawActors(): void {
    // herói (azul) atrás da bola
    this.add
      .circle(this.ballStart.x, this.ballStart.y + 40, 18, 0x1976d2)
      .setStrokeStyle(2, 0x0a3a6a);

    // defensores (vermelho) com raio de interceptação visível
    const g = this.add.graphics();
    for (const d of this.world.defenders) {
      g.fillStyle(0xff5252, 0.12);
      g.fillCircle(d.position.x, d.position.y, d.interceptRadius);
      g.lineStyle(2, 0xff5252, 0.4);
      g.strokeCircle(d.position.x, d.position.y, d.interceptRadius);
      this.add.circle(d.position.x, d.position.y, 16, 0xc62828).setStrokeStyle(2, 0x5c0e0e);
    }

    // goleiro (amarelo) com arco de defesa
    const gk = this.world.goalkeeper;
    if (gk) {
      g.fillStyle(0xffee58, 0.15);
      g.slice(
        gk.position.x,
        gk.position.y,
        gk.arc.radius,
        gk.arc.centerAngle - gk.arc.halfAngle,
        gk.arc.centerAngle + gk.arc.halfAngle,
      );
      g.fillPath();
      this.add.circle(gk.position.x, gk.position.y, 16, 0xf9a825).setStrokeStyle(2, 0x6d4c00);
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.state === 'result') {
      this.reset();
      return;
    }
    if (this.state !== 'aiming') return;
    const dx = pointer.worldX - this.ball.x;
    const dy = pointer.worldY - this.ball.y;
    if (dx * dx + dy * dy > TRACE_START_RADIUS * TRACE_START_RADIUS) return;

    this.state = 'tracing';
    this.rawCount = 0;
    this.pushRawPoint(this.ball.x, this.ball.y);
    this.pushRawPoint(pointer.worldX, pointer.worldY);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.state !== 'tracing') return;
    this.pushRawPoint(pointer.worldX, pointer.worldY);
    this.redrawTrace();
  }

  private onPointerUp(): void {
    if (this.state !== 'tracing') return;

    const raw: Point[] = new Array(this.rawCount);
    for (let i = 0; i < this.rawCount; i++) {
      raw[i] = { x: this.rawX[i] as number, y: this.rawY[i] as number };
    }

    const trajectory = buildTrajectory(raw, DEFAULT_TRAJECTORY_OPTIONS);
    if (trajectory.length < 2 || this.traceLength() < MIN_TRACE_LENGTH) {
      this.state = 'aiming';
      this.traceGfx.clear();
      return;
    }

    // Resultado decidido AQUI, deterministicamente — a animação só reproduz.
    this.shot = simulateShot(trajectory, this.world);
    this.path = trajectory;
    this.traveled = 0;
    this.state = 'moving';
    this.hintText.setVisible(false);
  }

  private pushRawPoint(x: number, y: number): void {
    if (this.rawCount >= MAX_RAW_POINTS) return;
    if (this.rawCount > 0) {
      const dx = x - (this.rawX[this.rawCount - 1] as number);
      const dy = y - (this.rawY[this.rawCount - 1] as number);
      if (dx * dx + dy * dy < MIN_POINT_DISTANCE * MIN_POINT_DISTANCE) return;
    }
    this.rawX[this.rawCount] = x;
    this.rawY[this.rawCount] = y;
    this.rawCount++;
  }

  private traceLength(): number {
    let total = 0;
    for (let i = 1; i < this.rawCount; i++) {
      total += Math.hypot(
        (this.rawX[i] as number) - (this.rawX[i - 1] as number),
        (this.rawY[i] as number) - (this.rawY[i - 1] as number),
      );
    }
    return total;
  }

  private redrawTrace(): void {
    const g = this.traceGfx;
    g.clear();
    g.lineStyle(6, 0xffffff, 0.7);
    g.beginPath();
    g.moveTo(this.rawX[0] as number, this.rawY[0] as number);
    for (let i = 1; i < this.rawCount; i++) {
      g.lineTo(this.rawX[i] as number, this.rawY[i] as number);
    }
    g.strokePath();
  }

  override update(_time: number, delta: number): void {
    if (this.state !== 'moving' || !this.shot) return;

    this.traveled += (BALL_SPEED * delta) / 1000;
    const spacing = DEFAULT_TRAJECTORY_OPTIONS.spacing;
    const index = Math.min(Math.floor(this.traveled / spacing), this.shot.index);
    const p = this.path[index] as Point;
    this.ball.setPosition(p.x, p.y);

    if (index >= this.shot.index) {
      this.ball.setPosition(this.shot.position.x, this.shot.position.y);
      this.finishShot();
    }
  }

  private finishShot(): void {
    const shot = this.shot as ShotResult;
    this.state = 'result';
    this.outcomeText.setText(OUTCOME_LABEL[shot.outcome]);
    this.outcomeText.setColor(shot.outcome === 'goal' ? '#ffd740' : '#ffffff');

    const hook = window.__IDOL_E2E__;
    if (hook) {
      hook.shots += 1;
      hook.lastOutcome = shot.outcome;
    }
  }

  private reset(): void {
    this.state = 'aiming';
    this.shot = null;
    this.path = [];
    this.rawCount = 0;
    this.traveled = 0;
    this.traceGfx.clear();
    this.outcomeText.setText('');
    this.hintText.setVisible(true);
    this.ball.setPosition(this.ballStart.x, this.ballStart.y);
  }
}
