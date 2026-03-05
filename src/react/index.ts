/**
 * @aeryflux/globe/react - React components for web
 */

export { Globe, type GlobeProps } from './Globe';
export { GlobeFallback, type GlobeFallbackProps } from './GlobeFallback';
export { useWebGLSupport } from './useWebGLSupport';

// Re-export types
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

// Re-export animation utilities
export {
  animateDataHighlights,
  animateCityHighlights,
  type DataHighlightState,
  type CityHighlightState,
} from '../core/GlobeRenderer';
