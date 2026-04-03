# Changelog

All notable changes to `@aeryflux/globe` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.7.4] - 2026-03-28

### Fixed

- Prevent Chrome WebGL context loss blocking on heavy scenes.

## [0.7.3] - 2026-03-28

### Added

- Comprehensive README with full API reference.

## [0.7.2] - 2026-03-28

### Added

- Ambient wave performance improvements.
- `ambientExtrusion` prop for radial displacement on wave peaks.

### Fixed

- Reduced country displacement to prevent lateral drift.
- Clamped radial displacement to keep countries on globe surface.

## [0.7.0] - 2026-03-28

### Added

- Per-country wave animation with stronger extrusion.
- Structural `countryData` key for data-driven highlights.
- Dynamic gradient background and globe fill tint props.
- Intro animation (slide-in with spin).
- Horizontal dev tools layout option.

### Fixed

- Restored original material colors on country deselect.
- Single country selection with proper previous-aura reset.
- Clone position/rotation copy with fallback to scene parent.

## [0.6.5] - 2026-03-25

### Added

- Kaspersky-style aura effect on country click (3-layer cascade pulse).
- FPS counter in GlobeDevTools.
- Music-reactive props (`bass`, `energy`, `mid`, `treble`).
- `showBorders` and `showGlobeFill` props.
- GlobeDevTools interactive toggle panel.
- Ambient wave illumination for idle countries.
- Gradient background shader (dark to blue).
- `atlas_hex_subdiv_3` model (239KB, 162 cells).

### Fixed

- Real-time visibility toggle for ocean, countries, borders, and cities via refs.
- `setClearColor` and gradient shader background visibility.
- Alpha renderer disabled so gradient background renders correctly.
- City highlights made data-driven and quasi-static.

## [0.6.0] - 2026-03-24

### Added

- Initial public release.
- Cross-platform React and React Native (Expo) support.
- Three.js WebGL rendering with post-processing bloom.
- Data visualization for countries and cities.
- 3 surface themes (dark, green, white).
- 185 city markers with hexagonal borders.
- CDN-served GLB models (212KB to 20MB).
- SVG fallback for non-WebGL environments.
