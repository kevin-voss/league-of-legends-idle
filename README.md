# Idle Rifts

A dependency-light TypeScript canvas idle auto-battler inspired by MOBA strategy loops: roles, lanes, jungle camps, objectives, team building, post-match rewards, and persistent account progression.

## Run Locally

Requires [Node.js](https://nodejs.org/) 24+ (for built-in TypeScript stripping).

```bash
make install   # once
make start     # build + dev server
```

Or with npm:

```bash
npm install
npm start
```

Then open the URL printed in the terminal (default `http://127.0.0.1:4173`), click **Start** to enter the 3D match.

**Debug rendering:** add `?debug=1` to the URL (e.g. `http://127.0.0.1:4173/?debug=1`) for console logs and an on-screen scene stats panel. Or run `localStorage.setItem('idle-rifts-debug','1')` in DevTools.

3D models live in `src/assets/` and are served at `/game-assets/`; compiled JS is emitted to `dist/`.

**Asset packs in use**

- Match units: KayKit Adventurers + Skeletons (GLB)
- Turrets / nexus: KayKit Medieval Hexagon Pack buildings (FBX)
- Map foliage: Stylized Nature MegaKit when extracted (see below), otherwise Medieval nature FBX as fallback
- Ground / river: Medieval hex tiles (`hex_grass`, `hex_water`, `hex_river_*`)

Extract [Stylized Nature MegaKit](https://quaternius.com) into `src/assets/Stylized Nature MegaKit/` (so it contains `.fbx` or `.glb` files), then run `make build` to regenerate `nature-manifest.json`.

## Validate

```bash
make test
```

Equivalent: `npm test`
