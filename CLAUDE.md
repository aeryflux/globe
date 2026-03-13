# @aeryflux/globe

3D globe npm package for React and React Native (Expo).

## Quick Start

```bash
npm run build      # Build with tsup
npm run dev        # Watch mode
npm run typecheck  # TypeScript check
```

## Structure

```
globe/
├── src/
│   ├── index.ts         # Main exports
│   ├── react/           # React web components
│   └── react-native/    # Expo components
├── models/              # GLB 3D models
├── dist/                # Build output
└── tsup.config.ts       # Build config
```

## Package Info

- **npm**: `@aeryflux/globe`
- **Version**: 0.6.2
- **License**: MIT

## Exports

```javascript
import { Globe } from '@aeryflux/globe'           // Default
import { Globe } from '@aeryflux/globe/react'     // Web
import { Globe } from '@aeryflux/globe/react-native'  // Expo
```

## Features

- 169 countries with borders
- 185 cities with markers
- 3 themes: dark, green, white
- Auto-rotation, zoom, click events

## Dependencies

Peer deps (user installs):
- react >= 18
- three >= 0.150

## Related

- Demo: `~/globe-demo`
- Used by: lumos, haki
- Docs: `~/aery-doc/aeryflux/globe.md`
