/**
 * @aeryflux/globe/react-native - React Native components for Expo
 *
 * Note: This is a placeholder. The full implementation requires:
 * - expo-gl
 * - expo-three
 * - expo-asset
 *
 * For now, exports types and utilities that work cross-platform.
 * Full Expo component will be added in a future version.
 */

// Re-export core types and utilities
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

export {
  buildGlobeIndex,
  getSurfaceColors,
  applyGlobeMaterials,
  createGlobeScene,
  createGlobeCamera,
  animateGlobeRotation,
  animateBorderPulse,
  animateDataHighlights,
  animateCityHighlights,
  resetAllCountries,
  resetAllCities,
  type DataHighlightState,
  type CityHighlightState,
} from '../core/GlobeRenderer';

/**
 * Globe component for React Native (Expo)
 *
 * Coming soon - use GlobeBackground from Atlas as reference implementation.
 *
 * Usage with Expo:
 * ```tsx
 * import { GLView } from 'expo-gl';
 * import { Renderer } from 'expo-three';
 * import { buildGlobeIndex, applyGlobeMaterials } from '@aeryflux/globe/react-native';
 *
 * // See Atlas GlobeBackground.tsx for full implementation
 * ```
 */
export const Globe = null; // Placeholder - full implementation coming soon
