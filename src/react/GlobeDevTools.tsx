/**
 * GlobeDevTools — minimal vertical toggle panel for development
 *
 * Import alongside Globe to control props visually.
 * Inspired by drawer UI — vertical icon toggles on the edge.
 */

import { useState, CSSProperties } from 'react';
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
  icon: string;
  type: 'bool' | 'range';
  min?: number;
  max?: number;
  step?: number;
}

const TOGGLES: Toggle[] = [
  { key: 'showCountries', label: 'Countries', icon: '🌍', type: 'bool' },
  { key: 'showCities', label: 'Cities', icon: '🏙️', type: 'bool' },
  { key: 'enableControls', label: 'Controls', icon: '🖱️', type: 'bool' },
  { key: 'glowIntensity', label: 'Glow', icon: '✨', type: 'range', min: 0, max: 3, step: 0.1 },
  { key: 'rotationSpeed', label: 'Speed', icon: '🔄', type: 'range', min: 0, max: 0.005, step: 0.0001 },
  { key: 'bloomStrength', label: 'Bloom', icon: '💡', type: 'range', min: 0, max: 3, step: 0.1 },
];

const SURFACES = ['dark', 'green', 'white'] as const;

export function GlobeDevTools({ config, onChange, side = 'right', style }: GlobeDevToolsProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      position: 'absolute',
      top: 16,
      [side]: 16,
      zIndex: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      ...style,
    }}>
      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: 32, height: 32, borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)',
          background: expanded ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
          color: '#fff', fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {expanded ? '×' : '⚙'}
      </button>

      {expanded && (
        <div style={{
          background: 'rgba(6,6,14,0.92)',
          borderRadius: 12,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          border: '1px solid rgba(255,255,255,0.08)',
          minWidth: 140,
          backdropFilter: 'blur(8px)',
        }}>
          {/* Surface selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {SURFACES.map(s => (
              <button
                key={s}
                onClick={() => onChange({ surface: s })}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 9,
                  border: config.surface === s ? '1px solid rgba(0,255,136,0.4)' : '1px solid rgba(255,255,255,0.1)',
                  background: config.surface === s ? 'rgba(0,255,136,0.1)' : 'transparent',
                  color: config.surface === s ? '#00ff88' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Toggles */}
          {TOGGLES.map(toggle => (
            <div key={toggle.key as string} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12 }}>{toggle.icon}</span>
              {toggle.type === 'bool' ? (
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', flex: 1 }}>
                  <input
                    type="checkbox"
                    checked={!!config[toggle.key]}
                    onChange={e => onChange({ [toggle.key]: e.target.checked })}
                    style={{ accentColor: '#00ff88' }}
                  />
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{toggle.label}</span>
                </label>
              ) : (
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{toggle.label}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                      {Number(config[toggle.key] || 0).toFixed(toggle.step && toggle.step < 0.01 ? 4 : 1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={toggle.min} max={toggle.max} step={toggle.step}
                    value={Number(config[toggle.key] || 0)}
                    onChange={e => onChange({ [toggle.key]: parseFloat(e.target.value) })}
                    style={{ width: '100%', height: 4, accentColor: '#00ff88' }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GlobeDevTools;
