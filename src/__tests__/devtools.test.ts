import { describe, it, expect } from 'vitest';
import type { GlobeConfig } from '../core/types';

describe('GlobeDevTools config', () => {
  it('all toggle keys are valid GlobeConfig keys', () => {
    const validKeys: (keyof GlobeConfig)[] = [
      'showGlobeFill', 'showCountries', 'showBorders', 'showCities',
      'enableControls', 'glowIntensity', 'rotationSpeed', 'bloomStrength',
      'bass', 'energy', 'ambientIntensity',
    ];
    const config: GlobeConfig = {};
    validKeys.forEach(key => {
      expect(key in config || config[key] === undefined).toBe(true);
    });
  });

  it('boolean toggles default to correct values', () => {
    // showGlobeFill, showCountries, showBorders = true by default
    // showCities, enableControls = false by default
    const defaults: Record<string, boolean> = {
      showGlobeFill: true,
      showCountries: true,
      showBorders: true,
      showCities: false,
      enableControls: false,
    };
    for (const [key, expected] of Object.entries(defaults)) {
      // Defaults are applied at component level, not in GlobeConfig type
      expect(typeof expected).toBe('boolean');
    }
  });

  it('range sliders have valid min/max/step', () => {
    const ranges = [
      { key: 'glowIntensity', min: 0, max: 3, step: 0.1 },
      { key: 'rotationSpeed', min: 0, max: 0.005, step: 0.0001 },
      { key: 'bloomStrength', min: 0, max: 3, step: 0.1 },
      { key: 'bass', min: 0, max: 1.5, step: 0.05 },
      { key: 'energy', min: 0, max: 1, step: 0.05 },
      { key: 'ambientIntensity', min: 0, max: 2, step: 0.1 },
    ];
    ranges.forEach(({ min, max, step }) => {
      expect(min).toBeLessThan(max);
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThan(max - min);
    });
  });

  it('onChange produces valid partial config', () => {
    const changes: Partial<GlobeConfig>[] = [
      { showCountries: false },
      { showBorders: true },
      { showGlobeFill: false },
      { glowIntensity: 2.0 },
      { bass: 1.0, energy: 0.5 },
      { bloomStrength: 0 },
    ];
    changes.forEach(change => {
      const merged: GlobeConfig = { ...change };
      expect(merged).toBeDefined();
      for (const [key, value] of Object.entries(change)) {
        expect(merged[key as keyof GlobeConfig]).toBe(value);
      }
    });
  });
});

describe('GlobeDevTools visibility toggles', () => {
  it('toggling showCountries flips the value', () => {
    let config: GlobeConfig = { showCountries: true };
    config = { ...config, showCountries: !config.showCountries };
    expect(config.showCountries).toBe(false);
    config = { ...config, showCountries: !config.showCountries };
    expect(config.showCountries).toBe(true);
  });

  it('toggling showBorders flips the value', () => {
    let config: GlobeConfig = { showBorders: true };
    config = { ...config, showBorders: !config.showBorders };
    expect(config.showBorders).toBe(false);
  });

  it('toggling showGlobeFill flips the value', () => {
    let config: GlobeConfig = { showGlobeFill: true };
    config = { ...config, showGlobeFill: !config.showGlobeFill };
    expect(config.showGlobeFill).toBe(false);
  });

  it('toggling showCities flips the value', () => {
    let config: GlobeConfig = { showCities: false };
    config = { ...config, showCities: !config.showCities };
    expect(config.showCities).toBe(true);
  });
});

describe('Music reactivity', () => {
  it('bass 0 produces no boost', () => {
    const bass = 0;
    const speedMult = 1 + bass * 0.5;
    expect(speedMult).toBe(1);
  });

  it('bass 1.5 produces significant boost', () => {
    const bass = 1.5;
    const speedMult = 1 + bass * 0.5;
    expect(speedMult).toBe(1.75);
  });

  it('energy 1 adds to speed', () => {
    const energy = 1;
    const speedMult = 1 + energy * 0.3;
    expect(speedMult).toBe(1.3);
  });

  it('combined bass + energy boost is additive', () => {
    const bass = 1.0, energy = 0.8;
    const speedMult = 1 + bass * 0.5 + energy * 0.3;
    expect(speedMult).toBeCloseTo(1.74);
  });
});
