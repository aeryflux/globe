/**
 * @aeryflux/globe/react-native
 *
 * Standalone 3D globe for Expo (React Native).
 *
 * Peer dependencies: expo-gl, expo-three, three
 *
 * Usage:
 * ```tsx
 * import { Globe } from '@aeryflux/globe/react-native';
 *
 * <Globe surface="dark" showCountries rotationSpeed={0.0004} />
 * ```
 *
 * For custom integrations (custom scene, materials, etc.) the core
 * renderer utilities are also exported below.
 */

export { Globe } from './Globe';
export type { GlobeNativeProps } from './Globe';

// Core types
export type {
  SurfaceId,
  GlobeConfig,
  CountryHighlight,
  CountryDataMap,
  CityHighlight,
  CityDataMap,
  SurfaceColors,
  GlobeIndex,
} from '../core/types';

export { SURFACES, GLOBE_MODELS } from '../core/types';

// Core renderer utilities (for custom integrations)
export {
  buildGlobeIndex,
  getSurfaceColors,
  applyGlobeMaterials,
  createGlobeScene,
  createGlobeCamera,
  animateGlobeRotation,
  animateBorderPulse,
  animateAmbientWave,
  animateDataHighlights,
  animateCityHighlights,
  resetAllCountries,
  resetAllCities,
  updateGradient,
  updateGlobeFillTint,
  updateAccentLight,
  createIntroState,
  applyIntroAnimation,
  type DataHighlightState,
  type CityHighlightState,
  type IntroState,
  type SceneRefs,
} from '../core/GlobeRenderer';
