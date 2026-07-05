import Phaser from 'phaser';
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  GOAL_LINE_Y,
  GOAL_MOUTH_X_MAX,
  GOAL_MOUTH_X_MIN,
  PASS_RECEIVE_RADIUS,
} from '@idol/shared';
import { editorStore, type Selection } from '../state/editorStore.js';

/**
 * Cena de edição: renderiza o draft do EditorStore e traduz gestos em ações
 * do store (selecionar/arrastar em 'move'; criar ator/waypoint nos demais
 * modos). Toda a verdade está no store — a cena é 100% derivada.
 */
export class EditScene extends Phaser.Scene {
  private gfx!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private dragging = false;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    super('edit');
  }

  create(): void {
    this.gfx = this.add.graphics();

    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onDown, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onMove, this);
    this.input.on(Phaser.Input.Events.POINTER_UP, () => (this.dragging = false));

    this.unsubscribe = editorStore.subscribe(() => this.redraw());
    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });
    this.redraw();
  }

  private onDown(pointer: Phaser.Input.Pointer): void {
    const p = { x: pointer.worldX, y: pointer.worldY };
    const mode = editorStore.mode;

    if (mode === 'add-defender') {
      editorStore.select({ kind: 'defender', id: editorStore.addDefender(p) });
      editorStore.setMode('move');
      return;
    }
    if (mode === 'add-teammate') {
      editorStore.select({ kind: 'teammate', id: editorStore.addTeammate(p) });
      editorStore.setMode('move');
      return;
    }
    if (mode === 'add-dribble') {
      editorStore.select({ kind: 'dribble', id: editorStore.addDribbleOpportunity(p) });
      editorStore.setMode('move');
      return;
    }
    if (mode === 'route') {
      editorStore.addWaypointToSelected(p);
      return;
    }

    const picked = editorStore.pick(p);
    editorStore.select(picked);
    this.dragging = picked !== null;
  }

  private onMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging || !pointer.isDown || editorStore.mode !== 'move') return;
    editorStore.moveSelected({
      x: Phaser.Math.Clamp(pointer.worldX, 0, FIELD_WIDTH),
      y: Phaser.Math.Clamp(pointer.worldY, 0, FIELD_HEIGHT),
    });
  }

  private isSelected(kind: Selection['kind'], id: string | null): boolean {
    const sel = editorStore.selection;
    return sel !== null && sel.kind === kind && sel.id === id;
  }

  private redraw(): void {
    const d = editorStore.draft;
    const g = this.gfx;
    g.clear();
    for (const label of this.labels) label.destroy();
    this.labels = [];

    // campo
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 === 0 ? 0x2e7d32 : 0x1b5e20);
      g.fillRect(0, i * (FIELD_HEIGHT / 8), FIELD_WIDTH, FIELD_HEIGHT / 8);
    }
    g.lineStyle(4, 0xffffff, 0.9);
    g.lineBetween(0, GOAL_LINE_Y, FIELD_WIDTH, GOAL_LINE_Y);
    g.fillStyle(0x111111, 1);
    g.fillRect(GOAL_MOUTH_X_MIN, GOAL_LINE_Y - 30, GOAL_MOUTH_X_MAX - GOAL_MOUTH_X_MIN, 26);

    const ring = (x: number, y: number, selected: boolean): void => {
      if (selected) {
        g.lineStyle(3, 0xffffff, 1);
        g.strokeCircle(x, y, 26);
      }
    };

    // goleiro + arco
    const gk = d.goalkeeper;
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
    ring(gk.position.x, gk.position.y, this.isSelected('goalkeeper', null));

    // defensores (raio + rota)
    for (const def of d.defenders) {
      g.fillStyle(0xff5252, 0.12);
      g.fillCircle(def.position.x, def.position.y, def.interceptRadius);
      g.lineStyle(2, 0xff5252, 0.4);
      g.strokeCircle(def.position.x, def.position.y, def.interceptRadius);
      this.drawRoute(def.route, 0xff8a80);
      g.fillStyle(0xc62828, 1);
      g.fillCircle(def.position.x, def.position.y, 16);
      ring(def.position.x, def.position.y, this.isSelected('defender', def.id));
    }

    // companheiros (raio de recepção + rota)
    for (const tm of d.teammates) {
      g.lineStyle(2, 0x64b5f6, 0.5);
      g.strokeCircle(tm.position.x, tm.position.y, PASS_RECEIVE_RADIUS);
      this.drawRoute(tm.route, 0x80d8ff);
      g.fillStyle(0x1565c0, 1);
      g.fillCircle(tm.position.x, tm.position.y, 16);
      ring(tm.position.x, tm.position.y, this.isSelected('teammate', tm.id));
    }

    // oportunidades de drible
    for (const op of d.dribbleOpportunities) {
      g.lineStyle(2, 0xffd740, 0.8);
      g.strokeCircle(op.position.x, op.position.y, op.radius);
      const txt = this.add
        .text(op.position.x, op.position.y, '⚡', { fontSize: '26px' })
        .setOrigin(0.5);
      this.labels.push(txt);
      ring(op.position.x, op.position.y, this.isSelected('dribble', op.id));
    }

    // herói e bola
    g.fillStyle(0x1976d2, 1);
    g.fillCircle(d.hero.position.x, d.hero.position.y, 18);
    ring(d.hero.position.x, d.hero.position.y, this.isSelected('hero', null));
    g.fillStyle(0xffffff, 1);
    g.fillCircle(d.ball.x, d.ball.y, 12);
    ring(d.ball.x, d.ball.y, this.isSelected('ball', null));
  }

  private drawRoute(
    route: Array<{ x: number; y: number; t: number }> | undefined,
    color: number,
  ): void {
    if (!route || route.length < 2) return;
    const g = this.gfx;
    g.lineStyle(2, color, 0.7);
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1] as { x: number; y: number };
      const b = route[i] as { x: number; y: number };
      g.lineBetween(a.x, a.y, b.x, b.y);
    }
    for (const wp of route) {
      g.fillStyle(color, 0.9);
      g.fillCircle(wp.x, wp.y, 5);
    }
  }
}
