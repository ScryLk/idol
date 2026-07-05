import { dist, encodeLevelScript, LevelScript, parseLevelScript, type Point } from '@idol/shared';

/**
 * Estado do editor de níveis — sem framework, observável por listeners.
 * O draft é sempre um LevelScript estrutural; a validação Zod roda no
 * export/import e no playtest (o editor deixa você passar por estados
 * intermediários, mas nunca exporta nível inválido).
 */

export type ActorKind = 'ball' | 'hero' | 'goalkeeper' | 'teammate' | 'defender' | 'dribble';

export interface Selection {
  kind: ActorKind;
  id: string | null;
}

export type EditorMode = 'move' | 'add-defender' | 'add-teammate' | 'add-dribble' | 'route';

/** Velocidade padrão dos atores para o timing automático de waypoints. */
export const ROUTE_SPEED = 150;

function blankLevel(): LevelScript {
  return {
    version: 1,
    metadata: { name: 'Novo Nível', season: 1, ordinal: 99, difficulty: 1 },
    ball: { x: 360, y: 940 },
    hero: { position: { x: 360, y: 990 } },
    teammates: [],
    defenders: [],
    goalkeeper: {
      position: { x: 360, y: 110 },
      arc: { centerAngle: Math.PI / 2, halfAngle: 0.5, radius: 80 },
    },
    objective: { type: 'goal' },
    stars: { two: { maxTouches: 3 }, three: { maxTouches: 2, noRewind: true } },
    dribbleOpportunities: [],
  };
}

export class EditorStore {
  private draftState: LevelScript = blankLevel();
  private selectionState: Selection | null = null;
  private modeState: EditorMode = 'move';
  private listeners = new Set<() => void>();

  get draft(): LevelScript {
    return this.draftState;
  }
  get selection(): Selection | null {
    return this.selectionState;
  }
  get mode(): EditorMode {
    return this.modeState;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private mutate(fn: (draft: LevelScript) => void): void {
    const next = structuredClone(this.draftState);
    fn(next);
    this.draftState = next;
    this.emit();
  }

  reset(): void {
    this.draftState = blankLevel();
    this.selectionState = null;
    this.modeState = 'move';
    this.emit();
  }

  setMode(mode: EditorMode): void {
    this.modeState = mode;
    this.emit();
  }

  select(selection: Selection | null): void {
    this.selectionState = selection;
    this.emit();
  }

  // ------------------------------------------------------------- metadados

  setMetadata(patch: Partial<LevelScript['metadata']>): void {
    this.mutate((d) => Object.assign(d.metadata, patch));
  }

  setObjective(objective: LevelScript['objective']): void {
    this.mutate((d) => {
      d.objective = objective;
    });
  }

  setStars(stars: LevelScript['stars']): void {
    this.mutate((d) => {
      d.stars = stars;
    });
  }

  setGoalkeeperArc(patch: Partial<LevelScript['goalkeeper']['arc']>): void {
    this.mutate((d) => Object.assign(d.goalkeeper.arc, patch));
  }

  // ---------------------------------------------------------------- atores

  addDefender(position: Point): string {
    const id = `zagueiro-${this.draftState.defenders.length + 1}-${Math.floor(position.x)}`;
    this.mutate((d) => {
      d.defenders.push({ id, position: { ...position }, interceptRadius: 45 });
    });
    return id;
  }

  addTeammate(position: Point): string {
    const id = `companheiro-${this.draftState.teammates.length + 1}-${Math.floor(position.x)}`;
    this.mutate((d) => {
      d.teammates.push({ id, position: { ...position } });
    });
    return id;
  }

  addDribbleOpportunity(position: Point): string {
    const id = `drible-${this.draftState.dribbleOpportunities.length + 1}`;
    this.mutate((d) => {
      d.dribbleOpportunities.push({ id, position: { ...position }, radius: 60, defense: 30 });
    });
    return id;
  }

  moveSelected(position: Point): void {
    const sel = this.selectionState;
    if (!sel) return;
    this.mutate((d) => {
      switch (sel.kind) {
        case 'ball':
          d.ball = { ...position };
          break;
        case 'hero':
          d.hero.position = { ...position };
          break;
        case 'goalkeeper':
          d.goalkeeper.position = { ...position };
          break;
        case 'teammate': {
          const t = d.teammates.find((t) => t.id === sel.id);
          if (t) t.position = { ...position };
          break;
        }
        case 'defender': {
          const t = d.defenders.find((t) => t.id === sel.id);
          if (t) t.position = { ...position };
          break;
        }
        case 'dribble': {
          const t = d.dribbleOpportunities.find((t) => t.id === sel.id);
          if (t) t.position = { ...position };
          break;
        }
      }
    });
  }

  removeSelected(): void {
    const sel = this.selectionState;
    if (!sel || !sel.id) return;
    this.mutate((d) => {
      if (sel.kind === 'teammate') d.teammates = d.teammates.filter((t) => t.id !== sel.id);
      if (sel.kind === 'defender') d.defenders = d.defenders.filter((t) => t.id !== sel.id);
      if (sel.kind === 'dribble') {
        d.dribbleOpportunities = d.dribbleOpportunities.filter((t) => t.id !== sel.id);
      }
    });
    this.selectionState = null;
    this.emit();
  }

  updateSelectedProps(patch: {
    interceptRadius?: number;
    radius?: number;
    defense?: number;
  }): void {
    const sel = this.selectionState;
    if (!sel || !sel.id) return;
    this.mutate((d) => {
      if (sel.kind === 'defender' && patch.interceptRadius !== undefined) {
        const t = d.defenders.find((t) => t.id === sel.id);
        if (t) t.interceptRadius = patch.interceptRadius;
      }
      if (sel.kind === 'dribble') {
        const t = d.dribbleOpportunities.find((t) => t.id === sel.id);
        if (t) {
          if (patch.radius !== undefined) t.radius = patch.radius;
          if (patch.defense !== undefined) t.defense = patch.defense;
        }
      }
    });
  }

  // ----------------------------------------------------------------- rotas

  /**
   * Acrescenta um waypoint à rota do ator selecionado (companheiro ou
   * defensor). Timing automático: t cresce pela distância a ROUTE_SPEED.
   * A rota nasce com o waypoint 0 na posição inicial do ator (t=0).
   */
  addWaypointToSelected(position: Point): void {
    const sel = this.selectionState;
    if (!sel || !sel.id || (sel.kind !== 'teammate' && sel.kind !== 'defender')) return;
    this.mutate((d) => {
      const actor =
        sel.kind === 'teammate'
          ? d.teammates.find((t) => t.id === sel.id)
          : d.defenders.find((t) => t.id === sel.id);
      if (!actor) return;
      if (!actor.route || actor.route.length === 0) {
        actor.route = [{ x: actor.position.x, y: actor.position.y, t: 0 }];
      }
      const last = actor.route[actor.route.length - 1] as { x: number; y: number; t: number };
      const dt = Math.max(0.1, dist(last, position) / ROUTE_SPEED);
      actor.route.push({ x: position.x, y: position.y, t: last.t + dt });
    });
  }

  clearSelectedRoute(): void {
    const sel = this.selectionState;
    if (!sel || !sel.id) return;
    this.mutate((d) => {
      const actor =
        sel.kind === 'teammate'
          ? d.teammates.find((t) => t.id === sel.id)
          : sel.kind === 'defender'
            ? d.defenders.find((t) => t.id === sel.id)
            : undefined;
      if (actor) delete actor.route;
    });
  }

  // --------------------------------------------------------- export/import

  /** JSON validado e formatado; lança ZodError se o draft estiver inválido. */
  exportJson(): string {
    return JSON.stringify(parseLevelScript(this.draftState), null, 2);
  }

  /** Payload base64url para jogar no game (?level=custom#payload). */
  exportPlayUrl(gameBaseUrl: string): string {
    return `${gameBaseUrl}/?level=custom#${encodeLevelScript(this.draftState)}`;
  }

  /** Importa JSON; retorna lista de erros legíveis (vazia em sucesso). */
  importJson(json: string): string[] {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return ['JSON malformado'];
    }
    const result = LevelScript.safeParse(raw);
    if (!result.success) {
      return result.error.issues.map((i) => `${i.path.join('.') || '(raiz)'}: ${i.message}`);
    }
    this.draftState = result.data;
    this.selectionState = null;
    this.emit();
    return [];
  }

  /** Ator mais próximo de um ponto (para seleção por toque). */
  pick(position: Point, maxDist = 40): Selection | null {
    const d = this.draftState;
    const candidates: Array<{ sel: Selection; dist: number }> = [
      { sel: { kind: 'ball', id: null }, dist: dist(position, d.ball) },
      { sel: { kind: 'hero', id: null }, dist: dist(position, d.hero.position) },
      { sel: { kind: 'goalkeeper', id: null }, dist: dist(position, d.goalkeeper.position) },
      ...d.teammates.map((t) => ({
        sel: { kind: 'teammate' as const, id: t.id },
        dist: dist(position, t.position),
      })),
      ...d.defenders.map((t) => ({
        sel: { kind: 'defender' as const, id: t.id },
        dist: dist(position, t.position),
      })),
      ...d.dribbleOpportunities.map((t) => ({
        sel: { kind: 'dribble' as const, id: t.id },
        dist: dist(position, t.position),
      })),
    ];
    candidates.sort((a, b) => a.dist - b.dist);
    const best = candidates[0];
    return best && best.dist <= maxDist ? best.sel : null;
  }
}

export const editorStore = new EditorStore();
