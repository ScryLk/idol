import { describe, expect, it } from 'vitest';
import { metaStore } from './metaStore.js';

describe('metaStore', () => {
  it('inicia no piso de fãs e tier Amador', () => {
    const s = metaStore.getState();
    expect(s.fans).toBe(500);
    expect(s.tier.id).toBe('amador');
  });

  it('recalcula o tier ao atualizar fãs', () => {
    metaStore.getState().setFans(35_000);
    expect(metaStore.getState().tier.id).toBe('regional');
    metaStore.getState().setFans(500);
  });
});
