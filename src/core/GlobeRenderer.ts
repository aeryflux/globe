/**
 * GlobeRenderer - Platform-agnostic Three.js globe renderer
 *
 * Core rendering logic extracted from GlobeMinimal.
 * Used by both React (web) and React Native (Expo) wrappers.
 */

import * as THREE from 'three';
import type { GlobeConfig, GlobeIndex, SurfaceColors, MeshOriginalState } from './types';
import { SURFACES } from './types';

// City rendering constants
/** Base scale multiplier to make cities more visible */
export const CITY_BASE_SCALE = 3.0;
/** Base radial offset to position cities above countries */
export const CITY_BASE_OFFSET = 0.03;

/** Calculate mesh center from its geometry bounding box */
function getMeshCenter(mesh: THREE.Mesh): THREE.Vector3 {
  if (!mesh.geometry.boundingBox) {
    mesh.geometry.computeBoundingBox();
  }
  const center = new THREE.Vector3();
  if (mesh.geometry.boundingBox) {
    mesh.geometry.boundingBox.getCenter(center);
    center.applyMatrix4(mesh.matrixWorld);
  }
  return center;
}

export interface GlobeRendererOptions extends GlobeConfig {
  width: number;
  height: number;
  /** External renderer (for React Native/Expo) */
  renderer?: THREE.WebGLRenderer;
  /** Model URL or path */
  modelUrl: string;
}

/**
 * Build index of globe meshes for efficient lookups
 */
export function buildGlobeIndex(model: THREE.Object3D): GlobeIndex {
  const index: GlobeIndex = {
    allCountryMeshes: [],
    allBorderMeshes: [],
    allCityBorderMeshes: [],
    allCityMeshes: [],
    globeMesh: null,
    countryToBorder: new Map(),
    cityToBorder: new Map(),
    cityToCountry: new Map(),
    originalStates: new Map(),
  };

  // Update world matrices for accurate position calculation
  model.updateMatrixWorld(true);

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    const name = mesh.name || '';
    const nameLower = name.toLowerCase();

    // GlobeFill detection
    if (nameLower === 'globefill' || nameLower === 'atlasglobefill' || nameLower === 'weatherglobefill') {
      index.globeMesh = mesh;
      return;
    }

    // Country meshes
    if (nameLower.startsWith('country_') || nameLower.startsWith('cell_')) {
      index.allCountryMeshes.push(mesh);
      // Store original state for radial animation
      const center = getMeshCenter(mesh);
      const radialDir = center.clone().normalize();
      index.originalStates.set(mesh, {
        position: mesh.position.clone(),
        scale: mesh.scale.clone(),
        radialDirection: radialDir,
      });
      return;
    }

    // City borders (separate from country borders)
    if (nameLower.startsWith('border_city_')) {
      index.allCityBorderMeshes.push(mesh);
      // Extract city name from border_city_<country>_<city> pattern
      const borderPart = nameLower.replace('border_city_', '');
      const parts = borderPart.split('_');
      // City name is usually the last part
      const cityName = parts[parts.length - 1] || borderPart;
      // Store in array (multiple borders per city possible)
      const existing = index.cityToBorder.get(cityName) || [];
      existing.push(mesh);
      index.cityToBorder.set(cityName, existing);
      // Store original state for border animation
      const center = getMeshCenter(mesh);
      const radialDir = center.clone().normalize();
      index.originalStates.set(mesh, {
        position: mesh.position.clone(),
        scale: mesh.scale.clone(),
        radialDirection: radialDir,
      });
      return;
    }

    // Country/cell borders
    if (nameLower.startsWith('border_')) {
      index.allBorderMeshes.push(mesh);
      const borderPart = nameLower.replace('border_', '');
      const parts = borderPart.split('_');
      const lastPart = parts[parts.length - 1];
      const isIndex = /^\d+$/.test(lastPart);
      const countryName = isIndex ? parts.slice(0, -1).join('_') : borderPart;
      // Store in array (multiple borders per country)
      const existing = index.countryToBorder.get(countryName) || [];
      existing.push(mesh);
      index.countryToBorder.set(countryName, existing);
      // Store original state for border sync
      const center = getMeshCenter(mesh);
      const radialDir = center.clone().normalize();
      index.originalStates.set(mesh, {
        position: mesh.position.clone(),
        scale: mesh.scale.clone(),
        radialDirection: radialDir,
      });
      return;
    }

    // City meshes
    if (nameLower.startsWith('city_')) {
      index.allCityMeshes.push(mesh);
      const parts = nameLower.replace('city_', '').split('_');
      if (parts.length >= 3) {
        const countryName = parts[parts.length - 2];
        index.cityToCountry.set(mesh, countryName);
      } else if (parts.length >= 2) {
        const countryName = parts.slice(0, -1).join('_');
        if (countryName) index.cityToCountry.set(mesh, countryName);
      }
      // Store original state for city animation
      const center = getMeshCenter(mesh);
      const radialDir = center.clone().normalize();
      index.originalStates.set(mesh, {
        position: mesh.position.clone(),
        scale: mesh.scale.clone(),
        radialDirection: radialDir,
      });
    }
  });

  return index;
}

/**
 * Get surface colors from config
 */
export function getSurfaceColors(config: GlobeConfig): SurfaceColors {
  const surface = config.surface || 'green';
  const baseColors = SURFACES[surface];

  return {
    accent: config.borderColor || baseColors.accent,
    background: baseColors.background,
    countryColor: config.countryColor || baseColors.countryColor,
    globeFillColor: config.globeFillColor || baseColors.globeFillColor,
  };
}

/**
 * Apply materials to globe model
 */
export function applyGlobeMaterials(
  model: THREE.Object3D,
  index: GlobeIndex,
  colors: SurfaceColors,
  config: GlobeConfig
): void {
  const { showCountries = false, showCities = false, glowIntensity = 0.6, countryData, dataHighlightColor } = config;

  // Build country data lookup (lowercase, normalized)
  const countryDataMap = new Map<string, { scale: number; color?: string }>();
  if (countryData) {
    for (const [name, data] of Object.entries(countryData)) {
      countryDataMap.set(name.toLowerCase().replace(/\s+/g, '_'), data);
      countryDataMap.set(name.toLowerCase().replace(/\s+/g, ''), data);
      countryDataMap.set(name.toLowerCase(), data);
    }
  }
  const hasData = countryDataMap.size > 0;
  const highlightColor = dataHighlightColor || colors.accent;

  // Configure GlobeFill (ocean)
  if (index.globeMesh) {
    index.globeMesh.visible = showCountries;
    if (showCountries) {
      index.globeMesh.material = new THREE.MeshStandardMaterial({
        color: colors.globeFillColor,
        emissive: new THREE.Color(colors.globeFillColor).multiplyScalar(0.1),
        emissiveIntensity: 0.1,
        metalness: 0.1,
        roughness: 0.8,
        side: THREE.FrontSide,
      });
      index.globeMesh.renderOrder = -1;
    }
  }

  // Configure countries
  for (const mesh of index.allCountryMeshes) {
    mesh.visible = showCountries;
    if (showCountries) {
      // Extract country name from mesh
      const meshName = mesh.name.toLowerCase();
      let baseName = '';
      if (meshName.startsWith('country_')) baseName = meshName.replace('country_', '');
      else if (meshName.startsWith('cell_')) baseName = meshName.replace('cell_', '');

      // Remove trailing index
      const parts = baseName.split('_');
      const lastPart = parts[parts.length - 1];
      const isIndex = /^\d+$/.test(lastPart);
      const countryName = isIndex ? parts.slice(0, -1).join('_') : baseName;

      // Check if country has data highlight
      const matchedData = countryDataMap.get(countryName) || countryDataMap.get(countryName.replace(/_/g, ''));

      if (hasData && matchedData) {
        // Highlighted country - material only, position handled by animateDataHighlights
        const color = new THREE.Color(matchedData.color || highlightColor);
        mesh.material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.3 + matchedData.scale * 0.3,
          metalness: 0.2,
          roughness: 0.5,
          side: THREE.DoubleSide,
        });
        // Position is handled by animateDataHighlights in render loop
      } else if (hasData) {
        // Dimmed country (when data is active)
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(colors.countryColor).multiplyScalar(0.4),
          emissive: new THREE.Color(colors.countryColor).multiplyScalar(0.05),
          emissiveIntensity: 0.1,
          metalness: 0.1,
          roughness: 0.7,
          side: THREE.DoubleSide,
        });
      } else {
        // Normal country (no data)
        mesh.material = new THREE.MeshStandardMaterial({
          color: colors.countryColor,
          emissive: new THREE.Color(colors.countryColor).multiplyScalar(0.1),
          emissiveIntensity: 0.15,
          metalness: 0.1,
          roughness: 0.6,
          side: THREE.DoubleSide,
        });
      }
    }
  }

  // Build city data lookup if provided
  const { cityData } = config;
  const cityDataMap = new Map<string, { scale: number; color?: string }>();
  if (cityData) {
    for (const [name, data] of Object.entries(cityData)) {
      cityDataMap.set(name.toLowerCase().replace(/\s+/g, '_'), data);
      cityDataMap.set(name.toLowerCase().replace(/\s+/g, ''), data);
      cityDataMap.set(name.toLowerCase(), data);
    }
  }
  const hasCityData = cityDataMap.size > 0;

  // Configure cities
  for (const mesh of index.allCityMeshes) {
    mesh.visible = showCities;
    if (showCities) {
      // Apply base scale and radial offset
      const originalState = index.originalStates.get(mesh);
      if (originalState) {
        mesh.scale.copy(originalState.scale).multiplyScalar(CITY_BASE_SCALE);
        mesh.position.copy(originalState.position)
          .addScaledVector(originalState.radialDirection, CITY_BASE_OFFSET);
      }

      // Extract city name from mesh
      const meshName = mesh.name.toLowerCase();
      const cityPart = meshName.replace('city_', '');
      const parts = cityPart.split('_');
      // City name is usually the last part after country code
      const cityName = parts[parts.length - 1] || cityPart;

      // Check if city has data highlight
      const matchedData = cityDataMap.get(cityName) || cityDataMap.get(cityPart);

      if (hasCityData && matchedData) {
        // Highlighted city
        const color = new THREE.Color(matchedData.color || highlightColor);
        mesh.material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.4 + matchedData.scale * 0.4,
          metalness: 0.3,
          roughness: 0.4,
          side: THREE.DoubleSide,
        });
      } else if (hasCityData) {
        // Dimmed city (when data is active)
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(colors.countryColor).multiplyScalar(0.3),
          emissive: new THREE.Color(colors.countryColor).multiplyScalar(0.03),
          emissiveIntensity: 0.1,
          metalness: 0.1,
          roughness: 0.7,
          side: THREE.DoubleSide,
        });
      } else {
        // Normal city (no data)
        mesh.material = new THREE.MeshStandardMaterial({
          color: colors.countryColor,
          emissive: new THREE.Color(colors.countryColor).multiplyScalar(0.1),
          emissiveIntensity: 0.15,
          metalness: 0.1,
          roughness: 0.6,
          side: THREE.DoubleSide,
        });
      }
    }
  }

  // Configure city borders
  for (const mesh of index.allCityBorderMeshes) {
    mesh.visible = showCities;
    if (showCities) {
      // Apply base radial offset to match city position
      const originalState = index.originalStates.get(mesh);
      if (originalState) {
        mesh.position.copy(originalState.position)
          .addScaledVector(originalState.radialDirection, CITY_BASE_OFFSET);
      }

      // Extract city name from border
      const meshName = mesh.name.toLowerCase();
      const borderPart = meshName.replace('border_city_', '');
      const parts = borderPart.split('_');
      const cityName = parts[parts.length - 1] || borderPart;

      // Check if city has data highlight
      const matchedData = cityDataMap.get(cityName) || cityDataMap.get(borderPart);

      if (hasCityData && matchedData) {
        // Highlighted city border
        const color = new THREE.Color(matchedData.color || highlightColor);
        mesh.material = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: glowIntensity * (1.0 + matchedData.scale * 0.5),
          metalness: 0.3,
          roughness: 0.4,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
        });
      } else if (hasCityData) {
        // Dimmed city border (when data is active)
        mesh.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(colors.accent).multiplyScalar(0.2),
          emissive: new THREE.Color(colors.accent).multiplyScalar(0.05),
          emissiveIntensity: glowIntensity * 0.2,
          metalness: 0.2,
          roughness: 0.5,
          transparent: true,
          opacity: 0.4,
          side: THREE.DoubleSide,
        });
      } else {
        // Normal city border (no data)
        mesh.material = new THREE.MeshStandardMaterial({
          color: colors.accent,
          emissive: colors.accent,
          emissiveIntensity: glowIntensity * 0.4,
          metalness: 0.3,
          roughness: 0.4,
          transparent: true,
          opacity: 0.75,
          side: THREE.DoubleSide,
        });
      }
    }
  }

  // Configure country borders with subtle glow
  for (const mesh of index.allBorderMeshes) {
    mesh.visible = true;
    mesh.material = new THREE.MeshStandardMaterial({
      color: colors.accent,
      emissive: colors.accent,
      emissiveIntensity: glowIntensity * 0.5,
      metalness: 0.3,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
  }
}

/**
 * Create globe scene with lighting
 */
export function createGlobeScene(colors: SurfaceColors): THREE.Scene {
  const scene = new THREE.Scene();

  // Ambient light (reduced)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  // Main directional light (reduced)
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(2, 2, 5);
  scene.add(directionalLight);

  // Fill light (reduced)
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-2, -1, 3);
  scene.add(fillLight);

  // Accent point light (subtle)
  const pointLight = new THREE.PointLight(colors.accent, 0.4, 15);
  pointLight.position.set(0, 0, 4);
  scene.add(pointLight);

  return scene;
}

/**
 * Create camera with responsive positioning
 */
export function createGlobeCamera(width: number, height: number): THREE.PerspectiveCamera {
  const getResponsiveCameraZ = (w: number): number => {
    if (w < 480) return 5.5;   // Mobile
    if (w < 768) return 5.0;   // Small tablet
    if (w < 1024) return 4.5;  // Tablet
    return 4.0;                 // Desktop
  };

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 0, getResponsiveCameraZ(width));
  return camera;
}

/**
 * Animate globe rotation
 */
export function animateGlobeRotation(
  model: THREE.Object3D,
  time: number,
  rotationSpeed: number = 0.0003
): void {
  model.rotation.y += rotationSpeed * 3;
  model.rotation.x = Math.sin(time * 0.3) * 0.08;
  model.rotation.z = Math.sin(time * 0.2) * 0.03;
}

/**
 * Animate border pulse (subtle)
 */
export function animateBorderPulse(
  index: GlobeIndex,
  time: number,
  glowIntensity: number = 0.5
): void {
  const pulse = 0.85 + 0.15 * Math.sin(time * 1.2);
  for (const mesh of index.allBorderMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat.isMeshStandardMaterial) {
      mat.emissiveIntensity = glowIntensity * pulse * 0.5;
    }
  }
}

/** Data highlight state for animation */
export interface DataHighlightState {
  mesh: THREE.Mesh;
  borderMeshes: THREE.Mesh[];
  intensity: number;
  color: string;
  startTime: number;
}

/** City highlight state for animation */
export interface CityHighlightState {
  mesh: THREE.Mesh;
  borderMeshes: THREE.Mesh[];
  intensity: number;
  color: string;
  startTime: number;
}

/**
 * Animate data-driven country highlights with radial displacement
 * Call this in your render loop for smooth animations
 */
export function animateDataHighlights(
  index: GlobeIndex,
  highlights: Map<string, DataHighlightState>,
  time: number,
  glowIntensity: number = 0.5
): void {
  for (const [, data] of highlights) {
    const mat = data.mesh.material as THREE.MeshStandardMaterial;
    if (!mat.isMeshStandardMaterial) continue;

    const originalState = index.originalStates.get(data.mesh);
    if (!originalState) continue;

    // Time since this highlight started
    const timeSinceStart = time - data.startTime;

    // Entry animation (0-0.5s): ease in
    const entryDelay = (1 - data.intensity) * 0.3;
    const entryProgress = Math.min(1, Math.max(0, (timeSinceStart - entryDelay) / 0.4));
    const entryEase = 1 - Math.pow(1 - entryProgress, 3); // ease-out cubic

    // Breathing pulse (continuous)
    const breathingSpeed = 1.5 + data.intensity * 0.5;
    const breathingPulse = 0.85 + 0.15 * Math.sin(time * breathingSpeed);

    // Radial displacement - move country outward from globe center
    const baseDisplacement = data.intensity * 0.06;
    const animatedDisplacement = baseDisplacement * entryEase * breathingPulse;

    // Apply position offset along radial direction
    data.mesh.position.copy(originalState.position)
      .addScaledVector(originalState.radialDirection, animatedDisplacement);

    // Keep original scale
    data.mesh.scale.copy(originalState.scale);

    // Emissive intensity pulse
    const baseEmissive = 0.3 + data.intensity * 0.4;
    mat.emissiveIntensity = baseEmissive * breathingPulse * (0.5 + entryProgress * 0.5);

    // Make ALL borders follow with their OWN radial direction
    for (const borderMesh of data.borderMeshes) {
      const borderOriginal = index.originalStates.get(borderMesh);
      if (borderOriginal) {
        // Apply displacement using BORDER's own radial direction
        borderMesh.position.copy(borderOriginal.position)
          .addScaledVector(borderOriginal.radialDirection, animatedDisplacement);
        borderMesh.scale.copy(borderOriginal.scale);
      }

      const borderMat = borderMesh.material as THREE.MeshStandardMaterial;
      if (borderMat.isMeshStandardMaterial) {
        borderMat.color.set(data.color);
        borderMat.emissive.set(data.color);
        borderMat.emissiveIntensity = glowIntensity * (1.5 + data.intensity) * breathingPulse;
      }
    }
  }
}

/**
 * Animate city highlights with subtle pulse effect
 * Call this in your render loop for smooth animations
 */
export function animateCityHighlights(
  index: GlobeIndex,
  highlights: Map<string, CityHighlightState>,
  time: number,
  glowIntensity: number = 0.5
): void {
  for (const [, data] of highlights) {
    const mat = data.mesh.material as THREE.MeshStandardMaterial;
    if (!mat.isMeshStandardMaterial) continue;

    const originalState = index.originalStates.get(data.mesh);
    if (!originalState) continue;

    // Time since this highlight started
    const timeSinceStart = time - data.startTime;

    // Entry animation (0-0.3s): ease in
    const entryDelay = (1 - data.intensity) * 0.2;
    const entryProgress = Math.min(1, Math.max(0, (timeSinceStart - entryDelay) / 0.3));
    const entryEase = 1 - Math.pow(1 - entryProgress, 3); // ease-out cubic

    // Breathing pulse (continuous, faster than countries)
    const breathingSpeed = 2.0 + data.intensity * 0.8;
    const breathingPulse = 0.8 + 0.2 * Math.sin(time * breathingSpeed);

    // Scale animation - cities grow slightly on top of base scale
    const highlightScale = 1 + data.intensity * 0.3;
    const animatedScale = CITY_BASE_SCALE * (1 + (highlightScale - 1) * entryEase * breathingPulse);
    data.mesh.scale.copy(originalState.scale).multiplyScalar(animatedScale);

    // Radial displacement - cities pop out slightly on top of base offset
    const highlightDisplacement = data.intensity * 0.03;
    const animatedDisplacement = CITY_BASE_OFFSET + highlightDisplacement * entryEase * breathingPulse;
    data.mesh.position.copy(originalState.position)
      .addScaledVector(originalState.radialDirection, animatedDisplacement);

    // Emissive intensity pulse
    const baseEmissive = 0.4 + data.intensity * 0.5;
    mat.emissiveIntensity = baseEmissive * breathingPulse * (0.5 + entryProgress * 0.5);

    // Animate city borders with same displacement (already includes base offset)
    for (const borderMesh of data.borderMeshes) {
      const borderOriginal = index.originalStates.get(borderMesh);
      if (borderOriginal) {
        // Apply displacement using border's own radial direction (includes base offset)
        borderMesh.position.copy(borderOriginal.position)
          .addScaledVector(borderOriginal.radialDirection, animatedDisplacement);
        borderMesh.scale.copy(borderOriginal.scale);
      }

      const borderMat = borderMesh.material as THREE.MeshStandardMaterial;
      if (borderMat.isMeshStandardMaterial) {
        borderMat.color.set(data.color);
        borderMat.emissive.set(data.color);
        borderMat.emissiveIntensity = glowIntensity * (1.2 + data.intensity) * breathingPulse;
      }
    }
  }
}

/**
 * Reset mesh to original state (for clearing highlights)
 */
export function resetMeshState(mesh: THREE.Mesh, index: GlobeIndex): void {
  const originalState = index.originalStates.get(mesh);
  if (originalState) {
    mesh.position.copy(originalState.position);
    mesh.scale.copy(originalState.scale);
  }
}

/**
 * Reset all country meshes to original state
 */
export function resetAllCountries(index: GlobeIndex): void {
  for (const mesh of index.allCountryMeshes) {
    resetMeshState(mesh, index);
  }
  for (const mesh of index.allBorderMeshes) {
    resetMeshState(mesh, index);
  }
}

/**
 * Reset a city mesh to base state (with base scale and offset)
 */
function resetCityMeshState(mesh: THREE.Mesh, index: GlobeIndex, isCity: boolean): void {
  const originalState = index.originalStates.get(mesh);
  if (originalState) {
    // Restore position with base offset
    mesh.position.copy(originalState.position)
      .addScaledVector(originalState.radialDirection, CITY_BASE_OFFSET);
    // Restore scale with base multiplier (only for city meshes, not borders)
    if (isCity) {
      mesh.scale.copy(originalState.scale).multiplyScalar(CITY_BASE_SCALE);
    } else {
      mesh.scale.copy(originalState.scale);
    }
  }
}

/**
 * Reset all city meshes to base state (with base scale and offset)
 */
export function resetAllCities(index: GlobeIndex): void {
  for (const mesh of index.allCityMeshes) {
    resetCityMeshState(mesh, index, true);
  }
  for (const mesh of index.allCityBorderMeshes) {
    resetCityMeshState(mesh, index, false);
  }
}
