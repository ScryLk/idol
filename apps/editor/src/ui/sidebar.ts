import type { LevelScript } from '@idol/shared';
import { editorStore, type EditorMode } from '../state/editorStore.js';

/**
 * Sidebar DOM do editor: modos de edição, propriedades do nível e do ator
 * selecionado, export/import. Renderização "burra": redesenha nos eventos do
 * store; inputs aplicam mutações no store.
 */

const GAME_URL =
  (import.meta.env['VITE_GAME_URL'] as string | undefined) ?? 'http://localhost:5173';

const MODES: Array<{ id: EditorMode; label: string }> = [
  { id: 'move', label: '✥ Mover' },
  { id: 'add-defender', label: '+ Zagueiro' },
  { id: 'add-teammate', label: '+ Companheiro' },
  { id: 'add-dribble', label: '+ Drible' },
  { id: 'route', label: '➜ Rota' },
];

export function mountSidebar(root: HTMLElement, onPlaytest: () => void): void {
  let importErrors: string[] = [];

  const render = (): void => {
    const d = editorStore.draft;
    const sel = editorStore.selection;
    const obj = d.objective;

    root.innerHTML = `
      <h1>IDOL — Editor de Níveis</h1>

      <h2>Modo</h2>
      <div>${MODES.map(
        (m) =>
          `<button data-mode="${m.id}" class="${editorStore.mode === m.id ? 'active' : ''}">${m.label}</button>`,
      ).join('')}</div>
      <div class="row">
        <button data-action="delete">🗑 Remover selecionado</button>
        <button data-action="clear-route">Limpar rota</button>
      </div>

      <h2>Metadados</h2>
      <label>Nome</label><input data-meta="name" value="${d.metadata.name}" />
      <div class="row">
        <div><label>Temporada</label><input data-meta="season" type="number" min="1" value="${d.metadata.season}" /></div>
        <div><label>Ordinal</label><input data-meta="ordinal" type="number" min="1" value="${d.metadata.ordinal}" /></div>
        <div><label>Dificuldade</label><input data-meta="difficulty" type="number" min="1" max="5" value="${d.metadata.difficulty}" /></div>
      </div>

      <h2>Objetivo</h2>
      <select data-field="objective-type">
        <option value="goal" ${obj.type === 'goal' ? 'selected' : ''}>Gol</option>
        <option value="goal_after_passes" ${obj.type === 'goal_after_passes' ? 'selected' : ''}>Gol após passes</option>
        <option value="goal_with_dribble" ${obj.type === 'goal_with_dribble' ? 'selected' : ''}>Gol com drible</option>
      </select>
      ${
        obj.type === 'goal_after_passes'
          ? `<label>Passes mínimos</label><input data-field="objective-count" type="number" min="1" value="${obj.minPasses}" />`
          : obj.type === 'goal_with_dribble'
            ? `<label>Dribles mínimos</label><input data-field="objective-count" type="number" min="1" value="${obj.minDribbles}" />`
            : ''
      }

      <h2>Estrelas</h2>
      <div class="row">
        <div><label>2★ máx. toques</label><input data-star="two" type="number" min="1" value="${d.stars.two.maxTouches ?? 3}" /></div>
        <div><label>3★ máx. toques</label><input data-star="three" type="number" min="1" value="${d.stars.three.maxTouches ?? 2}" /></div>
      </div>

      <h2>Goleiro</h2>
      <div class="row">
        <div><label>Raio</label><input data-gk="radius" type="number" min="10" value="${d.goalkeeper.arc.radius}" /></div>
        <div><label>Meia-abertura (rad)</label><input data-gk="halfAngle" type="number" step="0.05" min="0.1" max="3.1" value="${d.goalkeeper.arc.halfAngle}" /></div>
      </div>

      ${renderSelection(d, sel)}

      <h2>Nível</h2>
      <div class="row">
        <button data-action="playtest" class="primary">▶ Testar</button>
        <button data-action="export" class="primary">⇩ Exportar</button>
        <button data-action="new">Novo</button>
      </div>
      <label>script_json (exportado / cole aqui para importar)</label>
      <textarea data-field="json" spellcheck="false"></textarea>
      <div class="row">
        <button data-action="import">⇧ Importar do texto</button>
        <button data-action="download">Baixar .json</button>
      </div>
      ${importErrors.length ? `<div class="errors">Erros:\n${importErrors.join('\n')}</div>` : ''}
      <h2>Jogar no game</h2>
      <a data-field="play-link" href="#" target="_blank" rel="noreferrer">gerar link ao exportar</a>
    `;

    wire();
  };

  const renderSelection = (
    d: LevelScript,
    sel: ReturnType<() => typeof editorStore.selection>,
  ): string => {
    if (!sel)
      return '<h2>Seleção</h2><em style="font-size:12px;color:#78909c">nada selecionado</em>';
    if (sel.kind === 'defender') {
      const def = d.defenders.find((x) => x.id === sel.id);
      return `<h2>Zagueiro: ${sel.id}</h2>
        <label>Raio de interceptação</label>
        <input data-prop="interceptRadius" type="number" min="5" value="${def?.interceptRadius ?? 45}" />`;
    }
    if (sel.kind === 'dribble') {
      const op = d.dribbleOpportunities.find((x) => x.id === sel.id);
      return `<h2>Oportunidade: ${sel.id}</h2>
        <div class="row">
          <div><label>Raio</label><input data-prop="radius" type="number" min="10" value="${op?.radius ?? 60}" /></div>
          <div><label>Defesa</label><input data-prop="defense" type="number" min="0" value="${op?.defense ?? 30}" /></div>
        </div>`;
    }
    return `<h2>Seleção</h2><em style="font-size:12px;color:#78909c">${sel.kind}${sel.id ? `: ${sel.id}` : ''}</em>`;
  };

  const wire = (): void => {
    root.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach((btn) => {
      btn.onclick = () => editorStore.setMode(btn.dataset['mode'] as EditorMode);
    });

    const on = (selector: string, handler: (el: HTMLInputElement) => void): void => {
      root.querySelectorAll<HTMLInputElement>(selector).forEach((el) => {
        el.onchange = () => handler(el);
      });
    };

    on('input[data-meta]', (el) => {
      const key = el.dataset['meta'] as 'name' | 'season' | 'ordinal' | 'difficulty';
      editorStore.setMetadata({ [key]: key === 'name' ? el.value : Number(el.value) });
    });

    on('input[data-gk]', (el) => {
      editorStore.setGoalkeeperArc({
        [el.dataset['gk'] as 'radius' | 'halfAngle']: Number(el.value),
      });
    });

    on('input[data-star]', (el) => {
      const stars = structuredClone(editorStore.draft.stars);
      if (el.dataset['star'] === 'two') stars.two.maxTouches = Number(el.value);
      else stars.three.maxTouches = Number(el.value);
      editorStore.setStars(stars);
    });

    on('input[data-prop]', (el) => {
      editorStore.updateSelectedProps({ [el.dataset['prop'] as string]: Number(el.value) });
    });

    const objType = root.querySelector<HTMLSelectElement>('select[data-field="objective-type"]');
    if (objType) {
      objType.onchange = () => {
        const t = objType.value;
        editorStore.setObjective(
          t === 'goal_after_passes'
            ? { type: 'goal_after_passes', minPasses: 1 }
            : t === 'goal_with_dribble'
              ? { type: 'goal_with_dribble', minDribbles: 1 }
              : { type: 'goal' },
        );
      };
    }
    on('input[data-field="objective-count"]', (el) => {
      const obj = editorStore.draft.objective;
      if (obj.type === 'goal_after_passes') {
        editorStore.setObjective({ type: 'goal_after_passes', minPasses: Number(el.value) });
      } else if (obj.type === 'goal_with_dribble') {
        editorStore.setObjective({ type: 'goal_with_dribble', minDribbles: Number(el.value) });
      }
    });

    const textarea = root.querySelector<HTMLTextAreaElement>('textarea[data-field="json"]');
    const playLink = root.querySelector<HTMLAnchorElement>('a[data-field="play-link"]');

    const act = (name: string, handler: () => void): void => {
      const btn = root.querySelector<HTMLButtonElement>(`button[data-action="${name}"]`);
      if (btn) btn.onclick = handler;
    };

    act('delete', () => editorStore.removeSelected());
    act('clear-route', () => editorStore.clearSelectedRoute());
    act('new', () => {
      importErrors = [];
      editorStore.reset();
    });
    act('playtest', onPlaytest);
    act('export', () => {
      try {
        importErrors = [];
        const json = editorStore.exportJson();
        const url = editorStore.exportPlayUrl(GAME_URL);
        render();
        const ta = root.querySelector<HTMLTextAreaElement>('textarea[data-field="json"]');
        const link = root.querySelector<HTMLAnchorElement>('a[data-field="play-link"]');
        if (ta) ta.value = json;
        if (link) {
          link.href = url;
          link.textContent = url;
        }
      } catch (err) {
        importErrors = [String(err)];
        render();
      }
    });
    act('import', () => {
      importErrors = editorStore.importJson(textarea?.value ?? '');
      if (importErrors.length > 0) render();
    });
    act('download', () => {
      try {
        const json = editorStore.exportJson();
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${editorStore.draft.metadata.name.replace(/\s+/g, '-').toLowerCase()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      } catch (err) {
        importErrors = [String(err)];
        render();
      }
    });

    void playLink;
  };

  editorStore.subscribe(render);
  render();
}
