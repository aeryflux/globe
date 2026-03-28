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
  /** Extrusion level (0-1) for data-driven displacement (defaults to scale) */
  extrusion?: number;
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
  /** Extrusion level (0-1) for data-driven displacement (defaults to scale) */
  extrusion?: number;
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
    accent: '#00ff88',
    background: '#050508',
    countryColor: '#e0e0e0',
    globeFillColor: '#06060e',
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
  /** Enable mouse/touch drag rotation + click-to-select (default: false) */
  enableControls?: boolean;
  /** Bloom strength for post-processing (default: 1.0) */
  bloomStrength?: number;
  /** Show country fills (default: true) */
  showCountries?: boolean;
  /** Show border lines (default: true) */
  showBorders?: boolean;
  /** Show globe fill / ocean (default: true) */
  showGlobeFill?: boolean;
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

  // ── Dance Mode ──
  /** Ambient wave accent color (default: surface accent) */
  ambientColor?: string;
  /** Ambient wave intensity (0-1, default: 0.4) */
  ambientIntensity?: number;
  /** Music reactivity: bass level (0-1.5) */
  bass?: number;
  /** Music reactivity: mid level (0-1) */
  mid?: number;
  /** Music reactivity: treble level (0-1) */
  treble?: number;
  /** Music reactivity: energy level (0-1) */
  energy?: number;
  /** Gradient top color (default: #06060e) */
  gradientTop?: string;
  /** Gradient bottom color (default: #0e1430) */
  gradientBottom?: string;
  /** Dynamic globe fill tint (overrides globeFillColor in real-time) */
  globeFillTint?: string;
  /** Country data for data-driven visualization */
  countryData?: CountryDataMap;
  /** Accent color for data highlights */
  dataHighlightColor?: string;

  // ── Intro Animation ──
  /** Enable entry animation: globe spins in from the left (default: false) */
  introAnimation?: boolean;
  /** Intro duration in seconds (default: 2.5) */
  introDuration?: number;
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
  /** Mobile-optimized hex globe (2MB) */
  ATLAS_HEX_5: 'atlas_hex_subdiv_5.glb',
  /** Desktop hex globe (7MB) */
  ATLAS_HEX_6: 'atlas_hex_subdiv_6.glb',
  /** High quality hex globe (20MB) */
  ATLAS_HEX_7: 'atlas_hex_subdiv_7.glb',
  /** Mobile weather globe */
  WEATHER_HEX_3: 'weather_hex_globe_subdiv_3.glb',
} as const;
