# @aeryflux/globe

[![npm version](https://img.shields.io/npm/v/@aeryflux/globe.svg)](https://www.npmjs.com/package/@aeryflux/globe)
[![npm downloads](https://img.shields.io/npm/dm/@aeryflux/globe.svg)](https://www.npmjs.com/package/@aeryflux/globe)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Portable 3D globe component for React and React Native (Expo). Built on Three.js with music-reactive visuals, data visualization, and ambient wave animations.

**[Live Demo](https://aeryflux.github.io/globe-demo/)** | **[npm](https://www.npmjs.com/package/@aeryflux/globe)** | **[AeryFlux](https://aeryflux.com)**

## Features

- **Cross-platform** — React (web) and React Native (Expo)
- **Three.js powered** — WebGL rendering with post-processing bloom
- **Data visualization** — highlight countries and cities with custom colors and extrusion
- **Music reactivity** — bass, energy, and BPM-driven rotation and wave intensity
- **Ambient wave** — dual gaussian sweep with optional radial extrusion (hola effect)
- **Intro animation** — slide-in from left with spin
- **Dynamic gradients** — real-time background and globe fill tint updates
- **3 surface themes** — dark, green, white
- **City markers** — 185 major cities with hexagonal borders
- **CDN-served models** — pre-generated GLB files (212KB to 20MB)
- **SVG fallback** — graceful degradation when WebGL is unavailable

## Installation

### React (Web)

```bash
npm install @aeryflux/globe three
```

### React Native (Expo)

```bash
npm install @aeryflux/globe three expo-gl expo-three
```

## Quick Start

### React (Web)

```tsx
import { Globe } from '@aeryflux/globe/react';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Globe
        surface="green"
        showCountries
        rotationSpeed={0.0005}
      />
    </div>
  );
}
```

### React Native (Expo)

```tsx
import { Globe } from '@aeryflux/globe/react-native';

export default function App() {
  return (
    <Globe
      surface="dark"
      showCountries
      showBorders
      introAnimation
      rotationSpeed={0.0004}
    />
  );
}
```

Model loads from CDN automatically — no assets to configure.

#### Metro config

Add a `metro.config.js` at the root of your Expo project:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@aeryflux/globe/react-native') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/@aeryflux/globe/dist/react-native/index.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
```

## Props

### Appearance

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `surface` | `'dark' \| 'green' \| 'white'` | `'green'` | Color theme |
| `borderColor` | `string` | - | Override border/accent color |
| `countryColor` | `string` | - | Override country fill color |
| `globeFillColor` | `string` | - | Override ocean fill color |
| `glowIntensity` | `number` | `1.2` | Border glow intensity |
| `bloomStrength` | `number` | `1.0` | Post-processing bloom |
| `isLightTheme` | `boolean` | `false` | Reduce bloom for light backgrounds |
| `forceTransparent` | `boolean` | `false` | Force transparent background |

### Display

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showCountries` | `boolean` | `true` | Show country fills |
| `showBorders` | `boolean` | `true` | Show border lines |
| `showGlobeFill` | `boolean` | `true` | Show ocean/globe |
| `showCities` | `boolean` | `false` | Show city markers |

### Interaction

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enableControls` | `boolean` | `false` | Enable orbit controls (drag, zoom) |
| `rotationSpeed` | `number` | `0.0003` | Auto-rotation speed |
| `onCountryClick` | `(name: string) => void` | - | Country click handler (requires `enableControls`) |

### Data Visualization

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `countryData` | `Record<string, DataPoint>` | - | Country highlights |
| `cityData` | `Record<string, DataPoint>` | - | City highlights |
| `dataHighlightColor` | `string` | accent | Default highlight color |

`DataPoint`: `{ scale: number; color?: string; extrusion?: number }`

### Ambient Wave

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `ambientColor` | `string` | accent | Wave accent color |
| `ambientIntensity` | `number` | `0.4` | Wave intensity (0-1) |
| `ambientExtrusion` | `number` | `0` | Radial displacement on wave peaks (0 = off, 1 = full) |

### Music Reactivity

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bass` | `number` | `0` | Bass level (0-1.5) — boosts rotation and wave |
| `mid` | `number` | `0` | Mid frequency level (0-1) |
| `treble` | `number` | `0` | Treble level (0-1) |
| `energy` | `number` | `0` | Overall energy (0-1) — boosts rotation and wave |

### Dynamic Background

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gradientTop` | `string` | `'#06060e'` | Background gradient top color |
| `gradientBottom` | `string` | `'#0e1430'` | Background gradient bottom color |
| `globeFillTint` | `string` | - | Real-time globe fill tint override |

### Intro Animation

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `introAnimation` | `boolean` | `false` | Enable slide-in + spin entry |
| `introDuration` | `number` | `2.5` | Animation duration in seconds |

### Other

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modelUrl` | `string` | CDN | Custom GLB model URL |
| `className` | `string` | - | CSS class |
| `style` | `CSSProperties` | - | Inline styles |
| `debug` | `boolean` | `false` | Debug mode |

## Data Visualization

```tsx
import { Globe } from '@aeryflux/globe/react';

const countryData = {
  France: { scale: 0.8, color: '#ef4444' },
  Japan: { scale: 0.6, color: '#3b82f6', extrusion: 0.5 },
  Brazil: { scale: 1.0, color: '#22c55e' },
};

<Globe
  surface="dark"
  showCountries
  countryData={countryData}
  dataHighlightColor="#00ff88"
/>
```

## Music-Reactive Globe

```tsx
<Globe
  surface="dark"
  showCountries
  ambientIntensity={0.6}
  ambientExtrusion={0.3}
  bass={bassLevel}
  energy={energyLevel}
  rotationSpeed={0.0005}
  gradientBottom="#1a0a00"
/>
```

Bass and energy values drive rotation speed, wave sweep velocity, and extrusion displacement in real-time.

## Dev Tools

```tsx
import { Globe, GlobeDevTools } from '@aeryflux/globe/react';

const [config, setConfig] = useState<GlobeConfig>({ surface: 'green' });

<Globe {...config} />
<GlobeDevTools
  config={config}
  onChange={(partial) => setConfig(prev => ({ ...prev, ...partial }))}
  side="right"
/>
```

Interactive panel with toggles for all visual options: ocean, countries, borders, cities, controls, glow, speed, bloom, bass, energy, and ambient settings.

## Models

Models are served from jsDelivr CDN by default.

| Model | Size | Use Case |
|-------|------|----------|
| `atlas_hex_subdiv_5.glb` | 2MB | Mobile |
| `atlas_hex_subdiv_6.glb` | 7MB | Desktop |
| `atlas_hex_subdiv_7.glb` | 20MB | High quality (default) |
| `weather_hex_globe_subdiv_3.glb` | 212KB | Weather overlay |

```tsx
// Use a smaller model for mobile
<Globe modelUrl="https://cdn.jsdelivr.net/npm/@aeryflux/globe@0.8.0/models/atlas_hex_subdiv_5.glb" />

// Self-host models
<Globe modelUrl="/models/atlas_hex_subdiv_7.glb" />
```

## Surfaces

| Surface | Accent | Background | Countries |
|---------|--------|------------|-----------|
| `dark` | `#00ff88` | `#050508` | Light gray |
| `green` | `#00ff88` | `#050508` | Light gray |
| `white` | `#1a1a1a` | `#ffffff` | Light gray |

## Exports

### `@aeryflux/globe/react`

```ts
Globe, GlobeFallback, GlobeDevTools, useWebGLSupport
SURFACES, GLOBE_MODELS
animateDataHighlights, animateCityHighlights
// + all types
```

### `@aeryflux/globe/react-native`

```ts
Globe, GlobeNativeProps
// Core renderer utilities (for custom integrations)
buildGlobeIndex, getSurfaceColors, applyGlobeMaterials
createGlobeScene, createGlobeCamera
animateGlobeRotation, animateBorderPulse, animateAmbientWave
animateDataHighlights, animateCityHighlights
resetAllCountries, resetAllCities
updateGradient, updateGlobeFillTint, updateAccentLight
createIntroState, applyIntroAnimation
// + all types
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, build/test workflow,
and pull request guidelines.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for a detailed history of changes per version.

## License

MIT - [AeryFlux](https://github.com/aeryflux)

## Credits

- [Three.js](https://threejs.org/) - 3D rendering
- [geojsonto3D](https://github.com/martinbaud/geojsonto3D) - Globe model generation
- [Natural Earth](https://www.naturalearthdata.com/) - Geographic data
