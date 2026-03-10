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
import {
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
import { checkWebGLSupport } from '../core/webgl';
import { GlobeFallback } from './GlobeFallback';

export interface GlobeProps extends GlobeConfig {
  className?: string;
  style?: CSSProperties;
  /** Model URL (default: bundled atlas_hex_subdiv_6.glb) */
  modelUrl?: string;
  /** Show fallback message when WebGL unavailable */
  showFallbackMessage?: boolean;
  /** Country data for highlighting (scale 0-1, optional color, optional extrusion) */
  countryData?: Record<string, { scale: number; color?: string; extrusion?: number }>;
  /** City data for highlighting (scale 0-1, optional color, optional extrusion) */
  cityData?: Record<string, { scale: number; color?: string; extrusion?: number }>;
  /** Color for data highlights (default: accent color) */
  dataHighlightColor?: string;
}

export function Globe({
  className,
  style,
  modelUrl,
  showFallbackMessage = false,
  countryData,
  cityData,
  dataHighlightColor,
  ...config
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [webglError, setWebglError] = useState(false);

  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer | null;
    controls: OrbitControls | null;
    model: THREE.Group | null;
    index: GlobeIndex | null;
    animationId: number | null;
    time: number;
    highlights: Map<string, DataHighlightState>;
    cityHighlights: Map<string, CityHighlightState>;
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
    showCountries = false,
    showCities = false,
    enableControls = false,
  } = config;

  // Refs for animation loop (avoids recreating scene on prop changes)
  const rotationSpeedRef = useRef(rotationSpeed);
  const glowIntensityRef = useRef(glowIntensity);
  rotationSpeedRef.current = rotationSpeed;
  glowIntensityRef.current = glowIntensity;

  // Create stable key for countryData to detect actual changes
  const countryDataKey = useMemo(() => {
    if (!countryData) return '';
    return Object.entries(countryData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v.scale}:${v.color || ''}`)
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
    const scene = createGlobeScene(colors);

    // Create camera
    const camera = createGlobeCamera(width, height);

    // Create renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
    } catch (e) {
      console.error('[Globe] WebGL context creation failed:', e);
      setWebglError(true);
      return;
    }

    if (renderer.getContext().isContextLost()) {
      console.error('[Globe] WebGL context lost');
      renderer.dispose();
      setWebglError(true);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
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

    if (!useDirectRender) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloomPass = new UnrealBloomPass(
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
      controls,
      model: null,
      index: null,
      animationId: null,
      time: 0,
      highlights: new Map(),
      cityHighlights: new Map(),
    };

    // Load model
    const loader = new GLTFLoader();
    const finalModelUrl = modelUrl || new URL('../models/atlas_hex_subdiv_6.glb', import.meta.url).href;

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
        }

        setIsLoading(false);
      },
      undefined,
      (error) => {
        console.error('[Globe] Failed to load model:', error);
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

      if (sceneRef.current.model && sceneRef.current.index) {
        // Only auto-rotate if controls are not enabled (user controls rotation)
        if (!enableControls) {
          animateGlobeRotation(sceneRef.current.model, t, rotationSpeedRef.current);
        }
        animateBorderPulse(sceneRef.current.index, t, glowIntensityRef.current);

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

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);

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
      console.log('[Globe] Unmatched countries:', unmatchedCountries.slice(0, 20));
    }
    console.log('[Globe] Countries: matched', matchedCountries.size, '/', requestedCountries.length);

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
    console.error('>>> CITY EFFECT START', { hasScene: !!sceneRef.current, hasIndex: !!sceneRef.current?.index });
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

    // Debug log for development (minimal) - always log for now to debug matching
    const requestedCities = Object.keys(currentCityData);
    const unmatchedCities = requestedCities.filter(c => !matchedCities.has(c.toLowerCase()) && !matchedCities.has(c.toLowerCase().replace(/\s+/g, '_')));
    if (unmatchedCities.length > 0) {
      console.log('[Globe] Unmatched cities:', unmatchedCities);
    }
    console.log('[Globe] Cities matched:', matchedCities.size, '/', requestedCities.length);

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
