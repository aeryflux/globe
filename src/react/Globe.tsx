/**
 * Globe - React component for web
 *
 * Renders a 3D globe using Three.js with WebGL.
 * Includes automatic fallback when WebGL is unavailable.
 */

import { useRef, useEffect, useState, CSSProperties } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
}

export function Globe({
  className,
  style,
  modelUrl,
  showFallbackMessage = false,
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
    model: THREE.Group | null;
    index: GlobeIndex | null;
    animationId: number | null;
    time: number;
  } | null>(null);

  const colors = getSurfaceColors(config);
  const {
    rotationSpeed = 0.0003,
    bloomStrength = 1.0,
    glowIntensity = 1.2,
    isLightTheme = false,
    forceTransparent = false,
  } = config;

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

    // Disable pointer events for click-through
    renderer.domElement.style.pointerEvents = 'none';
    renderer.domElement.style.touchAction = 'none';

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

    // Store refs
    sceneRef.current = {
      scene,
      camera,
      renderer,
      composer,
      model: null,
      index: null,
      animationId: null,
      time: 0,
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

    // Animation loop
    const animate = () => {
      if (!sceneRef.current) return;

      sceneRef.current.animationId = requestAnimationFrame(animate);
      sceneRef.current.time += 0.016;
      const t = sceneRef.current.time;

      if (sceneRef.current.model && sceneRef.current.index) {
        animateGlobeRotation(sceneRef.current.model, t, rotationSpeed);
        animateBorderPulse(sceneRef.current.index, t, glowIntensity);
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

      renderer.dispose();
      if (composer) composer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
    };
  }, [webglError, modelUrl, colors, config, rotationSpeed, bloomStrength, glowIntensity, isLightTheme, forceTransparent]);

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
