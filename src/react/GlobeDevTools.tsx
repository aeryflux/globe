/**
 * GlobeDevTools — minimal vertical toggle panel
 */

import { CSSProperties, useState, useEffect, useRef } from 'react';
import type { GlobeConfig } from '../core/types';

export interface GlobeDevToolsProps {
  config: GlobeConfig;
  onChange: (config: Partial<GlobeConfig>) => void;
  side?: 'left' | 'right';
  style?: CSSProperties;
}

interface Toggle {
  key: keyof GlobeConfig;
  label: string;
  type: 'bool' | 'range';
  min?: number;
  max?: number;
  step?: number;
}

const TOGGLES: Toggle[] = [
  { key: 'showGlobeFill', label: 'Ocean', type: 'bool' },
  { key: 'showCountries', label: 'Countries', type: 'bool' },
  { key: 'showBorders', label: 'Borders', type: 'bool' },
  { key: 'showCities', label: 'Cities', type: 'bool' },
  { key: 'enableControls', label: 'Controls', type: 'bool' },
  { key: 'glowIntensity', label: 'Glow', type: 'range', min: 0, max: 3, step: 0.1 },
  { key: 'rotationSpeed', label: 'Speed', type: 'range', min: 0, max: 0.005, step: 0.0001 },
  { key: 'bloomStrength', label: 'Bloom', type: 'range', min: 0, max: 3, step: 0.1 },
  { key: 'bass', label: 'Bass', type: 'range', min: 0, max: 1.5, step: 0.05 },
  { key: 'energy', label: 'Energy', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'ambientIntensity', label: 'Ambient', type: 'range', min: 0, max: 2, step: 0.1 },
];

export function GlobeDevTools({ config, onChange, side = 'right', style }: GlobeDevToolsProps) {
  const [fps, setFps] = useState(0);
  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  useEffect(() => {
    let rafId: number;
    const tick = () => {
      framesRef.current++;
      const now = performance.now();
      if (now - lastTimeRef.current >= 1000) {
        setFps(framesRef.current);
        framesRef.current = 0;
        lastTimeRef.current = now;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const bools = TOGGLES.filter(t => t.type === 'bool');
  const ranges = TOGGLES.filter(t => t.type === 'range');

  return (
    <div style={{
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      background: 'rgba(6,6,14,0.85)',
      borderRadius: 10,
      padding: '8px 12px',
      border: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(8px)',
      width: '100%',
      maxWidth: 360,
      ...style,
    }}>
      {/* FPS + bool toggles — single row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: fps >= 50 ? '#00ff88' : fps >= 30 ? '#ffaa00' : '#ff4444', marginRight: 4 }}>{fps}<span style={{ fontSize: 7, color: 'rgba(255,255,255,0.3)', marginLeft: 2 }}>fps</span></span>
        {bools.map(toggle => (
          <label key={toggle.key as string} onClick={() => onChange({ [toggle.key]: !config[toggle.key] })} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <div style={{
              width: 8, height: 8, borderRadius: 4,
              background: config[toggle.key] ? '#00ff88' : 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              transition: 'background 0.15s',
            }} />
            <span style={{ fontSize: 8, color: config[toggle.key] ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)' }}>{toggle.label}</span>
          </label>
        ))}
      </div>

      {/* Range sliders — grid 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
        {ranges.map(toggle => (
          <div key={toggle.key as string}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{toggle.label}</span>
              <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.2)' }}>
                {Number(config[toggle.key] || 0).toFixed(toggle.step && toggle.step < 0.01 ? 4 : 1)}
              </span>
            </div>
            <input
              type="range"
              min={toggle.min} max={toggle.max} step={toggle.step}
              value={Number(config[toggle.key] || 0)}
              onChange={e => onChange({ [toggle.key]: parseFloat(e.target.value) })}
              style={{ width: '100%', height: 2, accentColor: '#00ff88' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default GlobeDevTools;
