/**
 * GlobeRenderer - Platform-agnostic Three.js globe renderer
 *
 * Core rendering logic extracted from GlobeMinimal.
 * Used by both React (web) and React Native (Expo) wrappers.
 */

import * as THREE from 'three';
import type { GlobeConfig, GlobeIndex, SurfaceColors } from './types';
import { SURFACES } from './types';

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
    cityToCountry: new Map(),
  };

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
      return;
    }

    // City borders (separate from country borders)
    if (nameLower.startsWith('border_city_')) {
      index.allCityBorderMeshes.push(mesh);
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
      index.countryToBorder.set(countryName, mesh);
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
  const { showCountries = false, showCities = false, glowIntensity = 1.2 } = config;

  // Configure GlobeFill (ocean)
  if (index.globeMesh) {
    index.globeMesh.visible = showCountries;
    if (showCountries) {
      index.globeMesh.material = new THREE.MeshStandardMaterial({
        color: colors.globeFillColor,
        emissive: new THREE.Color(colors.globeFillColor).multiplyScalar(0.2),
        emissiveIntensity: 0.3,
        metalness: 0.2,
        roughness: 0.7,
        side: THREE.FrontSide,
      });
      index.globeMesh.renderOrder = -1;
    }
  }

  // Configure countries
  for (const mesh of index.allCountryMeshes) {
    mesh.visible = showCountries;
    if (showCountries) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: colors.countryColor,
        emissive: new THREE.Color(colors.countryColor).multiplyScalar(0.4),
        emissiveIntensity: 0.6,
        metalness: 0.1,
        roughness: 0.5,
        side: THREE.DoubleSide,
        flatShading: false,
      });
    }
  }

  // Configure cities
  for (const mesh of index.allCityMeshes) {
    mesh.visible = showCities;
    if (showCities) {
      mesh.material = new THREE.MeshStandardMaterial({
        color: colors.countryColor,
        emissive: new THREE.Color(colors.countryColor).multiplyScalar(0.4),
        emissiveIntensity: 0.6,
        metalness: 0.1,
        roughness: 0.5,
        side: THREE.DoubleSide,
      });
    }
  }

  // Hide city borders
  for (const mesh of index.allCityBorderMeshes) {
    mesh.visible = false;
  }

  // Configure country borders with glow
  for (const mesh of index.allBorderMeshes) {
    mesh.visible = true;
    mesh.material = new THREE.MeshStandardMaterial({
      color: colors.accent,
      emissive: colors.accent,
      emissiveIntensity: glowIntensity,
      metalness: 0.8,
      roughness: 0.2,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    });
  }
}

/**
 * Create globe scene with lighting
 */
export function createGlobeScene(colors: SurfaceColors): THREE.Scene {
  const scene = new THREE.Scene();

  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);

  // Main directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
  directionalLight.position.set(2, 2, 5);
  scene.add(directionalLight);

  // Fill light
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
  fillLight.position.set(-2, -1, 3);
  scene.add(fillLight);

  // Accent point light
  const pointLight = new THREE.PointLight(colors.accent, 1.2, 20);
  pointLight.position.set(0, 0, 5);
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
 * Animate border pulse
 */
export function animateBorderPulse(
  index: GlobeIndex,
  time: number,
  glowIntensity: number = 1.2
): void {
  const pulse = 0.9 + 0.3 * Math.sin(time * 1.5);
  for (const mesh of index.allBorderMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (mat.isMeshStandardMaterial) {
      mat.emissiveIntensity = glowIntensity * pulse;
    }
  }
}
