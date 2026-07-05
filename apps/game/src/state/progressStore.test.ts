import { beforeEach, describe, expect, it } from 'vitest';
import { loadProgress, recordStars } from './progressStore.js';

// stub simples de localStorage para o ambiente node
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

describe('progressStore', () => {
  it('começa vazio e persiste o melhor resultado', () => {
    expect(loadProgress()).toEqual({});
    recordStars(1, 2);
    expect(loadProgress()).toEqual({ 1: 2 });
  });

  it('best-of: resultado pior não rebaixa', () => {
    recordStars(3, 3);
    recordStars(3, 1);
    expect(loadProgress()).toEqual({ 3: 3 });
  });

  it('clampa estrelas em [0,3] e ignora lixo persistido', () => {
    recordStars(2, 99);
    expect(loadProgress()[2]).toBe(3);
    backing.set('idol:progress', '{"1":"3","x":2,"5":-4,"6":2}');
    expect(loadProgress()).toEqual({ 1: 3, 6: 2 });
    backing.set('idol:progress', 'não é json');
    expect(loadProgress()).toEqual({});
  });
});
