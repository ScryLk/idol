import { describe, expect, it } from 'vitest';
import { decodeLevelScript, parseLevelScript } from '@idol/shared';
import { EditorStore } from './editorStore.js';

describe('EditorStore', () => {
  it('draft em branco já é um LevelScript válido', () => {
    const store = new EditorStore();
    expect(() => parseLevelScript(store.draft)).not.toThrow();
    expect(store.exportJson()).toContain('"version": 1');
  });

  it('adiciona, seleciona, move e remove atores mantendo validade', () => {
    const store = new EditorStore();
    const id = store.addDefender({ x: 300, y: 500 });
    store.select({ kind: 'defender', id });
    store.moveSelected({ x: 350, y: 520 });
    store.updateSelectedProps({ interceptRadius: 60 });

    const d = store.draft.defenders.find((x) => x.id === id);
    expect(d?.position).toEqual({ x: 350, y: 520 });
    expect(d?.interceptRadius).toBe(60);
    expect(() => parseLevelScript(store.draft)).not.toThrow();

    store.removeSelected();
    expect(store.draft.defenders).toHaveLength(0);
  });

  it('rotas ganham waypoint 0 na posição do ator e t estritamente crescente', () => {
    const store = new EditorStore();
    const id = store.addTeammate({ x: 200, y: 700 });
    store.select({ kind: 'teammate', id });
    store.addWaypointToSelected({ x: 200, y: 550 });
    store.addWaypointToSelected({ x: 300, y: 400 });

    const route = store.draft.teammates[0]?.route;
    expect(route).toHaveLength(3);
    expect(route?.[0]).toEqual({ x: 200, y: 700, t: 0 });
    for (let i = 1; i < (route?.length ?? 0); i++) {
      expect(route?.[i]?.t ?? 0).toBeGreaterThan(route?.[i - 1]?.t ?? 0);
    }
    // rota validada pelo schema (t crescente é refinamento do Zod)
    expect(() => parseLevelScript(store.draft)).not.toThrow();

    store.clearSelectedRoute();
    expect(store.draft.teammates[0]?.route).toBeUndefined();
  });

  it('export/import roundtrip e link de jogo decodificável', () => {
    const store = new EditorStore();
    store.setMetadata({ name: 'Feito no Editor', ordinal: 77, difficulty: 3 });
    store.addDefender({ x: 360, y: 600 });
    store.setObjective({ type: 'goal_after_passes', minPasses: 1 });
    store.addTeammate({ x: 200, y: 650 });

    const json = store.exportJson();
    const other = new EditorStore();
    expect(other.importJson(json)).toEqual([]);
    expect(other.draft.metadata.name).toBe('Feito no Editor');

    const url = store.exportPlayUrl('http://localhost:5173');
    const payload = url.split('#')[1] ?? '';
    expect(decodeLevelScript(payload).metadata.ordinal).toBe(77);
  });

  it('import inválido devolve erros legíveis e não corrompe o draft', () => {
    const store = new EditorStore();
    const before = store.exportJson();

    expect(store.importJson('{{{')).toEqual(['JSON malformado']);
    const errors = store.importJson(JSON.stringify({ version: 2 }));
    expect(errors.length).toBeGreaterThan(0);
    expect(store.exportJson()).toBe(before);
  });

  it('pick seleciona o ator mais próximo dentro do raio', () => {
    const store = new EditorStore();
    const id = store.addDefender({ x: 300, y: 500 });
    expect(store.pick({ x: 310, y: 505 })).toEqual({ kind: 'defender', id });
    expect(store.pick({ x: 360, y: 940 })).toEqual({ kind: 'ball', id: null });
    expect(store.pick({ x: 50, y: 50 })).toBeNull();
  });

  it('notifica listeners em cada mutação', () => {
    const store = new EditorStore();
    let calls = 0;
    const off = store.subscribe(() => calls++);
    store.addDefender({ x: 1, y: 1 });
    store.setMetadata({ name: 'X' });
    off();
    store.addTeammate({ x: 2, y: 2 });
    expect(calls).toBe(2);
  });
});
