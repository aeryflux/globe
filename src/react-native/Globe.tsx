/**
 * Globe - React Native component for Expo
 *
 * Standalone 3D globe using expo-gl + expo-three.
 * Mirrors the web Globe API as closely as possible.
 *
 * Peer dependencies: expo-gl, expo-three, three
 *
 * Usage:
 * ```tsx
 * import { Globe } from '@aeryflux/globe/react-native';
 *
 * <Globe surface="dark" showCountries rotationSpeed={0.0004} />
 * ```
 */

import React, { useRef, useCallback, useEffect } from 'react';
// @ts-ignore — react-native is an optional peer, types not bundled in lib
import { StyleSheet, View, useWindowDimensions } from 'react-native';
// @ts-ignore — optional peer dep
import { GLView } from 'expo-gl';
// @ts-ignore — optional peer dep
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import type { GlobeConfig, GlobeIndex } from '../core/types';
import { GLOBE_MODELS } from '../core/types';
import { GLOBE_CDN_BASE } from '../core/constants';
import {
  getSurfaceColors,
  createGlobeScene,
  createGlobeCamera,
  buildGlobeIndex,
  applyGlobeMaterials,
  animateGlobeRotation,
  animateBorderPulse,
  animateAmbientWave,
  createIntroState,
  applyIntroAnimation,
  type IntroState,
  type SceneRefs,
} from '../core/GlobeRenderer';

export interface GlobeNativeProps extends GlobeConfig {
  /** Custom GLB model URL. Defaults to CDN atlas_hex_subdiv_5 (mobile-appropriate 2MB). */
  modelUrl?: string;
  /** ViewStyle for the container */
  style?: object;
}

interface SceneBag {
  renderer: any;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  model: THREE.Object3D;
  index: GlobeIndex;
  sceneRefs: SceneRefs;
  intro: IntroState | null;
  time: number;
  rafId: number | null;
}

export function Globe({
  surface = 'dark',
  showCountries = true,
  showBorders = true,
  showGlobeFill = true,
  showCities = false,
  rotationSpeed = 0.0004,
  glowIntensity = 1.2,
  ambientColor,
  ambientIntensity = 0.4,
  ambientExtrusion = 0,
  bass = 0,
  energy = 0,
  countryData,
  cityData,
  dataHighlightColor,
  introAnimation = false,
  introDuration = 2.5,
  modelUrl,
  style,
}: GlobeNativeProps) {
  const { width: screenWidth } = useWindowDimensions();
  const isMobile = screenWidth < 768;

  // Live prop refs — readable inside the GL animation loop without stale closures
  const propsRef = useRef({
    rotationSpeed, glowIntensity,
    ambientColor, ambientIntensity, ambientExtrusion,
    bass, energy,
    surface,
  });
  propsRef.current = {
    rotationSpeed, glowIntensity,
    ambientColor, ambientIntensity, ambientExtrusion,
    bass, energy,
    surface,
  };

  const bagRef = useRef<SceneBag | null>(null);

  // Default to mobile-friendly model (2MB). Apps can override with `modelUrl`.
  const resolvedModelUrl = modelUrl
    ?? `${GLOBE_CDN_BASE}/models/${GLOBE_MODELS.ATLAS_HEX_5}`;

  const onContextCreate = useCallback(async (gl: any) => {
    const { drawingBufferWidth: w, drawingBufferHeight: h } = gl;

    // 1. Renderer
    const renderer = new Renderer({ gl });
    renderer.setSize(w, h);
    renderer.setPixelRatio(1);

    // 2. Scene + Camera
    const colors = getSurfaceColors({ surface });
    const sceneRefs: SceneRefs = createGlobeScene(colors);
    const { scene } = sceneRefs;
    const camera = createGlobeCamera(w, h);

    // 3. Load model from CDN (or custom URL)
    const loader = new GLTFLoader();
    let model: THREE.Object3D;
    try {
      const gltf = await new Promise<{ scene: THREE.Object3D }>((resolve, reject) => {
        loader.load(resolvedModelUrl, resolve, undefined, reject);
      });
      model = gltf.scene;
    } catch (err) {
      console.error('[Globe RN] Failed to load model:', err);
      return;
    }

    model.scale.setScalar(isMobile ? 0.85 : 1.0);
    scene.add(model);

    // 4. Index + materials
    const index = buildGlobeIndex(model);
    applyGlobeMaterials(model, index, colors, {
      showCountries,
      showBorders,
      showGlobeFill,
      showCities,
      glowIntensity,
      countryData,
      dataHighlightColor,
    });

    // 5. Intro animation
    let intro: IntroState | null = null;
    if (introAnimation) {
      intro = createIntroState(0, introDuration);
      model.position.x = intro.startX;
    }

    const bag: SceneBag = {
      renderer, scene, camera, model, index, sceneRefs, intro,
      time: 0, rafId: null,
    };
    bagRef.current = bag;

    // 6. Animation loop
    const animate = () => {
      bag.rafId = requestAnimationFrame(animate);
      bag.time += 0.016;
      const t = bag.time;
      const p = propsRef.current;

      if (bag.intro?.active) {
        applyIntroAnimation(bag.model, t, bag.intro);
      }

      animateGlobeRotation(bag.model, t, p.rotationSpeed, p.bass, p.energy);
      animateBorderPulse(bag.index, t, p.glowIntensity);

      if (p.ambientIntensity > 0) {
        const accentColor = p.ambientColor ?? getSurfaceColors({ surface: p.surface }).accent;
        animateAmbientWave(
          bag.index, t,
          accentColor, p.ambientIntensity,
          p.bass, p.energy, p.ambientExtrusion,
        );
      }

      renderer.render(scene, camera);
      gl.endFrameEXP();
    };

    animate();
  }, [
    surface, showCountries, showBorders, showGlobeFill, showCities,
    glowIntensity, countryData, cityData, dataHighlightColor,
    introAnimation, introDuration, resolvedModelUrl, isMobile,
  ]);

  useEffect(() => {
    return () => {
      const bag = bagRef.current;
      if (!bag) return;
      if (bag.rafId !== null) cancelAnimationFrame(bag.rafId);
      bag.renderer.dispose();
      bagRef.current = null;
    };
  }, []);

  return (
    <View style={[styles.container, style]}>
      <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050508',
  },
});
