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
  SEASON1_LEVELS,
  decodeLevelScript,
  getSeason1Level,
  parseLevelScript,
  positionOnRoute,
  type LevelScript,
  type Point,
  type TouchOutcome,
} from '@idol/shared';
import { apiClient } from '../api/ApiClient.js';
import { DribbleClient, type DribbleSessionState } from '../dribble/DribbleClient.js';
import { RouletteOverlay } from '../ui/RouletteOverlay.js';
import '../e2eHook.js';

type SceneState = 'aiming' | 'tracing' | 'animating' | 'roulette' | 'between' | 'ended';

const TRACE_START_RADIUS = 110;
const MIN_POINT_DISTANCE = 4;
const MIN_TRACE_LENGTH = 60;
const MAX_RAW_POINTS = 2048;

const FAIL_LABEL: Record<string, string> = {
  intercepted: 'INTERCEPTADO',
  saved: 'DEFENDEU O GOLEIRO',
  out: 'PRA FORA',
  objective: 'OBJETIVO NÃO CUMPRIDO',
  dribble: 'PERDEU A BOLA NO DRIBLE',
};

/**
 * M2 — LevelScene: interpreta um LevelScript com LevelRuntime (fases de
 * toque: pausa → desenho → simulação). A cena nunca decide regra: anima o
 * TouchOutcome que o runtime (determinístico, em @idol/shared) retornou.
 * Nível vem de ?level=N (1–10 do SEASON1_LEVELS).
 */
export class LevelScene extends Phaser.Scene {
  private state: SceneState = 'aiming';
  private script!: LevelScript;
  private runtime!: LevelRuntime;
  private levelOrdinal = 1;

  private readonly rawX = new Float32Array(MAX_RAW_POINTS);
  private readonly rawY = new Float32Array(MAX_RAW_POINTS);
  private rawCount = 0;

  private ball!: Phaser.GameObjects.Arc;
  private hero!: Phaser.GameObjects.Arc;
  private traceGfx!: Phaser.GameObjects.Graphics;
  private actorGfx!: Phaser.GameObjects.Graphics;
  private banner!: Phaser.GameObjects.Text;
  private subBanner!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private rewindButton!: Phaser.GameObjects.Container;
  private dribbleButton!: Phaser.GameObjects.Container;

  private touch: TouchOutcome | null = null;
  private traveled = 0;

  private dribbleClient!: DribbleClient;
  private roulette!: RouletteOverlay;
  /** pity/cadeia da sessão do nível (o servidor é a fonte oficial no M4). */
  private dribbleState: DribbleSessionState = { pity: 0, chain: 0 };

  constructor() {
    super('level');
  }

  create(): void {
    const params = new URLSearchParams(window.location.search);
    this.script = this.resolveScript(params);
    this.levelOrdinal = this.script.metadata.ordinal;
    this.runtime = new LevelRuntime(this.script);
    this.state = 'aiming';
    this.touch = null;
    this.rawCount = 0;
    this.traveled = 0;

    this.drawField();
    this.actorGfx = this.add.graphics();
    this.traceGfx = this.add.graphics();

    this.hero = this.add
      .circle(this.script.hero.position.x, this.script.hero.position.y, 18, 0x1976d2)
      .setStrokeStyle(2, 0x0a3a6a);
    this.ball = this.add.circle(this.script.ball.x, this.script.ball.y, 12, 0xffffff);
    this.ball.setStrokeStyle(2, 0x222222);

    this.hud = this.add.text(20, 14, '', { fontSize: '26px', color: '#ffffff' }).setDepth(10);
    this.banner = this.add
      .text(FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 60, '', {
        fontSize: '60px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.subBanner = this.add
      .text(FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 20, '', {
        fontSize: '30px',
        color: '#ffe082',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.rewindButton = this.makeButton(120, FIELD_HEIGHT - 56, '◀ REWIND', () => this.onRewind());
    this.makeButton(FIELD_WIDTH - 110, 40, 'CARREIRA', () => this.scene.start('meta'));
    this.dribbleButton = this.makeButton(
      FIELD_WIDTH - 120,
      FIELD_HEIGHT - 56,
      '⚡ DRIBLAR',
      () => void this.onDribble(),
    );
    this.dribbleButton.setVisible(false);

    const seedParam = params.get('seed');
    this.dribbleClient = new DribbleClient({
      ...(seedParam ? { seed: Number(seedParam) } : {}),
      ...(import.meta.env['VITE_API_URL']
        ? { apiUrl: import.meta.env['VITE_API_URL'] as string }
        : {}),
      ...(params.get('user') ? { userId: params.get('user') as string } : {}),
    });
    this.roulette = new RouletteOverlay(this);
    this.dribbleState = { pity: 0, chain: 0 };

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, this.onPointerUp, this);

    this.renderActors(this.runtime.getState().elapsed);
    this.refreshHud();

    window.__IDOL_E2E__ = {
      ready: true,
      shots: 0,
      lastOutcome: null,
      level: this.levelOrdinal,
      phase: 'ready',
      touches: 0,
      passes: 0,
      rewinds: 0,
      stars: 0,
      dribbleAvailable: false,
      lastDribble: null,
      perfectDribbles: 0,
      dribbleChain: 0,
    };
    this.updateDribbleButton();
  }

  /**
   * Nível a carregar: `?level=custom` joga um nível vindo do EDITOR — payload
   * base64url no hash da URL (ou localStorage 'idol:custom-level'), sempre
   * validado pelo schema compartilhado. Senão, ?level=N da temporada 1.
   */
  private resolveScript(params: URLSearchParams): LevelScript {
    if (params.get('level') === 'custom') {
      try {
        const hash = window.location.hash.replace(/^#/, '');
        if (hash) return decodeLevelScript(hash);
        const stored = window.localStorage.getItem('idol:custom-level');
        if (stored) return parseLevelScript(JSON.parse(stored));
      } catch {
        // payload inválido → cai para o nível 1
      }
    }
    const ordinal = Math.max(1, Number(params.get('level') ?? '1') || 1);
    return getSeason1Level(ordinal) ?? (SEASON1_LEVELS[0] as LevelScript);
  }

  /** Mostra o DRIBLAR apenas quando há oportunidade acionável. */
  private updateDribbleButton(): void {
    const available = this.state === 'aiming' && this.runtime.availableDribble() !== null;
    this.dribbleButton.setVisible(available);
    const hook = window.__IDOL_E2E__;
    if (hook) hook.dribbleAvailable = available;
  }

  private async onDribble(): Promise<void> {
    if (this.state !== 'aiming') return;
    const op = this.runtime.availableDribble();
    if (!op) return;

    this.state = 'roulette';
    this.dribbleButton.setVisible(false);

    const spin = await this.dribbleClient.spin(op.defense, this.dribbleState);
    this.dribbleState = { pity: spin.pityAfter, chain: spin.chainAfter };
    // regra aplicada ANTES da animação — a roleta visual só reproduz o sorteio
    this.runtime.applyDribbleOutcome(op.id, spin.outcome);

    this.roulette.show(spin, () => {
      const s = this.runtime.getState();
      if (s.phase === 'failed') {
        this.banner.setText(FAIL_LABEL['dribble'] as string).setColor('#ff8a80');
        this.subBanner.setText('Use o REWIND para tentar de novo');
        this.state = 'between';
      } else {
        if (spin.fans > 0) {
          this.banner
            .setText(spin.outcome === 'perfect' ? 'PERFEITO!' : 'DRIBLOU!')
            .setColor(spin.outcome === 'perfect' ? '#ffd740' : '#80d8ff');
          this.subBanner.setText(`+${spin.fans} fãs`);
          this.time.delayedCall(900, () => {
            if (this.state === 'aiming') {
              this.banner.setText('');
              this.subBanner.setText('');
            }
          });
        }
        this.state = 'aiming';
      }
      this.refreshHud();
      this.updateDribbleButton();
      const hook = window.__IDOL_E2E__;
      if (hook) {
        hook.lastDribble = spin.outcome;
        hook.perfectDribbles = s.perfectDribbles;
        hook.dribbleChain = this.dribbleState.chain;
        hook.phase = s.phase;
      }
    });
  }

  // ---------------------------------------------------------------- desenho

  private drawField(): void {
    const g = this.add.graphics();
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 === 0 ? 0x2e7d32 : 0x1b5e20);
      g.fillRect(0, i * (FIELD_HEIGHT / 8), FIELD_WIDTH, FIELD_HEIGHT / 8);
    }
    g.lineStyle(4, 0xffffff, 0.9);
    g.lineBetween(0, GOAL_LINE_Y, FIELD_WIDTH, GOAL_LINE_Y);
    g.fillStyle(0xeeeeee, 0.9);
    g.fillRect(GOAL_MOUTH_X_MIN, GOAL_LINE_Y - 34, GOAL_MOUTH_X_MAX - GOAL_MOUTH_X_MIN, 34);
    g.fillStyle(0x111111, 1);
    g.fillRect(GOAL_MOUTH_X_MIN, GOAL_LINE_Y - 30, GOAL_MOUTH_X_MAX - GOAL_MOUTH_X_MIN, 26);
    g.lineStyle(3, 0xffffff, 0.5);
    g.strokeRect(160, GOAL_LINE_Y, 400, 220);
    g.strokeCircle(FIELD_WIDTH / 2, 900, 100);

    // goleiro é estático: desenha uma vez
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
    this.add.circle(gk.position.x, gk.position.y, 16, 0xf9a825).setStrokeStyle(2, 0x6d4c00);
  }

  /** Redesenha defensores e companheiros nas posições do instante `time`. */
  private renderActors(time: number): void {
    const g = this.actorGfx;
    g.clear();

    for (const d of this.script.defenders) {
      const pos = positionOnRoute(d.route, time, d.position);
      g.fillStyle(0xff5252, 0.12);
      g.fillCircle(pos.x, pos.y, d.interceptRadius);
      g.lineStyle(2, 0xff5252, 0.4);
      g.strokeCircle(pos.x, pos.y, d.interceptRadius);
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

  private makeButton(
    cx: number,
    cy: number,
    label: string,
    onTap: () => void,
  ): Phaser.GameObjects.Container {
    const w = 200;
    const h = 64; // alvo de toque ≥ 44px
    const bg = this.add.rectangle(0, 0, w, h, 0x263238, 0.85).setStrokeStyle(2, 0xffffff, 0.5);
    const txt = this.add.text(0, 0, label, { fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
    const c = this.add.container(cx, cy, [bg, txt]).setDepth(20).setSize(w, h);
    c.setInteractive(
      new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
      Phaser.Geom.Rectangle.Contains,
    );
    c.on(
      Phaser.Input.Events.POINTER_DOWN,
      (
        pointer: Phaser.Input.Pointer,
        _x: number,
        _y: number,
        event: Phaser.Types.Input.EventData,
      ) => {
        event.stopPropagation();
        onTap();
      },
    );
    return c;
  }

  // ------------------------------------------------------------------ input

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.state === 'ended') {
      const next = getSeason1Level(this.levelOrdinal + 1);
      const target = next ? this.levelOrdinal + 1 : 1;
      window.location.search = `level=${target}`;
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

    if (this.rawCount < 2 || this.traceLength() < MIN_TRACE_LENGTH) {
      this.state = 'aiming';
      this.traceGfx.clear();
      return;
    }

    const raw: Point[] = new Array(this.rawCount);
    for (let i = 0; i < this.rawCount; i++) {
      raw[i] = { x: this.rawX[i] as number, y: this.rawY[i] as number };
    }

    // Regras decididas pelo runtime; a cena só anima o resultado.
    this.touch = this.runtime.executeTrace(raw);
    this.traveled = 0;
    this.state = 'animating';
  }

  private onRewind(): void {
    if (this.state === 'animating' || this.state === 'tracing') return;
    if (!this.runtime.rewind()) return;
    this.state = 'aiming';
    this.touch = null;
    this.traceGfx.clear();
    this.banner.setText('');
    this.subBanner.setText('');
    const s = this.runtime.getState();
    this.ball.setPosition(s.ball.x, s.ball.y);
    this.renderActors(s.elapsed);
    this.refreshHud();
    this.updateDribbleButton();
    this.syncHook();
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

  // -------------------------------------------------------------- animação

  override update(_time: number, delta: number): void {
    if (this.state !== 'animating' || !this.touch) return;

    this.traveled += (BALL_SPEED * delta) / 1000;
    const spacing = DEFAULT_TRAJECTORY_OPTIONS.spacing;
    const index = Math.min(Math.floor(this.traveled / spacing), this.touch.shot.index);
    const p = this.touch.trajectory[index] as Point;
    this.ball.setPosition(p.x, p.y);

    // atores seguem suas rotas em sincronia com a bola
    this.renderActors(this.touch.startElapsed + this.traveled / BALL_SPEED);

    if (index >= this.touch.shot.index) {
      this.finishTouch();
    }
  }

  private finishTouch(): void {
    const touch = this.touch as TouchOutcome;
    const state = this.runtime.getState();
    this.traceGfx.clear();
    this.ball.setPosition(state.ball.x, state.ball.y);
    this.renderActors(state.elapsed);
    this.refreshHud();

    if (touch.phase === 'complete') {
      const stars = this.runtime.evaluateStars();
      this.banner.setText('GOL!').setColor('#ffd740');
      this.subBanner.setText(
        `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}\nToque para o próximo nível`,
      );
      this.state = 'ended';
      // fãs por desempenho: avaliação = estrelas/3 (best effort; API pode estar off)
      if (apiClient.available) {
        void apiClient
          .ensureSession()
          .then((ok) => (ok ? apiClient.completeMatch(stars / 3) : null));
      }
    } else if (touch.phase === 'failed') {
      this.banner.setText(FAIL_LABEL[touch.failReason ?? 'out'] ?? 'FALHOU').setColor('#ff8a80');
      this.subBanner.setText('Use o REWIND para tentar de novo');
      this.state = 'between';
    } else {
      if (touch.passedTo) {
        this.banner.setText('PASSE!').setColor('#80d8ff');
        this.time.delayedCall(600, () => {
          if (this.state === 'aiming') this.banner.setText('');
        });
      }
      this.state = 'aiming';
    }

    this.updateDribbleButton();
    this.syncHook(touch);
  }

  private refreshHud(): void {
    const s = this.runtime.getState();
    const obj = this.script.objective;
    const objText =
      obj.type === 'goal_after_passes'
        ? ` · Passes: ${s.passes}/${obj.minPasses}`
        : obj.type === 'goal_with_dribble'
          ? ` · Dribles: 0/${obj.minDribbles}`
          : '';
    this.hud.setText(
      `Nível ${this.levelOrdinal} — ${this.script.metadata.name}\nToques: ${s.touches}${objText}`,
    );
  }

  private syncHook(touch?: TouchOutcome): void {
    const hook = window.__IDOL_E2E__;
    if (!hook) return;
    const s = this.runtime.getState();
    if (touch) {
      hook.shots += 1;
      hook.lastOutcome = touch.shot.outcome;
    }
    hook.phase = s.phase;
    hook.touches = s.touches;
    hook.passes = s.passes;
    hook.rewinds = s.rewinds;
    hook.stars = this.runtime.evaluateStars();
  }
}
