/**
 * Globe - React component for web
 *
 * Renders a 3D globe using Three.js with WebGL.
 * Includes automatic fallback when WebGL is unavailable.
 */

import { useRef, useEffect, useState, useMemo, CSSProperties } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

import type { GlobeConfig, GlobeIndex } from '../core/types';
import { GLOBE_CDN_MODEL_URL } from '../core/constants';
import {
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
  createIntroState,
  applyIntroAnimation,
  updateGradient,
  updateGlobeFillTint,
  updateAccentLight,
  type DataHighlightState,
  type CityHighlightState,
  type IntroState,
  type SceneRefs,
} from '../core/GlobeRenderer';
import { checkWebGLSupport } from '../core/webgl';
import { GlobeFallback } from './GlobeFallback';

export interface GlobeProps extends GlobeConfig {
  className?: string;
  style?: CSSProperties;
  /** Model URL (default: bundled atlas_hex_subdiv_7.glb) */
  modelUrl?: string;
  /** Show fallback message when WebGL unavailable */
  showFallbackMessage?: boolean;
  /** Country data for highlighting (scale 0-1, optional color, optional extrusion) */
  countryData?: Record<string, { scale: number; color?: string; extrusion?: number }>;
  /** City data for highlighting (scale 0-1, optional color, optional extrusion) */
  cityData?: Record<string, { scale: number; color?: string; extrusion?: number }>;
  /** Color for data highlights (default: accent color) */
  dataHighlightColor?: string;
  /** Callback when a country is clicked (requires enableControls) */
  onCountryClick?: (countryName: string) => void;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export function Globe({
  className,
  style,
  modelUrl,
  showFallbackMessage = false,
  countryData,
  cityData,
  dataHighlightColor,
  onCountryClick,
  debug = false,
  ...config
}: GlobeProps) {
  // Debug logging helper - only logs when debug prop is true
  const debugLog = (...args: unknown[]) => { if (debug) console.log('[Globe]', ...args); };
  const debugWarn = (...args: unknown[]) => { if (debug) console.warn('[Globe]', ...args); };
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [webglError, setWebglError] = useState(false);

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer | null;
    bloomPass: any | null;
    bgMaterial: THREE.ShaderMaterial;
    accentLight: THREE.PointLight;
    controls: OrbitControls | null;
    model: THREE.Group | null;
    index: GlobeIndex | null;
    animationId: number | null;
    time: number;
    highlights: Map<string, DataHighlightState>;
    cityHighlights: Map<string, CityHighlightState>;
    intro: IntroState | null;
  } | null>(null);

  // Memoize colors to prevent unnecessary effect triggers
  const colors = useMemo(() => getSurfaceColors(config), [
    config.surface,
    config.borderColor,
    config.countryColor,
    config.globeFillColor,
  ]);

  const {
    rotationSpeed = 0.0003,
    bloomStrength = 1.0,
    glowIntensity = 1.2,
    isLightTheme = false,
    forceTransparent = false,
    showCountries = true,
    showCities = false,
    enableControls = false,
    bass = 0,
    mid = 0,
    treble = 0,
    energy = 0,
    ambientColor,
    ambientIntensity = 0.4,
    ambientExtrusion = 0,
  } = config;

  // Refs for animation loop (avoids recreating scene on prop changes)
  const rotationSpeedRef = useRef(rotationSpeed);
  const glowIntensityRef = useRef(glowIntensity);
  const bloomStrengthRef = useRef(bloomStrength);
  const bassRef = useRef(bass);
  const energyRef = useRef(energy);
  const ambientIntensityRef = useRef(ambientIntensity);
  const ambientExtrusionRef = useRef(ambientExtrusion);
  const showCountriesRef = useRef(showCountries);
  const showBordersRef = useRef(config.showBorders ?? true);
  const showGlobeFillRef = useRef(config.showGlobeFill ?? true);
  const showCitiesRef = useRef(showCities);
  const gradientTopRef = useRef(config.gradientTop || '#06060e');
  const gradientBottomRef = useRef(config.gradientBottom || '#0e1430');
  const globeFillTintRef = useRef(config.globeFillTint || '');
  const ambientColorRef = useRef(ambientColor || colors.accent);
  rotationSpeedRef.current = rotationSpeed;
  glowIntensityRef.current = glowIntensity;
  bloomStrengthRef.current = bloomStrength;
  showCountriesRef.current = showCountries;
  showBordersRef.current = config.showBorders ?? true;
  showGlobeFillRef.current = config.showGlobeFill ?? true;
  showCitiesRef.current = showCities;
  bassRef.current = bass;
  energyRef.current = energy;
  ambientIntensityRef.current = ambientIntensity;
  ambientExtrusionRef.current = ambientExtrusion;
  gradientTopRef.current = config.gradientTop || '#06060e';
  gradientBottomRef.current = config.gradientBottom || '#0e1430';
  globeFillTintRef.current = config.globeFillTint || '';
  ambientColorRef.current = ambientColor || colors.accent;

  // Full data key: rebuild highlights when countries OR their values change (hola wave)
  const countryDataKey = useMemo(() => {
    if (!countryData) return '';
    return Object.entries(countryData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v.scale.toFixed(2)}`)
      .join('|');
  }, [countryData]);

  // Create stable key for cityData to detect actual changes
  const cityDataKey = useMemo(() => {
    if (!cityData) return '';
    return Object.entries(cityData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v.scale}:${v.color || ''}`)
      .join('|');
  }, [cityData]);

  // Track previous data key to detect real changes
  const prevDataKeyRef = useRef<string>('');
  const prevCityDataKeyRef = useRef<string>('');

  // Refs for values used in effects to avoid dependency issues
  const countryDataRef = useRef(countryData);
  const cityDataRef = useRef(cityData);
  const configRef = useRef(config);
  countryDataRef.current = countryData;
  cityDataRef.current = cityData;
  configRef.current = config;

  // Check WebGL support on mount
  useEffect(() => {
    if (!checkWebGLSupport()) {
      setWebglError(true);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (webglError || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Create scene
    const { scene, bgMaterial, accentLight } = createGlobeScene(colors, config.gradientTop, config.gradientBottom);

    // Create camera
    const camera = createGlobeCamera(width, height);

    // Create renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false, // Gradient background shader handles the background
      });
    } catch (e) {
      debugWarn('WebGL context creation failed:', e);
      setWebglError(true);
      return;
    }

    if (renderer.getContext().isContextLost()) {
      debugWarn('WebGL context lost');
      renderer.dispose();
      setWebglError(true);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x06060e, 1); // Match gradient top color
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    container.appendChild(renderer.domElement);

    // Set pointer events based on controls
    if (enableControls) {
      renderer.domElement.style.pointerEvents = 'auto';
      renderer.domElement.style.touchAction = 'none';
      renderer.domElement.style.cursor = 'grab';
    } else {
      renderer.domElement.style.pointerEvents = 'none';
      renderer.domElement.style.touchAction = 'none';
    }

    // Post-processing (disabled for light theme or transparent)
    let composer: EffectComposer | null = null;
    const useDirectRender = isLightTheme || forceTransparent;

    let bloomPass: any = null;
    if (!useDirectRender) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        bloomStrength * 1.5,
        0.8,
        0.1
      );
      composer.addPass(bloomPass);
    }

    // Setup OrbitControls if enabled
    let controls: OrbitControls | null = null;
    if (enableControls) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.rotateSpeed = 0.5;
      controls.minPolarAngle = Math.PI * 0.2;
      controls.maxPolarAngle = Math.PI * 0.8;

      // Cursor feedback
      controls.addEventListener('start', () => {
        renderer.domElement.style.cursor = 'grabbing';
      });
      controls.addEventListener('end', () => {
        renderer.domElement.style.cursor = 'grab';
      });
    }

    // Store refs
    sceneRef.current = {
      scene,
      camera,
      renderer,
      composer,
      bloomPass,
      bgMaterial,
      accentLight,
      controls,
      model: null,
      index: null,
      animationId: null,
      time: 0,
      highlights: new Map(),
      cityHighlights: new Map(),
      intro: null,
    };

    // Load model
    const loader = new GLTFLoader();
    const finalModelUrl = modelUrl || GLOBE_CDN_MODEL_URL;

    loader.load(
      finalModelUrl,
      (gltf) => {
        const model = gltf.scene;
        scene.add(model);

        const index = buildGlobeIndex(model);
        applyGlobeMaterials(model, index, colors, config);

        if (sceneRef.current) {
          sceneRef.current.model = model;
          sceneRef.current.index = index;
          // Start intro animation if enabled
          if (config.introAnimation) {
            sceneRef.current.intro = createIntroState(
              sceneRef.current.time,
              config.introDuration || 2.5
            );
            // Position model off-screen initially
            model.position.x = sceneRef.current.intro.startX;
          }
        }

        setIsLoading(false);
      },
      undefined,
      (error) => {
        debugWarn('Failed to load model:', error);
        setIsLoading(false);
      }
    );

    // Animation loop (uses refs for latest values)
    const animate = () => {
      if (!sceneRef.current) return;

      sceneRef.current.animationId = requestAnimationFrame(animate);
      sceneRef.current.time += 0.016;
      const t = sceneRef.current.time;

      // Update controls if enabled
      if (sceneRef.current.controls) {
        sceneRef.current.controls.update();
      }

      // Update bloom in real-time
      if (sceneRef.current.bloomPass) {
        sceneRef.current.bloomPass.strength = bloomStrengthRef.current * 1.5;
      }

      // Update gradient background (smooth lerp)
      updateGradient(sceneRef.current.bgMaterial, gradientTopRef.current, gradientBottomRef.current);

      // Update accent light color
      updateAccentLight(sceneRef.current.accentLight, ambientColorRef.current);

      if (sceneRef.current.model && sceneRef.current.index) {
        // Update visibility from refs (real-time toggle support)
        const idx = sceneRef.current.index;
        for (const mesh of idx.allCountryMeshes) mesh.visible = showCountriesRef.current;
        for (const mesh of idx.allBorderMeshes) mesh.visible = showBordersRef.current;
        for (const mesh of idx.allCityMeshes) mesh.visible = showCitiesRef.current;
        if (idx.globeMesh) idx.globeMesh.visible = showGlobeFillRef.current;

        // Decay aura effects on clicked countries + borders (Kaspersky cascade)
        for (const mesh of idx.allCountryMeshes) {
          if ((mesh as any)._auraDecay) (mesh as any)._auraDecay();
        }
        for (const mesh of idx.allBorderMeshes) {
          if ((mesh as any)._auraDecay) (mesh as any)._auraDecay();
        }
        // Decay aura clones (Kaspersky expanding rings)
        const clones = (sceneRef.current as any)._auraClones as THREE.Mesh[] | undefined;
        if (clones) {
          for (let i = clones.length - 1; i >= 0; i--) {
            if ((clones[i] as any)._auraDecay) {
              (clones[i] as any)._auraDecay();
            } else {
              clones.splice(i, 1); // Remove finished clones
            }
          }
        }

        // Globe fill tint (real-time color transition)
        if (globeFillTintRef.current && sceneRef.current.index) {
          updateGlobeFillTint(sceneRef.current.index, globeFillTintRef.current);
        }

        // Intro animation (slide + spin from left)
        if (sceneRef.current.intro?.active) {
          applyIntroAnimation(sceneRef.current.model, t, sceneRef.current.intro);
        }

        // Only auto-rotate if controls are not enabled (user controls rotation)
        if (!enableControls) {
          animateGlobeRotation(sceneRef.current.model, t, rotationSpeedRef.current, bassRef.current, energyRef.current);
        }
        // Ambient wave always runs — provides base glow on non-highlighted countries
        // When highlights exist, highlighted countries are overridden by animateDataHighlights
        animateAmbientWave(
          sceneRef.current.index, t,
          ambientColorRef.current,
          ambientIntensityRef.current,
          bassRef.current,
          energyRef.current,
          ambientExtrusionRef.current
        );
        if (sceneRef.current.highlights.size > 0) {
          animateBorderPulse(sceneRef.current.index, t, glowIntensityRef.current);
        }

        // Animate data highlights if any
        if (sceneRef.current.highlights.size > 0) {
          animateDataHighlights(sceneRef.current.index, sceneRef.current.highlights, t, glowIntensityRef.current);
        }
        // Animate city highlights if any
        if (sceneRef.current.cityHighlights.size > 0) {
          animateCityHighlights(sceneRef.current.index, sceneRef.current.cityHighlights, t, glowIntensityRef.current);
        }
      }

      if (useDirectRender) {
        sceneRef.current.renderer.render(sceneRef.current.scene, sceneRef.current.camera);
      } else if (sceneRef.current.composer) {
        sceneRef.current.composer.render();
      }
    };
    animate();

    // Resize handler
    const handleResize = () => {
      if (!sceneRef.current || !containerRef.current) return;

      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      sceneRef.current.camera.aspect = w / h;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(w, h);
      if (sceneRef.current.composer) {
        sceneRef.current.composer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    // Country click via raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const handleClick = (e: MouseEvent) => {
      if (!sceneRef.current?.model || !sceneRef.current?.index) return;
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, sceneRef.current.camera);
      const meshes = sceneRef.current.index.allCountryMeshes.filter(m => m.visible);
      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        const mesh = intersects[0].object as THREE.Mesh;
        let name = mesh.name.replace(/^country_|^cell_/i, '').replace(/_\d+$/, '').replace(/_/g, ' ');
        const bordersKey = mesh.name.toLowerCase().replace(/^country_|^cell_/i, '').replace(/_\d+$/, '');

        // Skip if same country already selected
        if ((sceneRef.current as any)._selectedCountry === bordersKey) return;

        // Clear previous aura: clones + restore original materials
        const oldClones = (sceneRef.current as any)._auraClones as THREE.Mesh[] | undefined;
        if (oldClones) {
          for (const c of oldClones) {
            c.parent?.remove(c);
            (c.material as THREE.Material).dispose();
            c.geometry.dispose();
            (c as any)._auraDecay = null;
          }
          (sceneRef.current as any)._auraClones = [];
        }
        // Restore original colors on previously affected meshes
        for (const m of sceneRef.current.index.allCountryMeshes) {
          (m as any)._auraDecay = null;
          const orig = (m as any)._origMat;
          if (orig) {
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.color.copy(orig.color);
            mat.emissive.copy(orig.emissive);
            mat.emissiveIntensity = orig.emissiveIntensity;
            mat.metalness = orig.metalness;
            mat.roughness = orig.roughness;
          }
        }
        for (const m of sceneRef.current.index.allBorderMeshes) {
          (m as any)._auraDecay = null;
          m.scale.setScalar(1);
          const orig = (m as any)._origMat;
          if (orig) {
            const mat = m.material as THREE.MeshStandardMaterial;
            mat.color.copy(orig.color);
            mat.emissive.copy(orig.emissive);
            mat.emissiveIntensity = orig.emissiveIntensity;
          }
        }

        (sceneRef.current as any)._selectedCountry = bordersKey;
        const accent = new THREE.Color(colors.accent);
        const startTime = sceneRef.current.time;

        // Country glow spike — change color + emissive
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.isMeshStandardMaterial) {
          // Save originals for restore on next click
          if (!(mesh as any)._origMat) {
            (mesh as any)._origMat = { color: mat.color.clone(), emissive: mat.emissive.clone(), emissiveIntensity: mat.emissiveIntensity, metalness: mat.metalness, roughness: mat.roughness };
          }
          const origColor = (mesh as any)._origMat.color.clone();
          const origEmissive = (mesh as any)._origMat.emissive.clone();
          mat.color.copy(accent);
          mat.emissive.copy(accent);
          mat.emissiveIntensity = 3.0;
          mat.metalness = 0.4;
          mat.roughness = 0.2;
          (mesh as any)._auraDecay = () => {
            if (!sceneRef.current) return;
            const elapsed = sceneRef.current.time - startTime;
            const decay = Math.exp(-elapsed * 0.3);
            const pulse = 1 + Math.sin(elapsed * 4) * 0.3 * decay;
            mat.emissiveIntensity = Math.max(0.15, 3.0 * decay * pulse);
            // Fade color back to original
            mat.color.copy(accent).lerp(origColor, 1 - decay);
            mat.emissive.copy(accent).lerp(origEmissive, 1 - decay);
            if (decay < 0.01) { (mesh as any)._auraDecay = null; mat.metalness = 0.1; mat.roughness = 0.6; }
          };
        }

        // Kaspersky aura: clone borders into 3 expanding rings
        const borderMeshes = sceneRef.current.index.countryToBorder.get(bordersKey) || [];
        const AURA_LAYERS = 3;
        const auraClones: THREE.Mesh[] = [];
        for (const bm of borderMeshes) {
          const bMat = bm.material as THREE.MeshStandardMaterial;
          if (!bMat.isMeshStandardMaterial) continue;
          // Save originals for restore
          if (!(bm as any)._origMat) {
            (bm as any)._origMat = { color: bMat.color.clone(), emissive: bMat.emissive.clone(), emissiveIntensity: bMat.emissiveIntensity };
          }
          // Flash original border
          bMat.color.copy(accent);
          bMat.emissive.copy(accent);
          bMat.emissiveIntensity = 2.0;

          // Clone border mesh into aura layers
          for (let layer = 0; layer < AURA_LAYERS; layer++) {
            const clone = bm.clone();
            const auraMat = new THREE.MeshStandardMaterial({
              color: accent.clone(),
              emissive: accent.clone(),
              emissiveIntensity: 1.5,
              metalness: 0.3,
              roughness: 0.4,
              transparent: true,
              opacity: 0.6,
              side: THREE.DoubleSide,
              depthWrite: false,
            });
            clone.material = auraMat;
            clone.renderOrder = bm.renderOrder + 1 + layer;
            const parent = bm.parent || sceneRef.current!.scene;
            parent.add(clone);
            clone.position.copy(bm.position);
            clone.rotation.copy(bm.rotation);
            clone.quaternion.copy(bm.quaternion);
            auraClones.push(clone);

            const phaseOffset = layer / AURA_LAYERS;
            (clone as any)._auraDecay = () => {
              if (!sceneRef.current) return;
              const elapsed = sceneRef.current.time - startTime;
              const decay = Math.exp(-elapsed * 0.3);
              // Each layer pulses at a different phase offset
              const rawPhase = ((elapsed * 0.8) + phaseOffset) % 1;
              const opacityPhase = Math.sin(rawPhase * Math.PI);
              auraMat.opacity = 0.6 * opacityPhase * decay;
              // Expand outward
              const expand = 1 + rawPhase * 0.15;
              clone.scale.setScalar(expand);
              auraMat.emissiveIntensity = 1.5 * opacityPhase * decay;
              if (decay < 0.02) {
                clone.parent?.remove(clone);
                clone.geometry.dispose();
                auraMat.dispose();
                (clone as any)._auraDecay = null;
              }
            };
          }

          // Original border decay
          const origColor = bMat.color.clone();
          const origEmissive = bMat.emissive.clone();
          (bm as any)._auraDecay = () => {
            if (!sceneRef.current) return;
            const elapsed = sceneRef.current.time - startTime;
            const decay = Math.exp(-elapsed * 0.3);
            bMat.emissiveIntensity = 0.5 + decay * 2.0;
            bMat.color.copy(accent).lerp(origColor, 1 - decay);
            bMat.emissive.copy(accent).lerp(origEmissive, 1 - decay);
            if (decay < 0.02) { (bm as any)._auraDecay = null; }
          };
        }
        // Store clones for render loop decay
        if (!(sceneRef.current as any)._auraClones) (sceneRef.current as any)._auraClones = [];
        (sceneRef.current as any)._auraClones.push(...auraClones);
        console.log('[Globe] Aura clones created:', auraClones.length, 'for', borderMeshes.length, 'borders');
        if (onCountryClick) onCountryClick(name);
        console.log('[Globe] Click:', name, '| borders:', borderMeshes.length, '| mat type:', mat?.constructor?.name);
      }
    };
    if (enableControls) {
      renderer.domElement.addEventListener('click', handleClick);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);

      if (sceneRef.current?.animationId) {
        cancelAnimationFrame(sceneRef.current.animationId);
      }

      if (controls) controls.dispose();
      renderer.dispose();
      if (composer) composer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Scene setup only on mount/modelUrl/controls change
  }, [webglError, modelUrl, enableControls]);

  // Build highlights when countryData actually changes (using stable key comparison)
  useEffect(() => {
    if (!sceneRef.current?.index) return;

    // Skip if data hasn't actually changed
    const isNewData = countryDataKey !== prevDataKeyRef.current;
    if (!isNewData && sceneRef.current.highlights.size > 0) {
      return;
    }
    prevDataKeyRef.current = countryDataKey;

    const { index, time } = sceneRef.current;
    const currentCountryData = countryDataRef.current;
    const currentConfig = configRef.current;

    // Reset all positions first (smooth transition)
    resetAllCountries(index);
    sceneRef.current.highlights.clear();

    // If no data, just reset and apply base materials
    if (!currentCountryData || Object.keys(currentCountryData).length === 0) {
      applyGlobeMaterials(sceneRef.current.model!, index, colors, {
        ...currentConfig,
        showCountries,
        showCities,
      });
      return;
    }

    const highlightColor = dataHighlightColor || colors.accent;
    const newHighlights = new Map<string, DataHighlightState>();

    // Country name aliases (bidirectional: API name <-> mesh name variations)
    // Mesh names in GLB are like "country_United Kingdom_0" -> normalized to "united_kingdom"
    // Data might have "uk", "south korea", etc. - need to map to mesh names
    const countryAliases: Record<string, string[]> = {
      // Full names -> abbreviations
      'south_korea': ['republic_of_korea', 'korea_south', 'korea'],
      'north_korea': ['democratic_people\'s_republic_of_korea', 'korea_north'],
      'united_arab_emirates': ['uae', 'u.a.e.'],
      'united_kingdom': ['uk', 'great_britain', 'britain'],
      'united_states': ['usa', 'united_states_of_america', 'us'],
      'united_states_of_america': ['usa', 'united_states', 'us', 'america'],
      'saudi_arabia': ['kingdom_of_saudi_arabia', 'ksa'],
      'south_africa': ['republic_of_south_africa', 'rsa'],
      'new_zealand': ['nz'],
      'sri_lanka': ['ceylon'],
      'ivory_coast': ['cote_d\'ivoire', 'côte_d\'ivoire'],
      'czech_republic': ['czechia'],
      'democratic_republic_of_the_congo': ['drc', 'dr_congo', 'congo_kinshasa'],
      'republic_of_the_congo': ['congo_brazzaville', 'congo'],
      // Reverse: abbreviations -> full names (for matching mesh names)
      'uk': ['united_kingdom', 'great_britain'],
      'uae': ['united_arab_emirates'],
      'usa': ['united_states', 'united_states_of_america'],
      'korea': ['south_korea', 'republic_of_korea'],
      'congo': ['republic_of_the_congo', 'democratic_republic_of_the_congo'],
      'drc': ['democratic_republic_of_the_congo'],
      'czechia': ['czech_republic'],
      'hong_kong': ['hong_kong_s.a.r.', 'hongkong'],
      'russia': ['russian_federation'],
      'russian_federation': ['russia'],
      'taiwan': ['chinese_taipei', 'republic_of_china'],
      'vietnam': ['viet_nam'],
      'iran': ['islamic_republic_of_iran'],
      'syria': ['syrian_arab_republic'],
      'laos': ['lao_people\'s_democratic_republic'],
      'tanzania': ['united_republic_of_tanzania'],
      'venezuela': ['bolivarian_republic_of_venezuela'],
      'bolivia': ['plurinational_state_of_bolivia'],
    };

    // Build country name lookup (lowercase, normalized)
    const countryDataMap = new Map<string, { scale: number; color?: string }>();
    for (const [name, data] of Object.entries(currentCountryData)) {
      const normalized = name.toLowerCase().replace(/\s+/g, '_');
      const noSpaces = name.toLowerCase().replace(/\s+/g, '');
      const withSpaces = name.toLowerCase();

      countryDataMap.set(normalized, data);
      countryDataMap.set(noSpaces, data);
      countryDataMap.set(withSpaces, data);

      // Also add aliases for this country
      if (countryAliases[normalized]) {
        for (const alias of countryAliases[normalized]) {
          countryDataMap.set(alias, data);
        }
      }
    }

    // Track matched countries to find unmatched ones
    const matchedCountries = new Set<string>();

    // Match countries to meshes
    for (const mesh of index.allCountryMeshes) {
      const meshName = mesh.name.toLowerCase();
      let baseName = '';
      if (meshName.startsWith('country_')) baseName = meshName.replace('country_', '');
      else if (meshName.startsWith('cell_')) baseName = meshName.replace('cell_', '');
      if (!baseName) continue;

      // Remove trailing index
      const parts = baseName.split('_');
      const lastPart = parts[parts.length - 1];
      const isIndex = /^\d+$/.test(lastPart);
      const countryName = isIndex ? parts.slice(0, -1).join('_') : baseName;

      const matchedData = countryDataMap.get(countryName) || countryDataMap.get(countryName.replace(/_/g, ''));
      if (matchedData) {
        matchedCountries.add(countryName);
        // Find border meshes (array)
        const borderMeshes = index.countryToBorder.get(countryName) || [];

        newHighlights.set(mesh.name, {
          mesh,
          borderMeshes,
          intensity: matchedData.scale,
          color: matchedData.color || highlightColor,
          startTime: time,
        });
      }
    }

    // Log unmatched countries (those in data but not found in meshes)
    const requestedCountries = [...countryDataMap.keys()];
    const unmatchedCountries = requestedCountries.filter(c => !matchedCountries.has(c) && !matchedCountries.has(c.replace(/_/g, '')));
    if (unmatchedCountries.length > 0) {
      debugLog('Unmatched countries:', unmatchedCountries.slice(0, 20));
    }
    debugLog('Countries: matched', matchedCountries.size, '/', requestedCountries.length);

    sceneRef.current.highlights = newHighlights;

    // Apply materials (positions handled by animateDataHighlights)
    applyGlobeMaterials(sceneRef.current.model!, index, colors, {
      ...currentConfig,
      showCountries,
      showCities,
      countryData: currentCountryData,
      dataHighlightColor: highlightColor,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- countryDataKey is the stable dependency
  }, [countryDataKey, dataHighlightColor, colors, showCountries, showCities]);

  // Build city highlights when cityData actually changes (using stable key comparison)
  useEffect(() => {
    debugLog('City effect start', { hasScene: !!sceneRef.current, hasIndex: !!sceneRef.current?.index });
    if (!sceneRef.current?.index) return;

    // Skip if data hasn't actually changed
    const isNewData = cityDataKey !== prevCityDataKeyRef.current;
    if (!isNewData && sceneRef.current.cityHighlights.size > 0) {
      return;
    }
    prevCityDataKeyRef.current = cityDataKey;

    const { index, time } = sceneRef.current;
    const currentCityData = cityDataRef.current;

    // Reset all city positions first (smooth transition)
    resetAllCities(index);
    sceneRef.current.cityHighlights.clear();

    // If no city data, just return
    if (!currentCityData || Object.keys(currentCityData).length === 0) {
      return;
    }

    const highlightColor = dataHighlightColor || colors.accent;
    const newCityHighlights = new Map<string, CityHighlightState>();

    // Helper to remove accents for matching
    const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // City name aliases (bidirectional: API name <-> mesh name variations)
    // GLB mesh names use Natural Earth format: city_{Country}_{CityName}_{ID}
    const cityAliases: Record<string, string[]> = {
      // Common variations and abbreviations
      'new_york': ['newyork', 'new_york_city', 'nyc'],
      'los_angeles': ['losangeles', 'la'],
      'san_francisco': ['sanfrancisco', 'sf'],
      'hong_kong': ['hongkong', 'hong_kong_s.a.r.'],
      'tel_aviv': ['telaviv', 'tel_aviv-yafo', 'tel_aviv_yafo'],
      'sao_paulo': ['são_paulo', 'saopaulo'],
      'são_paulo': ['sao_paulo', 'saopaulo'],  // Reverse: GLB has accented version
      'rio_de_janeiro': ['riodejaneiro', 'rio'],
      'mexico_city': ['mexicocity', 'ciudad_de_mexico', 'cdmx'],
      'buenos_aires': ['buenosaires'],
      'kyiv': ['kiev'],  // GLB uses 'Kiev'
      'kiev': ['kyiv'],  // Reverse
      'montreal': ['montréal', 'montr'],
      'montréal': ['montreal'],  // Reverse: GLB has accented version
      'copenhagen': ['københavn', 'kobenhavn'],
      'københavn': ['copenhagen', 'kobenhavn'],  // Reverse
      'brasília': ['brasilia'],
      'brasilia': ['brasília'],  // Reverse
      'goiânia': ['goiania'],
      'singapore': ['singapore_city'],
      'dubai': ['dubayy'],
      'seoul': ['soul', 'sŏul'],
      'tokyo': ['tōkyō', 'tokio'],
      'osaka': ['ōsaka'],
      'beijing': ['peking'],
      'mumbai': ['bombay'],
      'kolkata': ['calcutta'],
      'chennai': ['madras'],
      'ho_chi_minh': ['ho_chi_minh_city', 'saigon'],
      'ho_chi_minh_city': ['ho_chi_minh', 'saigon'],
      'kuala_lumpur': ['kl'],
      'prague': ['praha'],
      'warsaw': ['warszawa'],
      'vienna': ['wien'],
      'munich': ['münchen', 'munchen'],
      'cologne': ['köln', 'koln'],
      'brussels': ['bruxelles', 'brussel'],
      'athens': ['athina', 'αθήνα'],
      'cairo': ['al_qahirah', 'القاهرة'],
      'riyadh': ['ar_riyad', 'الرياض'],
    };

    // Build city name lookup (lowercase, normalized, no accents)
    const cityDataMap = new Map<string, { scale: number; color?: string; extrusion?: number }>();
    for (const [name, data] of Object.entries(currentCityData)) {
      const lower = name.toLowerCase();
      const noAccents = removeAccents(lower);
      const normalized = lower.replace(/\s+/g, '_');

      cityDataMap.set(normalized, data);
      cityDataMap.set(lower.replace(/\s+/g, ''), data);
      cityDataMap.set(lower, data);

      // Add aliases for this city
      if (cityAliases[normalized]) {
        for (const alias of cityAliases[normalized]) {
          cityDataMap.set(alias, data);
          cityDataMap.set(removeAccents(alias), data);
        }
      }

      // Also add version without accents
      cityDataMap.set(noAccents.replace(/\s+/g, '_'), data);
      cityDataMap.set(noAccents.replace(/\s+/g, ''), data);
      cityDataMap.set(noAccents, data);
    }

    // Track matched cities to find unmatched ones
    const matchedCities = new Set<string>();


    for (const mesh of index.allCityMeshes) {
      const meshName = mesh.name.toLowerCase();
      const cityPart = meshName.replace('city_', '');
      const parts = cityPart.split('_');
      // Pattern: city_{Country}_{CityName}_{ID}
      // Last part is numeric ID, rest is country + city name
      // Try matching from the end backwards to handle multi-word country names
      const lastPart = parts[parts.length - 1];
      const hasNumericId = /^\d+$/.test(lastPart);

      // Try multiple extraction strategies
      // subdiv_7 uses: city_{CityName}_{ID} (e.g., city_Paris_19)
      // subdiv_6 uses: city_{Country}_{CityName}_{ID} (e.g., city_France_Paris_123)
      let matchedData = null;
      let matchedCityName = '';

      // Helper to try matching a city name with accent removal fallback
      const tryMatch = (name: string) => {
        let data = cityDataMap.get(name);
        if (!data) data = cityDataMap.get(removeAccents(name));
        return data;
      };

      // Strategy 0 (hex format): city_{Country}_{CityName}_{ID}
      // Example: city_Brazil_São_Paulo_4 -> parts: ['brazil', 'são', 'paulo', '4']
      // Try parts except first (country) and last (ID) to get city name
      if (hasNumericId && parts.length >= 3) {
        const cityName = parts.slice(1, -1).join('_'); // Skip country, skip ID
        matchedData = tryMatch(cityName);
        if (matchedData) matchedCityName = cityName;
      }

      // Strategy 1: City name is second-to-last part (single word city)
      // Example: city_France_Paris_123 -> parts: ['france', 'paris', '123'] -> 'paris'
      if (!matchedData && hasNumericId && parts.length >= 3) {
        const cityName = parts[parts.length - 2];
        matchedData = tryMatch(cityName);
        if (matchedData) matchedCityName = cityName;
      }

      // Strategy 2: Try last two parts joined (multi-word cities)
      // Example: city_Brazil_Rio_de_Janeiro_13 -> parts: ['brazil', 'rio', 'de', 'janeiro', '13']
      // Try 'de_janeiro' first, then 'rio_de_janeiro'
      if (!matchedData && hasNumericId && parts.length >= 4) {
        const cityName = parts.slice(-3, -1).join('_');
        matchedData = tryMatch(cityName);
        if (matchedData) matchedCityName = cityName;
      }

      // Strategy 3 (subdiv_7 format): city_{CityName}_{ID}
      // Example: city_paris_19 -> parts: ['paris', '19']
      // Join all parts except the last (ID) to get the full city name
      if (!matchedData && hasNumericId && parts.length >= 2) {
        const cityName = parts.slice(0, -1).join('_'); // All parts except last (ID)
        matchedData = tryMatch(cityName);
        if (matchedData) matchedCityName = cityName;
      }

      // Strategy 4: Try full cityPart (legacy fallback)
      if (!matchedData) {
        matchedData = tryMatch(cityPart);
        if (matchedData) matchedCityName = cityPart;
      }

      const cityName = matchedCityName || (hasNumericId ? parts[parts.length - 2] : parts[parts.length - 1]) || cityPart;
      if (matchedData) {
        matchedCities.add(matchedCityName);
        // Find city border meshes - try multiple name formats
        let borderMeshes = index.cityToBorder.get(cityName) || [];
        if (borderMeshes.length === 0) {
          // Try with full city part (e.g., france_paris)
          borderMeshes = index.cityToBorder.get(cityPart) || [];
        }

        newCityHighlights.set(mesh.name, {
          mesh,
          borderMeshes,
          intensity: matchedData.scale,
          color: matchedData.color || highlightColor,
          startTime: time,
          extrusion: matchedData.extrusion,
        });
      }
    }

    // Debug log for development (minimal)
    const requestedCities = Object.keys(currentCityData);
    const unmatchedCities = requestedCities.filter(c => !matchedCities.has(c.toLowerCase()) && !matchedCities.has(c.toLowerCase().replace(/\s+/g, '_')));
    if (unmatchedCities.length > 0) {
      debugLog('Unmatched cities:', unmatchedCities);
    }
    debugLog('Cities matched:', matchedCities.size, '/', requestedCities.length);

    sceneRef.current.cityHighlights = newCityHighlights;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- cityDataKey is the stable dependency
  }, [cityDataKey, dataHighlightColor, colors]);

  // Show fallback if WebGL not supported
  if (webglError) {
    return (
      <GlobeFallback
        className={className}
        style={style}
        borderColor={colors.accent}
        showMessage={showFallbackMessage}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              border: `2px solid ${colors.accent}33`,
              borderTopColor: colors.accent,
              borderRadius: '50%',
              animation: 'globeSpin 1s linear infinite',
            }}
          />
        </div>
      )}
      <style>{`
        @keyframes globeSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Globe;
