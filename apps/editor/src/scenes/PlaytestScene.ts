import Phaser from 'phaser';
import {
  BALL_SPEED,
  DEFAULT_TRAJECTORY_OPTIONS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_LINE_Y,
  GOAL_MOUTH_X_MAX,
  GOAL_MOUTH_X_MIN,
  LevelRuntime,
  PASS_RECEIVE_RADIUS,
  parseLevelScript,
  positionOnRoute,
  type LevelScript,
  type Point,
  type TouchOutcome,
} from '@idol/shared';
import { editorStore } from '../state/editorStore.js';

const FAIL_LABEL: Record<string, string> = {
  intercepted: 'INTERCEPTADO',
  saved: 'DEFENDEU O GOLEIRO',
  out: 'PRA FORA',
  objective: 'OBJETIVO NÃO CUMPRIDO',
  dribble: 'PERDEU NO DRIBLE',
};

/**
 * Playtest in-place: joga o draft com o MESMO LevelRuntime do game.
 * Sem roleta aqui (o sorteio é do servidor) — oportunidades aparecem como
 * marcadores; passes, objetivos, estrelas e rewind funcionam de verdade.
 */
export class PlaytestScene extends Phaser.Scene {
  private runtime!: LevelRuntime;
  private script!: LevelScript;
  private state: 'aiming' | 'tracing' | 'animating' | 'done' = 'aiming';

  private raw: Point[] = [];
  private ball!: Phaser.GameObjects.Arc;
  private gfx!: Phaser.GameObjects.Graphics;
  private traceGfx!: Phaser.GameObjects.Graphics;
  private banner!: Phaser.GameObjects.Text;
  private touch: TouchOutcome | null = null;
  private traveled = 0;

  constructor() {
    super('playtest');
  }

  create(): void {
    this.script = parseLevelScript(editorStore.draft);
    this.runtime = new LevelRuntime(this.script);
    this.state = 'aiming';
    this.touch = null;
    this.raw = [];

    this.drawStatic();
    this.gfx = this.add.graphics();
    this.traceGfx = this.add.graphics();
    this.ball = this.add.circle(this.script.ball.x, this.script.ball.y, 12, 0xffffff);

    this.banner = this.add
      .text(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, '', {
        fontSize: '52px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 7,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);

    const back = this.add
      .rectangle(110, 40, 180, 56, 0x263238, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setDepth(20)
      .setInteractive();
    this.add
      .text(110, 40, '◀ EDITOR', { fontSize: '22px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(21);
    back.on(
      Phaser.Input.Events.POINTER_DOWN,
      (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.scene.start('edit');
      },
    );

    const rewind = this.add
      .rectangle(FIELD_WIDTH - 110, FIELD_HEIGHT - 56, 180, 56, 0x263238, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.5)
      .setDepth(20)
      .setInteractive();
    this.add
      .text(FIELD_WIDTH - 110, FIELD_HEIGHT - 56, '◀ REWIND', { fontSize: '22px', color: '#fff' })
      .setOrigin(0.5)
      .setDepth(21);
    rewind.on(
      Phaser.Input.Events.POINTER_DOWN,
      (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        if (this.state === 'animating') return;
        if (this.runtime.rewind()) {
          this.state = 'aiming';
          this.banner.setText('');
          const s = this.runtime.getState();
          this.ball.setPosition(s.ball.x, s.ball.y);
          this.renderActors(s.elapsed);
        }
      },
    );

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onUp, this);

    this.renderActors(0);
  }

  private drawStatic(): void {
    const g = this.add.graphics();
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 === 0 ? 0x2e7d32 : 0x1b5e20);
      g.fillRect(0, i * (FIELD_HEIGHT / 8), FIELD_WIDTH, FIELD_HEIGHT / 8);
    }
    g.lineStyle(4, 0xffffff, 0.9);
    g.lineBetween(0, GOAL_LINE_Y, FIELD_WIDTH, GOAL_LINE_Y);
    g.fillStyle(0x111111, 1);
    g.fillRect(GOAL_MOUTH_X_MIN, GOAL_LINE_Y - 30, GOAL_MOUTH_X_MAX - GOAL_MOUTH_X_MIN, 26);

    const gk = this.script.goalkeeper;
    g.fillStyle(0xffee58, 0.15);
    g.slice(
      gk.position.x,
      gk.position.y,
      gk.arc.radius,
      gk.arc.centerAngle - gk.arc.halfAngle,
      gk.arc.centerAngle + gk.arc.halfAngle,
    );
    g.fillPath();
    g.fillStyle(0xf9a825, 1);
    g.fillCircle(gk.position.x, gk.position.y, 16);

    for (const op of this.script.dribbleOpportunities) {
      g.lineStyle(2, 0xffd740, 0.6);
      g.strokeCircle(op.position.x, op.position.y, op.radius);
    }
  }

  private renderActors(time: number): void {
    const g = this.gfx;
    g.clear();
    for (const d of this.script.defenders) {
      const pos = positionOnRoute(d.route, time, d.position);
      g.fillStyle(0xff5252, 0.12);
      g.fillCircle(pos.x, pos.y, d.interceptRadius);
      g.fillStyle(0xc62828, 1);
      g.fillCircle(pos.x, pos.y, 16);
    }
    for (const t of this.script.teammates) {
      const pos = positionOnRoute(t.route, time, t.position);
      g.lineStyle(2, 0x64b5f6, 0.5);
      g.strokeCircle(pos.x, pos.y, PASS_RECEIVE_RADIUS);
      g.fillStyle(0x1565c0, 1);
      g.fillCircle(pos.x, pos.y, 16);
    }
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    if (this.state !== 'aiming') return;
    const s = this.runtime.getState();
    if (Math.hypot(pointer.worldX - s.ball.x, pointer.worldY - s.ball.y) > 110) return;
    this.state = 'tracing';
    this.raw = [{ x: s.ball.x, y: s.ball.y }];
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (this.state !== 'tracing') return;
    this.raw.push({ x: pointer.worldX, y: pointer.worldY });
    const g = this.traceGfx;
    g.clear();
    g.lineStyle(6, 0xffffff, 0.7);
    g.beginPath();
    g.moveTo(this.raw[0]?.x ?? 0, this.raw[0]?.y ?? 0);
    for (const p of this.raw) g.lineTo(p.x, p.y);
    g.strokePath();
  }

  private onUp(): void {
    if (this.state !== 'tracing') return;
    if (this.raw.length < 3) {
      this.state = 'aiming';
      this.traceGfx.clear();
      return;
    }
    this.touch = this.runtime.executeTrace(this.raw);
    this.traveled = 0;
    this.state = 'animating';
  }

  override update(_t: number, delta: number): void {
    if (this.state !== 'animating' || !this.touch) return;
    this.traveled += (BALL_SPEED * delta) / 1000;
    const idx = Math.min(
      Math.floor(this.traveled / DEFAULT_TRAJECTORY_OPTIONS.spacing),
      this.touch.shot.index,
    );
    const p = this.touch.trajectory[idx] as Point;
    this.ball.setPosition(p.x, p.y);
    this.renderActors(this.touch.startElapsed + this.traveled / BALL_SPEED);

    if (idx >= this.touch.shot.index) {
      const s = this.runtime.getState();
      this.traceGfx.clear();
      this.ball.setPosition(s.ball.x, s.ball.y);
      this.renderActors(s.elapsed);
      if (s.phase === 'complete') {
        const stars = this.runtime.evaluateStars();
        this.banner.setText(`GOL!\n${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`);
        this.state = 'done';
      } else if (s.phase === 'failed') {
        this.banner.setText(FAIL_LABEL[s.failReason ?? 'out'] ?? 'FALHOU');
        this.state = 'done';
      } else {
        if (this.touch.passedTo) this.banner.setText('PASSE!');
        else this.banner.setText('');
        this.state = 'aiming';
      }
      this.touch = null;
    }
  }
}
