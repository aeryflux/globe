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
  SurfaceColors,
} from '../core/types';
export { SURFACES, GLOBE_MODELS } from '../core/types';
