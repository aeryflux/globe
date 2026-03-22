# @aeryflux/globe

[![npm version](https://img.shields.io/npm/v/@aeryflux/globe.svg)](https://www.npmjs.com/package/@aeryflux/globe)
[![npm downloads](https://img.shields.io/npm/dm/@aeryflux/globe.svg)](https://www.npmjs.com/package/@aeryflux/globe)
![License](https://img.shields.io/badge/license-MIT-green.svg)

Portable 3D globe component for React and React Native (Expo).

**[Live Demo](https://aeryflux.github.io/globe-demo/)** | **[npm](https://www.npmjs.com/package/@aeryflux/globe)**

## Features

- **Cross-platform**: Works on web (React) and mobile (Expo)
- **Three.js powered**: High-quality 3D rendering with WebGL
- **Customizable themes**: Dark, Green, White surfaces
- **Data visualization**: Highlight countries with custom colors
- **City markers**: 185 major cities with hexagonal borders
- **WebGL fallback**: Graceful degradation when WebGL unavailable
- **CDN-served models**: Pre-generated GLB files with 169 countries and 185 cities

## Installation

```bash
npm install @aeryflux/globe three
```

## Usage

### React (Web)

```tsx
import { Globe } from '@aeryflux/globe/react';

function App() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Globe
        surface="green"
        showCountries={true}
        rotationSpeed={0.0005}
      />
    </div>
  );
}
```

### React Native (Expo)

```tsx
import { buildGlobeIndex, applyGlobeMaterials } from '@aeryflux/globe/react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';

// Full Expo implementation requires manual Three.js setup
// See expo-three documentation for GLView configuration
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `surface` | `'dark' \| 'green' \| 'white'` | `'green'` | Color theme |
| `showCountries` | `boolean` | `false` | Show country fills |
| `showCities` | `boolean` | `false` | Show city markers |
| `countryData` | `Record<string, DataPoint>` | - | Country highlight data |
| `cityData` | `Record<string, DataPoint>` | - | City highlight data |
| `dataHighlightColor` | `string` | accent | Default highlight color |
| `rotationSpeed` | `number` | `0.0003` | Auto-rotation speed |
| `glowIntensity` | `number` | `1.2` | Border glow intensity |
| `bloomStrength` | `number` | `1.0` | Post-processing bloom |
| `enableControls` | `boolean` | `false` | Enable orbit controls |
| `modelUrl` | `string` | CDN | Custom GLB model URL |

`DataPoint`: `{ scale: number; color?: string; extrusion?: number }`

## Models

Models are served from jsDelivr CDN by default for optimal performance in production builds.

| Model | Size | Use Case |
|-------|------|----------|
| `atlas_hex_subdiv_5.glb` | 2MB | Mobile |
| `atlas_hex_subdiv_6.glb` | 7MB | Desktop |
| `atlas_hex_subdiv_7.glb` | 20MB | High quality (default) |
| `weather_hex_globe_subdiv_3.glb` | 212KB | Weather overlay |

Default model is `atlas_hex_subdiv_7.glb` served from `cdn.jsdelivr.net`. Use `modelUrl` prop for custom models:

```tsx
// Use a smaller model for mobile
<Globe modelUrl="https://cdn.jsdelivr.net/npm/@aeryflux/globe@0.6.4/models/atlas_hex_subdiv_5.glb" />

// Self-host models (copy to your public folder)
<Globe modelUrl="/models/atlas_hex_subdiv_7.glb" />
```

## Data Visualization

```tsx
import { Globe } from '@aeryflux/globe/react';

const countryData = {
  France: { scale: 0.8, color: '#ef4444' },
  Japan: { scale: 0.6, color: '#3b82f6' },
  Brazil: { scale: 1.0, color: '#22c55e' },
};

<Globe
  surface="dark"
  showCountries
  countryData={countryData}
  dataHighlightColor="#00ff88"
/>
```

## Surfaces

| Surface | Accent | Background | Countries |
|---------|--------|------------|-----------|
| `dark` | White | #050508 | Light gray |
| `green` | #00ff88 | #050508 | Light gray |
| `white` | Black | #ffffff | Light gray |

## License

MIT - Created by [AeryFlux](https://github.com/aeryflux)

## Credits

- [Three.js](https://threejs.org/) - 3D rendering
- [geojsonto3D](https://github.com/martinbaud/geojsonto3D) - Globe model generation
- [Natural Earth](https://www.naturalearthdata.com/) - Geographic data
