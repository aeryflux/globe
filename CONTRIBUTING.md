# Contributing to @aeryflux/globe

Thank you for your interest in contributing to `@aeryflux/globe`. This document covers
the workflow for building, testing, and submitting changes.

## Prerequisites

- Node.js v22+
- npm v10+
- A GitHub account

## Setup

```bash
git clone https://github.com/aeryflux/globe.git
cd globe
npm install
```

## Development workflow

### Build

```bash
npm run build
```

The package uses a dual entry point (`react` and `react-native`). Make sure both
entry points work after any change.

### Test

```bash
npm test
```

All tests must pass before submitting a pull request. The test suite uses Vitest.

### Lint

If a linter is configured, run it before committing:

```bash
npm run lint
```

## Making changes

1. Fork the repository and clone your fork.
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
3. Make your changes with clear, focused commits.
4. Run `npm test` and confirm everything passes.
5. Push your branch and open a pull request against `main`.

## Commit conventions

This project follows conventional commits:

```
feat(scope): description    # New feature
fix(scope): description     # Bug fix
docs: description           # Documentation
chore: description          # Maintenance
refactor: description       # Refactoring
test: description           # Tests
perf: description           # Performance
```

- Write commit messages in English.
- Keep the subject line under 72 characters.
- Use the body for additional context when needed.

## Pull request guidelines

- Keep PRs small and focused on a single concern.
- Reference any related issue in the PR description (e.g. `Closes #12`).
- Include a short summary of what changed and why.
- Add or update tests for new behavior.
- Do not include generated files (`dist/`, `node_modules/`).

## Publishing (maintainers only)

The package is published to npm under the `@aeryflux` scope:

```bash
npm version patch   # or minor / major
npm run build
npm publish --access public
```

Version bumps, changelogs, and npm publishes are handled by maintainers.

## Code of conduct

Be respectful, constructive, and professional in all interactions.

## Questions

Open an issue on GitHub if you have questions or need guidance before starting work.
