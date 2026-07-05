import { beforeEach, describe, expect, it } from 'vitest';
import { drainQueue, enqueueMatch, loadQueue } from './pendingQueue.js';

const backing = new Map<string, string>();
beforeEach(() => {
  backing.clear();
  globalThis.localStorage = {
    getItem: (k: string) => backing.get(k) ?? null,
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
    clear: () => backing.clear(),
    key: () => null,
    get length() {
      return backing.size;
    },
  } as Storage;
});

describe('fila de partidas pendentes (offline)', () => {
  it('enfileira e preserva a ordem FIFO', () => {
    enqueueMatch({ rating: 1, at: 1 });
    enqueueMatch({ rating: 0.5, at: 2 });
    expect(loadQueue().map((m) => m.at)).toEqual([1, 2]);
  });

  it('drena tudo quando o envio funciona', async () => {
    enqueueMatch({ rating: 1, at: 1 });
    enqueueMatch({ rating: 0, at: 2 });
    const sent: number[] = [];
    const n = await drainQueue((m) => {
      sent.push(m.at);
      return Promise.resolve(true);
    });
    expect(n).toBe(2);
    expect(sent).toEqual([1, 2]);
    expect(loadQueue()).toEqual([]);
  });

  it('para na primeira falha e mantém o restante em ordem', async () => {
    enqueueMatch({ rating: 1, at: 1 });
    enqueueMatch({ rating: 1, at: 2 });
    enqueueMatch({ rating: 1, at: 3 });
    let calls = 0;
    const n = await drainQueue(() => Promise.resolve(++calls < 2));
    expect(n).toBe(1);
    expect(loadQueue().map((m) => m.at)).toEqual([2, 3]);
  });

  it('exceção no envio conta como falha (não perde a fila)', async () => {
    enqueueMatch({ rating: 1, at: 1 });
    const n = await drainQueue(() => Promise.reject(new Error('offline')));
    expect(n).toBe(0);
    expect(loadQueue()).toHaveLength(1);
  });

  it('ignora lixo persistido', () => {
    backing.set('idol:pending-matches', '[{"rating":9},{"rating":0.5,"at":7},"x"]');
    expect(loadQueue()).toEqual([{ rating: 0.5, at: 7 }]);
    backing.set('idol:pending-matches', 'nope');
    expect(loadQueue()).toEqual([]);
  });
});
