import Phaser from 'phaser';
import {
  BALL_SPEED,
  DEFAULT_TRAJECTORY_OPTIONS,
  FIELD_HEIGHT,
  FIELD_WIDTH,
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
import { sound } from '../audio/SoundService.js';
import { platform } from '../platform/PlatformService.js';
import { DribbleClient, type DribbleSessionState } from '../dribble/DribbleClient.js';
import { drawDashedCircle, drawPlayerChip } from '../gfx/draw.js';
import { drawKeeperArc, drawStadium } from '../gfx/stadium.js';
import { ensureGameTextures } from '../gfx/textures.js';
import { makeRoundedButton } from '../gfx/ui.js';
import { heroColor, heroNumber } from './CustomizeScene.js';
import { recordStars } from '../state/progressStore.js';
import { RouletteOverlay } from '../ui/RouletteOverlay.js';
import '../e2eHook.js';

/** Dicas de onboarding dos níveis-tutorial (1–5). */
const TUTORIAL_HINTS: Record<number, string> = {
  1: 'Arraste o dedo da bola até o gol para chutar',
  2: 'O goleiro cobre o centro — mire nos cantos',
  3: 'Curve o traço para desviar do zagueiro',
  4: 'Passe pelo corredor e curve para o canto no fim',
  5: 'Pare a bola no companheiro para dar um passe',
};

/** Fator de câmera lenta na reta final de um gol. */
const SLOWMO_SCALE = 0.35;
const SLOWMO_DISTANCE = 160;

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

  private ball!: Phaser.GameObjects.Image;
  private ballShadow!: Phaser.GameObjects.Ellipse;
  private traceGfx!: Phaser.GameObjects.Graphics;
  private actorGfx!: Phaser.GameObjects.Graphics;
  private banner!: Phaser.GameObjects.Text;
  private subBanner!: Phaser.GameObjects.Text;
  private hud!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private rewindButton!: Phaser.GameObjects.Container;
  private dribbleButton!: Phaser.GameObjects.Container;

  private touch: TouchOutcome | null = null;
  private traveled = 0;

  private dribbleClient!: DribbleClient;
  private roulette!: RouletteOverlay;
  /** pity/cadeia da sessão do nível (o servidor é a fonte oficial no M4). */
  private dribbleState: DribbleSessionState = { pity: 0, chain: 0 };

  private trail!: Phaser.GameObjects.Particles.ParticleEmitter;
  private demoDot: Phaser.GameObjects.Arc | null = null;
  private slowmoActive = false;

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

    // herói (ficha com a camisa customizada + número)
    const heroGfx = this.add.graphics().setDepth(2);
    drawPlayerChip(heroGfx, this.script.hero.position.x, this.script.hero.position.y, 18, {
      base: heroColor(),
    });
    this.add
      .text(this.script.hero.position.x, this.script.hero.position.y, String(heroNumber()), {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(3);

    // bola com gomos + sombra própria (gira ao rolar)
    this.ballShadow = this.add
      .ellipse(this.script.ball.x + 3, this.script.ball.y + 7, 22, 10, 0x000000, 0.3)
      .setDepth(3);
    this.ball = this.add.image(this.script.ball.x, this.script.ball.y, 'ball').setDepth(4);

    this.trail = this.add.particles(0, 0, 'spark', {
      speed: 12,
      scale: { start: 0.7, end: 0 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 320,
      frequency: 24,
      follow: this.ball,
      emitting: false,
    });

    this.hud = this.add
      .text(20, 14, '', {
        fontSize: '25px',
        color: '#ffffff',
        backgroundColor: 'rgba(10,14,18,0.45)',
        padding: { x: 12, y: 8 },
      })
      .setDepth(10);
    this.banner = this.add
      .text(FIELD_WIDTH / 2, FIELD_HEIGHT / 2 - 60, '', {
        fontSize: '62px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 10,
        align: 'center',
        shadow: { offsetY: 5, color: '#000000', blur: 10, fill: true },
      })
      .setOrigin(0.5)
      .setDepth(10);
    this.subBanner = this.add
      .text(FIELD_WIDTH / 2, FIELD_HEIGHT / 2 + 24, '', {
        fontSize: '30px',
        color: '#ffe082',
        stroke: '#000000',
        strokeThickness: 5,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.hintText = this.add
      .text(FIELD_WIDTH / 2, FIELD_HEIGHT - 130, '', {
        fontSize: '26px',
        color: '#d0f0d0',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
        wordWrap: { width: FIELD_WIDTH - 80 },
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.rewindButton = this.makeButton(120, FIELD_HEIGHT - 56, '◀ REWIND', () => this.onRewind());
    this.makeButton(FIELD_WIDTH - 110, 40, 'CARREIRA', () => this.scene.start('meta'));
    this.makeButton(FIELD_WIDTH - 110, 116, '🗺 MAPA', () => {
      window.location.href = window.location.pathname; // limpa query/hash → mapa
    });

    // onboarding: dica do tutorial (níveis 1–5) + demo animada no primeiro acesso
    const hint = TUTORIAL_HINTS[this.levelOrdinal];
    if (hint) this.hintText.setText(hint);
    if (this.levelOrdinal === 1 && !window.localStorage.getItem('idol:onboarded')) {
      this.startDemo();
    }
    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      sound.unlock();
      window.localStorage.setItem('idol:onboarded', '1');
      this.stopDemo();
    });
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

  /** Demo do onboarding: um dedo-fantasma desenha o traço da bola ao gol. */
  private startDemo(): void {
    this.demoDot = this.add
      .circle(this.script.ball.x, this.script.ball.y, 14, 0xffffff, 0.65)
      .setDepth(15);
    const path: Array<[number, number]> = [
      [this.script.ball.x, this.script.ball.y],
      [330, 700],
      [300, 400],
      [280, 120],
    ];
    const runDemo = (): void => {
      if (!this.demoDot) return;
      this.demoDot.setPosition(path[0]?.[0] ?? 0, path[0]?.[1] ?? 0);
      const chain = this.tweens.chain({
        targets: this.demoDot,
        tweens: path.slice(1).map(([x, y]) => ({ x, y, duration: 500, ease: 'Sine.easeInOut' })),
        onComplete: () => {
          this.time.delayedCall(600, runDemo);
        },
      });
      void chain;
    };
    runDemo();
  }

  private stopDemo(): void {
    this.demoDot?.destroy();
    this.demoDot = null;
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
        sound.fail();
        platform.vibrate('error'); // haptics: falha
        platform.vibrate('error'); // haptics: falha
        this.cameras.main.shake(180, 0.006);
        this.banner.setText(FAIL_LABEL['dribble'] as string).setColor('#ff8a80');
        this.subBanner.setText('Use o REWIND para tentar de novo');
        this.state = 'between';
      } else {
        if (spin.outcome === 'perfect') {
          sound.perfect();
          platform.vibrate('light'); // haptics: drible perfeito
        }
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
    ensureGameTextures(this);
    drawStadium(this);

    // goleiro é estático: arco em degradê + ficha, desenhados uma vez
    const g = this.add.graphics();
    const gk = this.script.goalkeeper;
    drawKeeperArc(
      g,
      gk.position.x,
      gk.position.y,
      gk.arc.radius,
      gk.arc.centerAngle,
      gk.arc.halfAngle,
    );
    drawPlayerChip(g, gk.position.x, gk.position.y, 16, { base: 0xf9a825 });

    // oportunidades de drible: anel dourado pulsante (informação de nível)
    for (const op of this.script.dribbleOpportunities) {
      const ring = this.add.graphics().setDepth(1);
      drawDashedCircle(ring, 0, 0, op.radius, 0xffd740, 0.8, 3, 28);
      ring.setPosition(op.position.x, op.position.y);
      const bolt = this.add
        .text(op.position.x, op.position.y, '⚡', { fontSize: '30px' })
        .setOrigin(0.5)
        .setAlpha(0.85)
        .setDepth(1);
      this.tweens.add({
        targets: [ring, bolt],
        alpha: 0.35,
        scale: 0.92,
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  /** Redesenha defensores e companheiros nas posições do instante `time`. */
  private renderActors(time: number): void {
    const g = this.actorGfx;
    g.clear();

    for (const d of this.script.defenders) {
      const pos = positionOnRoute(d.route, time, d.position);
      g.fillStyle(0xef5350, 0.09);
      g.fillCircle(pos.x, pos.y, d.interceptRadius);
      drawDashedCircle(g, pos.x, pos.y, d.interceptRadius, 0xef5350, 0.55, 2, 28);
      drawPlayerChip(g, pos.x, pos.y, 16, { base: 0xc62828 });
    }

    for (const t of this.script.teammates) {
      const pos = positionOnRoute(t.route, time, t.position);
      g.fillStyle(0x64b5f6, 0.06);
      g.fillCircle(pos.x, pos.y, PASS_RECEIVE_RADIUS);
      drawDashedCircle(g, pos.x, pos.y, PASS_RECEIVE_RADIUS, 0x64b5f6, 0.5, 2, 28);
      drawPlayerChip(g, pos.x, pos.y, 16, { base: 0x1565c0 });
    }
  }

  /** Reposiciona bola + sombra juntas (única forma de mover a bola). */
  private placeBall(x: number, y: number): void {
    this.ball.setPosition(x, y);
    this.ballShadow.setPosition(x + 3, y + 7);
  }

  private makeButton(
    cx: number,
    cy: number,
    label: string,
    onTap: () => void,
  ): Phaser.GameObjects.Container {
    // mesma área de toque de sempre (200×64); visual arredondado no gfx/ui
    return makeRoundedButton(this, cx, cy, 200, 64, label, onTap);
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
    this.slowmoActive = false;
    this.trail.start();
    sound.kick();
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
    this.placeBall(s.ball.x, s.ball.y);
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
    if (this.rawCount < 2) return;

    // passe duplo: halo largo translúcido + linha nítida por cima
    for (const [width, alpha] of [
      [16, 0.14],
      [6, 0.85],
    ] as Array<[number, number]>) {
      g.lineStyle(width, 0xffffff, alpha);
      g.beginPath();
      g.moveTo(this.rawX[0] as number, this.rawY[0] as number);
      for (let i = 1; i < this.rawCount; i++) {
        g.lineTo(this.rawX[i] as number, this.rawY[i] as number);
      }
      g.strokePath();
    }

    // seta na ponta, orientada pelo último segmento
    const n = this.rawCount;
    const tx = this.rawX[n - 1] as number;
    const ty = this.rawY[n - 1] as number;
    const angle = Math.atan2(ty - (this.rawY[n - 2] as number), tx - (this.rawX[n - 2] as number));
    const size = 16;
    g.fillStyle(0xffffff, 0.9);
    g.beginPath();
    g.moveTo(tx + Math.cos(angle) * size, ty + Math.sin(angle) * size);
    g.lineTo(tx + Math.cos(angle + 2.5) * size, ty + Math.sin(angle + 2.5) * size);
    g.lineTo(tx + Math.cos(angle - 2.5) * size, ty + Math.sin(angle - 2.5) * size);
    g.closePath();
    g.fillPath();
  }

  // -------------------------------------------------------------- animação

  override update(_time: number, delta: number): void {
    if (this.state !== 'animating' || !this.touch) return;

    // câmera lenta na reta final de um gol (game feel)
    const spacing = DEFAULT_TRAJECTORY_OPTIONS.spacing;
    const remaining = this.touch.shot.index * spacing - this.traveled;
    const isGoalFinish = this.touch.shot.outcome === 'goal' && remaining < SLOWMO_DISTANCE;
    if (isGoalFinish && !this.slowmoActive) {
      this.slowmoActive = true;
      this.cameras.main.zoomTo(1.12, 180, 'Sine.easeOut');
    }
    const timeScale = this.slowmoActive ? SLOWMO_SCALE : 1;

    const step = (BALL_SPEED * delta * timeScale) / 1000;
    this.traveled += step;
    const index = Math.min(Math.floor(this.traveled / spacing), this.touch.shot.index);
    const p = this.touch.trajectory[index] as Point;
    this.placeBall(p.x, p.y);
    this.ball.rotation += step / 12; // bola gira ao rolar (raio 12)

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
    this.trail.stop();
    if (this.slowmoActive) {
      this.slowmoActive = false;
      this.cameras.main.zoomTo(1, 220, 'Sine.easeIn');
    }
    this.placeBall(state.ball.x, state.ball.y);
    this.renderActors(state.elapsed);
    this.refreshHud();

    if (touch.phase === 'complete') {
      const stars = this.runtime.evaluateStars();
      sound.goal();
      platform.vibrate('success'); // haptics: gol
      this.add
        .particles(state.ball.x, state.ball.y, 'spark', {
          speed: { min: 120, max: 380 },
          scale: { start: 1.2, end: 0 },
          tint: [0xffd740, 0x66bb6a, 0x80d8ff, 0xffffff],
          lifespan: 900,
          quantity: 60,
          emitting: false,
        })
        .explode(60, state.ball.x, state.ball.y);
      recordStars(this.levelOrdinal, stars);
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
      sound.fail();
      this.cameras.main.shake(180, 0.006);
      this.banner.setText(FAIL_LABEL[touch.failReason ?? 'out'] ?? 'FALHOU').setColor('#ff8a80');
      this.subBanner.setText('Use o REWIND para tentar de novo');
      this.state = 'between';
    } else {
      if (touch.passedTo) {
        sound.pass();
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
      hook.shots = (hook.shots ?? 0) + 1;
      hook.lastOutcome = touch.shot.outcome;
    }
    hook.phase = s.phase;
    hook.touches = s.touches;
    hook.passes = s.passes;
    hook.rewinds = s.rewinds;
    hook.stars = this.runtime.evaluateStars();
  }
}
