/**
 * @aeryflux/globe/react - React components for web
 */

export { Globe, type GlobeProps, type GlobeHandle } from './Globe';
export { GlobeFallback, type GlobeFallbackProps } from './GlobeFallback';
export { GlobeDevTools, type GlobeDevToolsProps } from './GlobeDevTools';
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
