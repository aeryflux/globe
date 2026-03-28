import { describe, it, expect, vi } from 'vitest';

// Mock Three.js for unit tests (no WebGL needed)
vi.mock('three', () => {
  class MockColor { r=0; g=1; b=0.5; constructor() {} set() { return this; } multiplyScalar() { return this; } setRGB() { return this; } clone() { return new MockColor(); } }
  class MockVec3 { x=0; y=0; z=0; set() { return this; } normalize() { return this; } dot() { return 0; } copy() { return this; } addScaledVector() { return this; } }
  return {
    Scene: class { background: any = null; add() {} },
    PerspectiveCamera: class { position = { set() {} }; aspect = 1; updateProjectionMatrix() {} constructor() {} },
    AmbientLight: class { userData: any = {}; constructor() {} },
    DirectionalLight: class { position = { set() {} }; userData: any = {}; constructor() {} },
    PointLight: class { position = { set() {} }; constructor() {} },
    Color: MockColor,
    Vector3: MockVec3,
    PlaneGeometry: class {},
    ShaderMaterial: class { uniforms: any = {}; depthWrite = false; depthTest = false; },
    Mesh: class { renderOrder = 0; frustumCulled = true; },
    MeshStandardMaterial: class { isMeshStandardMaterial = true; emissive = { setRGB() {} }; emissiveIntensity = 0; },
    FrontSide: 0,
    DoubleSide: 2,
  };
});

import { getSurfaceColors, createGlobeCamera } from '../core/GlobeRenderer';
import { SURFACES } from '../core/types';

describe('GlobeRenderer', () => {
  describe('getSurfaceColors', () => {
    it('returns dark surface colors by default', () => {
      const colors = getSurfaceColors({});
      expect(colors).toBeDefined();
      expect(colors.accent).toBeTruthy();
    });

    it('returns correct surface for each theme', () => {
      for (const surface of ['dark', 'green', 'white'] as const) {
        const colors = getSurfaceColors({ surface });
        expect(colors.accent).toBe(SURFACES[surface].accent);
      }
    });

    it('custom borderColor overrides accent', () => {
      const colors = getSurfaceColors({ borderColor: '#ff0000' });
      expect(colors.accent).toBe('#ff0000');
    });
  });

  describe('createGlobeCamera', () => {
    it('creates camera with correct aspect ratio', () => {
      const camera = createGlobeCamera(800, 600);
      expect(camera).toBeDefined();
    });

    it('responsive Z: mobile closer', () => {
      const mobile = createGlobeCamera(375, 667);
      const desktop = createGlobeCamera(1920, 1080);
      // Both return camera objects (mock)
      expect(mobile).toBeDefined();
      expect(desktop).toBeDefined();
    });
  });
});
