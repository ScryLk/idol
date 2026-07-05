import { describe, expect, it } from 'vitest';
import { decodeLevelScript, encodeLevelScript } from './codec.js';
import { SEASON1_LEVELS } from './season1.js';
import type { LevelScript } from '../schemas/level.js';

describe('codec de LevelScript (base64url)', () => {
  it('roundtrip preserva todos os níveis da temporada 1', () => {
    for (const level of SEASON1_LEVELS) {
      expect(decodeLevelScript(encodeLevelScript(level))).toEqual(level);
    }
  });

  it('suporta nomes com acentos/emoji (UTF-8)', () => {
    const level: LevelScript = {
      ...(SEASON1_LEVELS[0] as LevelScript),
      metadata: { name: 'Chapéu à Beira-Campo ⚽', season: 1, ordinal: 42, difficulty: 2 },
    };
    expect(decodeLevelScript(encodeLevelScript(level)).metadata.name).toBe(
      'Chapéu à Beira-Campo ⚽',
    );
  });

  it('é seguro para URL (sem + / = )', () => {
    const encoded = encodeLevelScript(SEASON1_LEVELS[9] as LevelScript);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('rejeita payload adulterado ou lixo', () => {
    expect(() => decodeLevelScript('bm90LWpzb24')).toThrow(); // "not-json"
    const tampered = encodeLevelScript(SEASON1_LEVELS[0] as LevelScript).slice(0, 40);
    expect(() => decodeLevelScript(tampered)).toThrow();
  });

  it('encode valida a entrada (não exporta nível inválido)', () => {
    const bad = { ...(SEASON1_LEVELS[0] as LevelScript), version: 9 } as unknown as LevelScript;
    expect(() => encodeLevelScript(bad)).toThrow();
  });
});
