import { describe, expect, it } from 'vitest';
import { catmullRomSpline } from './catmullRom.js';
import { angleDiff, dist, pointToSegmentDistance, type Point } from './point.js';
import { simplifyRdp } from './rdp.js';
import { polylineLength, resampleBySpacing } from './resample.js';

describe('pointToSegmentDistance', () => {
  it('distância perpendicular a segmento horizontal', () => {
    expect(pointToSegmentDistance({ x: 5, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(3);
  });
  it('além das pontas usa a distância ao extremo mais próximo', () => {
    expect(pointToSegmentDistance({ x: -4, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
    expect(pointToSegmentDistance({ x: 14, y: 3 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(5);
  });
  it('segmento degenerado (ponto)', () => {
    expect(pointToSegmentDistance({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('angleDiff', () => {
  it('embrulha em [-π, π]', () => {
    expect(angleDiff(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2, 10);
    expect(angleDiff(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2, 10);
    expect(angleDiff(1, 0.5)).toBeCloseTo(0.5, 10);
  });
});

describe('simplifyRdp', () => {
  const line: Point[] = Array.from({ length: 50 }, (_, i) => ({ x: i * 10, y: 0 }));

  it('colapsa pontos colineares em dois extremos', () => {
    expect(simplifyRdp(line, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 490, y: 0 },
    ]);
  });

  it('preserva o vértice de um canto', () => {
    const corner: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 50 },
      { x: 100, y: 100 },
    ];
    expect(simplifyRdp(corner, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
  });

  it('mantém entradas com ≤ 2 pontos', () => {
    expect(simplifyRdp([{ x: 1, y: 1 }], 5)).toEqual([{ x: 1, y: 1 }]);
    const two: Point[] = [
      { x: 0, y: 0 },
      { x: 9, y: 9 },
    ];
    expect(simplifyRdp(two, 5)).toEqual(two);
  });

  it('sempre preserva primeiro e último ponto', () => {
    const noisy: Point[] = Array.from({ length: 200 }, (_, i) => ({
      x: i * 4,
      y: Math.sin(i / 6) * 40,
    }));
    const out = simplifyRdp(noisy, 3);
    expect(out[0]).toEqual(noisy[0]);
    expect(out[out.length - 1]).toEqual(noisy[noisy.length - 1]);
    expect(out.length).toBeLessThan(noisy.length);
    expect(out.length).toBeGreaterThan(2);
  });

  it('rejeita epsilon negativo', () => {
    expect(() => simplifyRdp(line, -1)).toThrow(RangeError);
  });
});

describe('catmullRomSpline', () => {
  const control: Point[] = [
    { x: 0, y: 0 },
    { x: 100, y: 100 },
    { x: 200, y: 0 },
  ];

  it('passa exatamente pelos pontos de controle', () => {
    const out = catmullRomSpline(control, 10);
    expect(out[0]).toEqual(control[0]);
    expect(out[10]).toEqual(control[1]);
    expect(out[20]).toEqual(control[2]);
  });

  it('gera samplesPerSegment pontos por segmento + o inicial', () => {
    expect(catmullRomSpline(control, 8)).toHaveLength(1 + 2 * 8);
  });

  it('entrada com < 2 pontos passa direto', () => {
    expect(catmullRomSpline([{ x: 5, y: 5 }], 4)).toEqual([{ x: 5, y: 5 }]);
  });

  it('rejeita samplesPerSegment inválido', () => {
    expect(() => catmullRomSpline(control, 0)).toThrow(RangeError);
    expect(() => catmullRomSpline(control, 1.5)).toThrow(RangeError);
  });
});

describe('resampleBySpacing', () => {
  it('espaça pontos uniformemente ao longo de uma reta', () => {
    const out = resampleBySpacing(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      10,
    );
    expect(out).toHaveLength(11);
    for (let i = 1; i < out.length; i++) {
      expect(dist(out[i - 1] as Point, out[i] as Point)).toBeCloseTo(10, 6);
    }
  });

  it('preserva primeiro e último ponto mesmo com sobra', () => {
    const out = resampleBySpacing(
      [
        { x: 0, y: 0 },
        { x: 95, y: 0 },
      ],
      10,
    );
    expect(out[0]).toEqual({ x: 0, y: 0 });
    expect(out[out.length - 1]).toEqual({ x: 95, y: 0 });
  });

  it('atravessa vértices acumulando comprimento (carry entre segmentos)', () => {
    const out = resampleBySpacing(
      [
        { x: 0, y: 0 },
        { x: 7, y: 0 },
        { x: 7, y: 7 },
      ],
      5,
    );
    // comprimento total 14 → samples nos arcos 5 e 10 + extremos
    expect(out).toHaveLength(4);
    expect(out[1]).toEqual({ x: 5, y: 0 }); // arco 5, ainda no 1º segmento
    expect(out[2]).toEqual({ x: 7, y: 3 }); // arco 10 = 7 + 3 no 2º segmento
    expect(out[3]).toEqual({ x: 7, y: 7 });
  });

  it('ignora segmentos de comprimento zero', () => {
    const out = resampleBySpacing(
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      5,
    );
    expect(out[out.length - 1]).toEqual({ x: 10, y: 0 });
  });

  it('rejeita spacing inválido', () => {
    expect(() => resampleBySpacing([], 0)).toThrow(RangeError);
  });
});

describe('polylineLength', () => {
  it('soma segmentos', () => {
    expect(
      polylineLength([
        { x: 0, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 14 },
      ]),
    ).toBe(15);
  });
  it('vazia ou 1 ponto → 0', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 1, y: 1 }])).toBe(0);
  });
});
