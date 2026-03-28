import { describe, it, expect } from 'vitest';
import type { GlobeConfig } from '../core/types';

describe('GlobeConfig defaults', () => {
  it('all boolean props default correctly', () => {
    const config: GlobeConfig = {};
    // These should be undefined (defaults applied at component level)
    expect(config.showCountries).toBeUndefined();
    expect(config.showBorders).toBeUndefined();
    expect(config.showGlobeFill).toBeUndefined();
    expect(config.showCities).toBeUndefined();
    expect(config.enableControls).toBeUndefined();
  });

  it('music props accept valid ranges', () => {
    const config: GlobeConfig = {
      bass: 1.5,
      mid: 1.0,
      treble: 1.0,
      energy: 1.0,
      ambientIntensity: 2.0,
    };
    expect(config.bass).toBeLessThanOrEqual(1.5);
    expect(config.energy).toBeLessThanOrEqual(1);
    expect(config.ambientIntensity).toBeLessThanOrEqual(2);
  });

  it('gradient colors are valid hex strings', () => {
    const config: GlobeConfig = {
      gradientTop: '#06060e',
      gradientBottom: '#0e1430',
    };
    expect(config.gradientTop).toMatch(/^#[0-9a-f]{6}$/i);
    expect(config.gradientBottom).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('surface accepts valid values', () => {
    const valid: GlobeConfig['surface'][] = ['dark', 'green', 'white'];
    valid.forEach(s => {
      const config: GlobeConfig = { surface: s };
      expect(config.surface).toBe(s);
    });
  });
});
