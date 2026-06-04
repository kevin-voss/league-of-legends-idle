# Rift map reference

This document describes how the **Idle Rifts** map is laid out in code (`src/data/MapData.ts`), how names like **blue jungle** map to geometry, and where camps, towers, and objectives live.

## Coordinate system

| Property | Value |
|----------|--------|
| Logic plane | `1920 × 1920` (`CANVAS_WIDTH` / `CANVAS_HEIGHT`) |
| Origin | Top-left `(0, 0)` |
| **x** | Increases to the **right** |
| **y** | Increases **downward** (larger y = lower on the logic plane) |
| World scale | `LOGIC_TO_WORLD = 1/96` for the 3D view |

When you play, the camera uses an **isometric** projection, so “up on screen” is not the same as “decreasing y”. Jungle names always refer to **lane borders**, not screen direction.

## Teams and bases

| Side | Nexus position | Corner |
|------|----------------|--------|
| **Blue** | `(100, 1820)` | Bottom-left |
| **Red** | `(1820, 100)` | Top-right |

Each team pushes along three **lanes** from its nexus toward the river, then into the enemy half.

## River

The rift river is a **diagonal** from top-left to bottom-right:

- **River top (mouth):** `(120, 120)` — near the top-left of the map  
- **River bottom (mouth):** `(1800, 1800)` — near the bottom-right  
- **River mid:** `(960, 960)` — center clash point  

`RIVER_PATH` connects top → bottom. Neutral **Baron** and **Dragon** pits sit on the river between mid and the top/bot lane mouths.

## Lanes (blue side)

Blue’s half of each lane runs from the blue nexus to the river.

```
                    RIVER_TOP (120,120)
                         ●
                        / \
           top lane ----/   \---- mid lane
          (west edge) /       \
                     /         \
        BLUE_NEXUS ●             ● RIVER_MID (960,960)
          (100,1820) \           /
                      \         /
           bot lane ----\       /---- (continues to red)
          (south edge)   \   /
                         ●
                 RIVER_BOT (1800,1800)
```

| Lane | Blue path (simplified) | Role |
|------|------------------------|------|
| **Top** | Nexus → top-left corner `(120,120)` → river top | Top laner |
| **Mid** | Nexus → river mid | Mid laner |
| **Bot** | Nexus → bottom-right corner `(1800,1820)` → river bot | ADC / support |

Red lanes mirror the same river endpoints from the red nexus.

## Structures

Per lane, each side has:

| Structure | Progress along nexus → edge | Notes |
|-----------|----------------------------|--------|
| **Inner tower (T2)** | 35% | Closer to base |
| **Outer tower (T1)** | 70% | Closer to river |
| **Nexus** | Base position | Must open a lane before damage |

Tower positions are computed on the **nexus → lane edge** rail, not the full cross-map rail.

## What “blue jungle” means

**Blue jungle** is all neutral territory on **blue’s side of the river**: the area bounded by blue’s top, mid, and bot lanes and the river. The jungler path (`JUNGLE_PATHS.blue`) starts at the nexus, clears **bot jungle**, then **top jungle**.

It is **not** “everything blue on the minimap” in one blob — it is split into two pockets:

### Blue top jungle (2 camps)

- **Between:** top lane and mid lane  
- **Camp IDs:** `blue-top-wolves`, `blue-top-gromp`  
- **Inner camp** (near top/turret side): Wolves at `(210, 450)`  
- **River camp** (toward rift): Gromp at `(650, 780)`  
- **Pocket center:** midpoint ≈ `(430, 615)`  

### Blue bot jungle (2 camps)

- **Between:** mid lane and bot lane  
- **Camp IDs:** `blue-bot-raptors`, `blue-bot-krugs`  
- **Inner camp** (near bot/turret side): Raptors at `(480, 1640)`  
- **River camp** (toward rift): Krugs at `(780, 1480)`  
- **Pocket center:** midpoint ≈ `(630, 1560)`  

Each pocket uses an **inner** and **river** slot so camps sit in the jungle wedge (between turrets, river, and lane rails), not on the mid-lane path.

```
Logic plane (blue half, schematic):

  y=120  ─── top lane corner
    │
    │     [TOP JUNGLE]  ← Wolves + Gromp (between top & mid)
    │         ●   ●
    │          \ /
    │           ●  mid rail
    │          / \
    │     [BOT JUNGLE]  ← Raptors + Krugs (between mid & bot)
    │         ●   ●
  y=1820 ─── bot lane / nexus
    x=100              x=1800
```

### Red jungle (2 + 2 camps)

Red uses the same naming (**top** / **bot** = lane borders from red’s perspective):

| Red pocket | Between lanes | Camps | Center (logic) |
|------------|---------------|-------|----------------|
| **Red top jungle** | Top + mid | Wolves, Gromp | centers mirror blue **bot** pocket |
| **Red bot jungle** | Mid + bot | Raptors, Krugs | centers mirror blue **top** pocket |

Diagonal symmetry: **blue top jungle** mirrors to **red bot jungle**, and **blue bot jungle** mirrors to **red top jungle** (`mirrorPoint`: `(x, y) → (1920−x, 1920−y)`). Individual camp slots mirror with the same swap (blue bot inner → red top river, etc.).

## Neutral objectives

| Objective | Lane band | On river |
|-----------|-----------|----------|
| **Baron** | Between mid and **top** mouth | ~28% along river |
| **Dragon** | Between mid and **bot** mouth | ~72% along river |

## Code exports

| Export | Purpose |
|--------|---------|
| `BASE_POSITIONS` | Nexus coordinates |
| `RIVER_PATH` | River polyline |
| `MAP_RAILS` | Full lane polylines per side |
| `getNexusToEdgeRail(lane, side)` | Nexus → lane edge (tower placement) |
| `getLanePath(lane, side)` | Full lane through river |
| `JUNGLE_QUADRANT_CENTERS` | Center of each top/bot jungle pocket |
| `getJungleQuadrantCenter(side, half)` | Single pocket center |
| `JUNGLE_CAMPS` | All eight camp definitions |
| `JUNGLE_PATHS` | Jungler visit order per side |
| `OBJECTIVE_POSITIONS` | Baron / dragon pits |
| `STRUCTURE_LAYOUT` | Towers + nexuses |

## Tuning camps

1. Edit `BLUE_JUNGLE_CAMP_SLOTS` in `MapData.ts` (`inner` / `river` per half).  
2. `JUNGLE_QUADRANT_CENTERS` and red camps are derived automatically.  
3. Keep each camp **>120** logic units from the mid lane and **>80** from any lane.  
4. Run `make test` — tests assert pocket membership, mid-lane clearance, and pair spacing (`MIN_JUNGLE_CAMP_SPACING`).

## Related files

- `src/data/MapData.ts` — source of truth  
- `src/game/map/RiftScene.ts` — 3D pits, props, trees per pocket  
- `src/core/Renderer.ts` — 2D debug map overlays (`?debug=1`)  
- `tests/match.test.mjs` — layout and spacing tests  
