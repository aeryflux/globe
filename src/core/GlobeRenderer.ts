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
/** Base scale multiplier for runtime adjustment */
export const CITY_BASE_SCALE = 1.0;
/** Base radial offset for runtime adjustment */
export const CITY_BASE_OFFSET = 0.0;

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

    // GlobeFill detection — match any mesh containing "globefill" or "globe_fill"
    if (nameLower === 'globefill' || nameLower === 'atlasglobefill' || nameLower === 'weatherglobefill' ||
        nameLower.includes('globefill') || nameLower.includes('globe_fill')) {
      index.globeMesh = mesh;
      return;
    }

    // Country meshes (with prefix or Natural Earth format like "France_0")
    const isCountryMesh = nameLower.startsWith('country_') ||
                          nameLower.startsWith('cell_') ||
                          // Natural Earth GLB format: "CountryName_N" where N is index
                          (/^[a-z].*_\d+$/.test(nameLower) &&
                           !nameLower.startsWith('border_') &&
                           !nameLower.startsWith('city_'));
    if (isCountryMesh) {
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
      // Extract city name from border patterns:
      // subdiv_7: border_city_{CityName}_{ID} (e.g., border_city_Paris_19)
      // subdiv_6: border_city_{Country}_{CityName}_{ID} (e.g., border_city_France_Paris_42)
      const borderPart = nameLower.replace('border_city_', '');
      const parts = borderPart.split('_');
      const lastPart = parts[parts.length - 1];
      const hasNumericId = /^\d+$/.test(lastPart);

      let cityNameFull = '';
      let cityNameShort = '';

      // Simple format: border_city_{CityName}_{ID} (subdiv_7)
      if (hasNumericId && parts.length === 2) {
        cityNameFull = parts[0];
        cityNameShort = parts[0];
      }
      // Complex format: border_city_{Country}_{CityName}_{ID} (subdiv_6)
      else if (hasNumericId && parts.length >= 3) {
        // All parts except first (country) and last (ID)
        cityNameFull = parts.slice(1, -1).join('_');
        // Just second-to-last part (single word city)
        cityNameShort = parts[parts.length - 2];
      }
      // Fallback
      else {
        cityNameFull = borderPart;
        cityNameShort = parts[parts.length - 1] || borderPart;
      }

      // Store under both names for flexible matching
      if (cityNameFull) {
        const existing1 = index.cityToBorder.get(cityNameFull) || [];
        existing1.push(mesh);
        index.cityToBorder.set(cityNameFull, existing1);
      }

      // Also store under short name if different
      if (cityNameShort && cityNameShort !== cityNameFull) {
        const existing2 = index.cityToBorder.get(cityNameShort) || [];
        existing2.push(mesh);
        index.cityToBorder.set(cityNameShort, existing2);
      }
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

  // Debug: log index stats
  console.log(`[Globe] Index: ${index.allCountryMeshes.length} countries, ${index.allBorderMeshes.length} borders, ${index.allCityMeshes.length} cities, globeFill: ${!!index.globeMesh}`);

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
  const { showCountries = true, showBorders = true, showGlobeFill = true, showCities = false, glowIntensity = 0.6, countryData, dataHighlightColor } = config;

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
    index.globeMesh.visible = showGlobeFill;
    if (showGlobeFill) {
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
      let baseName = meshName;
      if (meshName.startsWith('country_')) baseName = meshName.replace('country_', '');
      else if (meshName.startsWith('cell_')) baseName = meshName.replace('cell_', '');
      // Natural Earth format already has correct base name

      // Remove trailing index (e.g., "france_0" -> "france")
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
    mesh.visible = showBorders;
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

/** Scene refs for real-time updates */
export interface SceneRefs {
  scene: THREE.Scene;
  bgMaterial: THREE.ShaderMaterial;
  accentLight: THREE.PointLight;
}

/**
 * Create globe scene with lighting
 */
export function createGlobeScene(colors: SurfaceColors, gradientTop?: string, gradientBottom?: string): SceneRefs {
  const scene = new THREE.Scene();
  // Gradient background (top: dark, bottom: deep blue)
  const bgGeometry = new THREE.PlaneGeometry(2, 2);
  const bgMaterial = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: {
      colorTop: { value: new THREE.Color(gradientTop || '#06060e') },
      colorBottom: { value: new THREE.Color(gradientBottom || '#0e1430') },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 colorTop;
      uniform vec3 colorBottom;
      varying vec2 vUv;
      void main() {
        gl_FragColor = vec4(mix(colorBottom, colorTop, vUv.y), 1.0);
      }
    `,
  });
  const bgMesh = new THREE.Mesh(bgGeometry, bgMaterial);
  bgMesh.renderOrder = -1;
  bgMesh.frustumCulled = false;
  scene.add(bgMesh);

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
  const accentLight = new THREE.PointLight(colors.accent, 0.4, 15);
  accentLight.position.set(0, 0, 4);
  scene.add(accentLight);

  return { scene, bgMaterial, accentLight };
}

// Reusable color objects for lerp (avoid GC)
const _lerpColorA = new THREE.Color();
const _lerpColorB = new THREE.Color();

/**
 * Smoothly update gradient background uniforms
 */
export function updateGradient(
  bgMaterial: THREE.ShaderMaterial,
  targetTop: string,
  targetBottom: string,
  lerpFactor: number = 0.03
): void {
  const topUniform = bgMaterial.uniforms.colorTop.value as THREE.Color;
  const bottomUniform = bgMaterial.uniforms.colorBottom.value as THREE.Color;
  _lerpColorA.set(targetTop);
  _lerpColorB.set(targetBottom);
  topUniform.lerp(_lerpColorA, lerpFactor);
  bottomUniform.lerp(_lerpColorB, lerpFactor);
}

/**
 * Smoothly update globe fill (ocean) tint in real-time
 */
export function updateGlobeFillTint(
  index: GlobeIndex,
  targetColor: string,
  lerpFactor: number = 0.03
): void {
  if (!index.globeMesh) return;
  const mat = index.globeMesh.material as THREE.MeshStandardMaterial;
  if (!mat.isMeshStandardMaterial) return;
  _lerpColorA.set(targetColor);
  mat.color.lerp(_lerpColorA, lerpFactor);
  mat.emissive.lerp(_lerpColorA.multiplyScalar(0.1), lerpFactor);
}

/**
 * Update accent point light color
 */
export function updateAccentLight(
  accentLight: THREE.PointLight,
  targetColor: string,
  lerpFactor: number = 0.03
): void {
  _lerpColorA.set(targetColor);
  accentLight.color.lerp(_lerpColorA, lerpFactor);
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
 * Intro animation state
 */
export interface IntroState {
  /** Whether intro is active */
  active: boolean;
  /** Start time of intro */
  startTime: number;
  /** Duration in seconds */
  duration: number;
  /** Starting X offset (world units, negative = left) */
  startX: number;
  /** Extra spin rotations during intro */
  spinRevolutions: number;
}

/**
 * Create intro animation state
 */
export function createIntroState(startTime: number, duration: number = 2.5): IntroState {
  return {
    active: true,
    startTime,
    duration,
    startX: -8,
    spinRevolutions: 2,
  };
}

/**
 * Apply intro animation to model. Returns true while active.
 */
export function applyIntroAnimation(
  model: THREE.Object3D,
  time: number,
  intro: IntroState
): boolean {
  if (!intro.active) return false;

  const elapsed = time - intro.startTime;
  const progress = Math.min(1, elapsed / intro.duration);

  if (progress >= 1) {
    intro.active = false;
    model.position.x = 0;
    return false;
  }

  // Ease out cubic: fast start, smooth deceleration
  const ease = 1 - Math.pow(1 - progress, 3);

  // Slide from startX to 0
  model.position.x = intro.startX * (1 - ease);

  // Extra spin during entry (added on top of normal rotation)
  const spinEase = 1 - Math.pow(1 - progress, 2);
  model.rotation.y += (intro.spinRevolutions * Math.PI * 2 * (1 - spinEase)) * 0.016 / intro.duration;

  return true;
}

/**
 * Animate globe rotation
 */
export function animateGlobeRotation(
  model: THREE.Object3D,
  time: number,
  rotationSpeed: number = 0.0003,
  bass: number = 0,
  energy: number = 0
): void {
  // Base rotation + music boost
  model.rotation.y += rotationSpeed * 3 + Math.pow(bass, 1.5) * 0.02 + energy * 0.003;
  model.rotation.x = Math.sin(time * 0.3) * (0.08 + bass * 0.04);
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

// Reusable vectors for ambient wave
const _waveDir1 = new THREE.Vector3();
const _waveDir2 = new THREE.Vector3();
const _meshCenter = new THREE.Vector3();
const _emissiveColor = new THREE.Color();

/**
 * Animate ambient wave illumination on idle countries.
 * Two slow waves sweep across the globe for organic glow.
 */
export function animateAmbientWave(
  index: GlobeIndex,
  time: number,
  accentColor: string = '#00ff88',
  intensity: number = 0.4,
  bass: number = 0,
  energy: number = 0,
  extrusion: number = 0
): void {
  // Speed scales with bass/energy for music reactivity
  const speedMult = 1 + bass * 0.5 + energy * 0.3;
  const intensityMult = 1 + bass * 1.5 + energy * 0.5;

  // Two rotating wave directions
  const t = time * 0.04 * speedMult;
  _waveDir1.set(Math.cos(t), 0.2, Math.sin(t)).normalize();
  _waveDir2.set(Math.sin(t * 0.7 + 2), 0.2, Math.cos(t * 0.7 + 2)).normalize();

  const phase1 = (time * 0.1 * speedMult) % 1;
  const phase2 = ((time * 0.07 * speedMult) + 0.5) % 1;
  const front1 = -1 + phase1 * 2;
  const front2 = -1 + phase2 * 2;
  const waveWidth = 0.6;
  const halfW2 = 2 * waveWidth * waveWidth;

  // Breathe
  const breathe = (Math.sin(time * 0.25 * Math.PI * 2) + 1) * 0.5 * 0.12;

  _emissiveColor.set(accentColor);
  const aR = _emissiveColor.r;
  const aG = _emissiveColor.g;
  const aB = _emissiveColor.b;

  for (const mesh of index.allCountryMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat.isMeshStandardMaterial) continue;

    // Use cached radialDirection from originalStates (no per-frame bbox computation)
    const originalState = index.originalStates.get(mesh);
    if (!originalState) continue;
    const rd = originalState.radialDirection;

    const proj1 = rd.dot(_waveDir1);
    const dist1 = proj1 - front1;
    const i1 = Math.exp(-(dist1 * dist1) / halfW2);

    const proj2 = rd.dot(_waveDir2);
    const dist2 = proj2 - front2;
    const i2 = Math.exp(-(dist2 * dist2) / halfW2);

    const combined = Math.min(1, i1 * 0.6 + i2 * 0.5 + breathe);

    // Emissive glow
    const colorBoost = combined * 0.2 * intensityMult;
    mat.emissive.setRGB(
      aR * (0.03 + colorBoost),
      aG * (0.03 + colorBoost),
      aB * (0.03 + colorBoost)
    );
    mat.emissiveIntensity = (0.1 + combined * 0.6) * intensityMult;

    // Hola extrusion
    if (extrusion > 0 && combined > 0.2) {
      const disp = combined * combined * extrusion * 0.15;
      mesh.position.copy(originalState.position)
        .addScaledVector(rd, disp);
    }
  }

  // Border glow follows wave (using cached radialDirection)
  for (const mesh of index.allBorderMeshes) {
    const mat = mesh.material as THREE.MeshStandardMaterial;
    if (!mat.isMeshStandardMaterial) continue;

    const bs = index.originalStates.get(mesh);
    if (!bs) continue;

    const proj1 = bs.radialDirection.dot(_waveDir1);
    const dist1 = proj1 - front1;
    const i1 = Math.exp(-(dist1 * dist1) / halfW2);
    const combined = Math.min(1, i1 * 0.6 + breathe);

    mat.emissive.setRGB(
      aR * (0.03 + combined * 0.2),
      aG * (0.03 + combined * 0.2),
      aB * (0.03 + combined * 0.2)
    );
    mat.emissiveIntensity = (0.1 + combined * 0.5) * intensityMult;
  }
}

/** Data highlight state for animation */
export interface DataHighlightState {
  mesh: THREE.Mesh;
  borderMeshes: THREE.Mesh[];
  intensity: number;
  color: string;
  startTime: number;
  /** Custom extrusion level (0-1), defaults to intensity */
  extrusion?: number;
}

/** City highlight state for animation */
export interface CityHighlightState {
  mesh: THREE.Mesh;
  borderMeshes: THREE.Mesh[];
  intensity: number;
  color: string;
  startTime: number;
  /** Custom extrusion level (0-1), defaults to intensity */
  extrusion?: number;
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
  let countryIndex = 0;
  for (const [, data] of highlights) {
    const mat = data.mesh.material as THREE.MeshStandardMaterial;
    if (!mat.isMeshStandardMaterial) { countryIndex++; continue; }

    const originalState = index.originalStates.get(data.mesh);
    if (!originalState) { countryIndex++; continue; }

    // Time since this highlight started
    const timeSinceStart = time - data.startTime;

    // Entry animation (0-0.5s): ease in
    const entryDelay = (1 - data.intensity) * 0.3;
    const entryProgress = Math.min(1, Math.max(0, (timeSinceStart - entryDelay) / 0.4));
    const entryEase = 1 - Math.pow(1 - entryProgress, 3); // ease-out cubic

    // Per-country phase offset for wave effect (not synchronized)
    const phaseOffset = countryIndex * 1.1;

    // Breathing pulse — wider range for visible animation
    const breathingSpeed = 1.2 + data.intensity * 0.8;
    const breathe1 = Math.sin(time * breathingSpeed + phaseOffset);
    const breathe2 = Math.sin(time * breathingSpeed * 0.7 + phaseOffset * 1.3) * 0.4;
    const breathingPulse = 0.5 + 0.5 * (breathe1 + breathe2) / 1.4; // range ~0.15 to ~0.85

    // Minimal radial displacement — just enough to feel alive, no lateral drift
    const extrusionValue = data.extrusion ?? data.intensity;
    const animatedDisplacement = Math.min(extrusionValue * 0.03, 0.025) * entryEase * (0.5 + breathingPulse * 0.5);

    // Apply position: stay close to original, no scale change
    data.mesh.position.copy(originalState.position)
      .addScaledVector(originalState.radialDirection, animatedDisplacement);
    data.mesh.scale.copy(originalState.scale);

    // Emissive pulse is the main visual — strong enough for bloom
    const baseEmissive = 0.3 + data.intensity * 0.6;
    mat.emissiveIntensity = baseEmissive * (0.3 + breathingPulse * 0.7) * (0.5 + entryProgress * 0.5);


    // Borders follow with same displacement
    for (const borderMesh of data.borderMeshes) {
      const borderOriginal = index.originalStates.get(borderMesh);
      if (borderOriginal) {
        borderMesh.position.copy(borderOriginal.position)
          .addScaledVector(borderOriginal.radialDirection, animatedDisplacement);
        borderMesh.scale.copy(borderOriginal.scale);
      }

      const borderMat = borderMesh.material as THREE.MeshStandardMaterial;
      if (borderMat.isMeshStandardMaterial) {
        borderMat.color.set(data.color);
        borderMat.emissive.set(data.color);
        borderMat.emissiveIntensity = glowIntensity * (1.2 + data.intensity) * (0.3 + breathingPulse * 0.7);
      }
    }

    countryIndex++;
  }
}

/**
 * Animate city highlights - data-driven, quasi-static like countries
 * Only the entry is animated, then cities stay at their data-driven size/position
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

    // Entry animation (0-0.5s): smooth ease in, then hold
    const entryDelay = (1 - data.intensity) * 0.2;
    const entryProgress = Math.min(1, Math.max(0, (timeSinceStart - entryDelay) / 0.5));
    const entryEase = 1 - Math.pow(1 - entryProgress, 3); // ease-out cubic

    // Scale: data-driven, fixed after entry (intensity drives size differentiation)
    const highlightScale = 1 + data.intensity * 0.5;
    const animatedScale = CITY_BASE_SCALE * (1 + (highlightScale - 1) * entryEase);
    data.mesh.scale.copy(originalState.scale).multiplyScalar(animatedScale);

    // Radial displacement: data-driven, fixed after entry
    const extrusionValue = data.extrusion ?? data.intensity;
    const highlightDisplacement = extrusionValue * 0.05;
    const animatedDisplacement = CITY_BASE_OFFSET + highlightDisplacement * entryEase;
    data.mesh.position.copy(originalState.position)
      .addScaledVector(originalState.radialDirection, animatedDisplacement);

    // Color from data
    mat.color.set(data.color);
    mat.emissive.set(data.color);

    // Steady emissive after entry (no pulse)
    const baseEmissive = 0.3 + data.intensity * 0.4;
    mat.emissiveIntensity = baseEmissive * entryEase;

    // City borders follow with same displacement
    for (const borderMesh of data.borderMeshes) {
      const borderOriginal = index.originalStates.get(borderMesh);
      if (borderOriginal) {
        borderMesh.position.copy(borderOriginal.position)
          .addScaledVector(borderOriginal.radialDirection, animatedDisplacement);
        borderMesh.scale.copy(borderOriginal.scale);
      }

      const borderMat = borderMesh.material as THREE.MeshStandardMaterial;
      if (borderMat.isMeshStandardMaterial) {
        borderMat.color.set(data.color);
        borderMat.emissive.set(data.color);
        borderMat.emissiveIntensity = glowIntensity * (1.0 + data.intensity) * entryEase;
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
