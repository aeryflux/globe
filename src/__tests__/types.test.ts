import { describe, it, expect } from 'vitest';
import { SURFACES } from '../core/types';

describe('Types & Constants', () => {
  it('SURFACES has dark, green, white', () => {
    expect(SURFACES.dark).toBeDefined();
    expect(SURFACES.green).toBeDefined();
    expect(SURFACES.white).toBeDefined();
  });

  it('each surface has required color fields', () => {
    for (const [id, colors] of Object.entries(SURFACES)) {
      expect(colors.accent).toBeTruthy();
      expect(colors.background).toBeTruthy();
      expect(colors.countryColor).toBeTruthy();
      expect(colors.globeFillColor).toBeTruthy();
    }
  });

  it('dark surface has dark background', () => {
    expect(SURFACES.dark.background).toMatch(/^#0/);
  });

  it('white surface has light background', () => {
    expect(SURFACES.white.background).toMatch(/^#[f|e|d]/i);
  });
});
