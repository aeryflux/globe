/**
 * Globe Types
 * Platform-agnostic type definitions for the globe component
 */

import type * as THREE from 'three';

/** Surface theme IDs */
export type SurfaceId = 'dark' | 'green' | 'white';

/** Country highlight data for data-driven visualization */
export interface CountryHighlight {
  /** Normalized intensity (0-1) for visualization scaling */
  scale: number;
  /** Optional custom highlight color */
  color?: string;
  /** Optional latitude for positioning */
  lat?: number | null;
  /** Optional longitude for positioning */
  lon?: number | null;
}

/** Map of country names to highlight data */
export type CountryDataMap = Record<string, CountryHighlight>;

/** City highlight data for data-driven visualization */
export interface CityHighlight {
  /** Normalized intensity (0-1) for visualization scaling */
  scale: number;
  /** Optional custom highlight color */
  color?: string;
  /** City name for display */
  name?: string;
}

/** Map of city IDs to highlight data */
export type CityDataMap = Record<string, CityHighlight>;

/** Surface color configuration */
export interface SurfaceColors {
  /** Border/accent color */
  accent: string;
  /** Background color */
  background: string;
  /** Country fill color */
  countryColor: string;
  /** Globe fill (ocean) color */
  globeFillColor: string;
}

/** Predefined surface themes */
export const SURFACES: Record<SurfaceId, SurfaceColors> = {
  dark: {
    accent: '#ffffff',
    background: '#050508',
    countryColor: '#c0c0c0',
    globeFillColor: '#0a0a0f',
  },
  green: {
    accent: '#00ff88',
    background: '#050508',
    countryColor: '#c0c0c0',
    globeFillColor: '#0a0a0f',
  },
  white: {
    accent: '#1a1a1a',
    background: '#ffffff',
    countryColor: '#a0a0a0',
    globeFillColor: '#f0f0f0',
  },
};

/** Globe configuration options */
export interface GlobeConfig {
  /** Surface theme */
  surface?: SurfaceId;
  /** Custom border color (overrides surface) */
  borderColor?: string;
  /** Glow intensity (default: 1.2) */
  glowIntensity?: number;
  /** Rotation speed (default: 0.0003) */
  rotationSpeed?: number;
  /** Enable mouse/touch drag rotation (default: false) */
  enableControls?: boolean;
  /** Bloom strength for post-processing (default: 1.0) */
  bloomStrength?: number;
  /** Show country fills (default: false for border-only) */
  showCountries?: boolean;
  /** Custom country color (overrides surface) */
  countryColor?: string;
  /** Custom globe fill color (overrides surface) */
  globeFillColor?: string;
  /** Show city markers (default: false) */
  showCities?: boolean;
  /** City data for data-driven visualization */
  cityData?: CityDataMap;
  /** Light theme mode - reduces bloom */
  isLightTheme?: boolean;
  /** Force transparent background */
  forceTransparent?: boolean;
  /** Country data for data-driven visualization */
  countryData?: CountryDataMap;
  /** Accent color for data highlights */
  dataHighlightColor?: string;
}

/** Original mesh state for animations (stored before any transforms) */
export interface MeshOriginalState {
  position: THREE.Vector3;
  scale: THREE.Vector3;
  /** Direction from globe center to mesh center (normalized) */
  radialDirection: THREE.Vector3;
}

/** Globe mesh index for efficient lookups */
export interface GlobeIndex {
  allCountryMeshes: THREE.Mesh[];
  allBorderMeshes: THREE.Mesh[];
  allCityBorderMeshes: THREE.Mesh[];
  allCityMeshes: THREE.Mesh[];
  globeMesh: THREE.Mesh | null;
  countryToBorder: Map<string, THREE.Mesh[]>;
  cityToBorder: Map<string, THREE.Mesh[]>;
  cityToCountry: Map<THREE.Mesh, string>;
  /** Original mesh states for animation reset */
  originalStates: Map<THREE.Mesh, MeshOriginalState>;
}

/** WebGL support check result */
export interface WebGLSupportResult {
  supported: boolean;
  checked: boolean;
  error?: string;
}

/** Model subdivision levels */
export type SubdivisionLevel = 3 | 5 | 6 | 7;

/** Available globe models */
export const GLOBE_MODELS = {
  /** Mobile-optimized hex globe */
  ATLAS_HEX_5: 'atlas_hex_subdiv_5.glb',
  /** Desktop hex globe */
  ATLAS_HEX_6: 'atlas_hex_subdiv_6.glb',
  /** Mobile weather globe */
  WEATHER_HEX_3: 'weather_hex_globe_subdiv_3.glb',
  /** Desktop weather globe */
  WEATHER_HEX_5: 'weather_hex_globe_subdiv_5.glb',
} as const;
