import { applyMatrix, FILTERS, matrixOf } from '@/features/media/filters';

describe('filters', () => {
  test('every filter has a 4x5 matrix and a Vietnamese label', () => {
    expect(FILTERS.map((f) => f.id)).toEqual(['ORIGINAL', 'WARM', 'COOL', 'VINTAGE', 'BW']);
    FILTERS.forEach((f) => {
      expect(f.matrix).toHaveLength(20);
      expect(f.label.length).toBeGreaterThan(0);
    });
  });

  test('original keeps colors unchanged', () => {
    expect(applyMatrix(matrixOf('ORIGINAL'), [0.2, 0.4, 0.6, 1])).toEqual([0.2, 0.4, 0.6, 1]);
  });

  test('black and white produces equal channels', () => {
    const [r, g, b, a] = applyMatrix(matrixOf('BW'), [0.9, 0.2, 0.1, 1]);
    expect(r).toBeCloseTo(g, 5);
    expect(g).toBeCloseTo(b, 5);
    expect(a).toBe(1);
  });

  test('warm boosts red and lowers blue', () => {
    const [r, , b] = applyMatrix(matrixOf('WARM'), [0.5, 0.5, 0.5, 1]);
    expect(r).toBeGreaterThan(0.5);
    expect(b).toBeLessThan(0.5);
  });

  test('results are clamped to 0..1', () => {
    applyMatrix(matrixOf('VINTAGE'), [1, 1, 1, 1]).forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });
});
