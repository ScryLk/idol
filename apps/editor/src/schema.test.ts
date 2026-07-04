import { describe, expect, it } from 'vitest';
import { LevelScript } from '@idol/shared';

describe('editor usa o mesmo schema do game', () => {
  it('LevelScript está acessível via @idol/shared', () => {
    expect(LevelScript.safeParse({}).success).toBe(false);
  });
});
