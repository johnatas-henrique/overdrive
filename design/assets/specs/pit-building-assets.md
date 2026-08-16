# Asset Spec — Pit Building & Structure

> **Source:** art-bible.md §5.5 (Pit Lane: FIA two-lane model), track-system.md §7
> **Category:** Reusable structure with per-track material tint variation
> **Status:** Draft
> **Date:** 2026-07-28
> **Era reference:** 1989 — pit buildings were functional concrete/steel structures, not the glass high-tech towers of later decades. Monza's 1989 pit was the "high-tech" exception (glass-walled).

---

## 1. Pit Building (Garage Structure)

**Purpose:** 16-team garage building behind the pit wall. Per-track variation in color and roof style but same footprint.

### Spec

| Field | Base (all tracks) | Monaco Variant | Silverstone Variant | Spa Variant | Monza Variant |
|-------|-------------------|----------------|--------------------|-------------|---------------|
| Footprint | 80m × 10m × 6m (L×W×H) | Same (temporary modular metal frames on harbour — no permanent concrete pit building in 1989) | Same (1989 version: 40 garages, 2 stories) | Same (with Englebert Tower section) | Same (48 modular units, 196m × 12.9m, 2 floors) |
| Roof | Flat concrete slab | Flat + temporary fabric awnings | Flat concrete slab | Flat with tower element | Flat with roof terrace |
| Facade | Concrete with team-color garage doors | White metal frame modules, team awnings, city buildings visible behind | Gray concrete, white team stripe | Dark green/brown to blend with forest | High-tech glass wall (trapezoidal section) |
| Floors | 2 (ground: garages, upper: hospitality) | 2 + mezzanine temporary | 2 (garages + press center) | 2 (garages + Englebert level) | 2 (garages + press/hospitality) |
| Tris | ~2000 (entire structure) | ~2500 (more detail) | ~2000 | ~2200 (tower added) | ~2500 (glass segments) |

### Architecture Notes per Track

**Monaco (1989):**
- **No permanent pit building.** Pits are temporary modular metal frame structures erected for race weekend (1973-era configuration).
- Pit lane faces the track normally — the "back-to-front" reversed layout is post-2004.
- Located on Port Hercule harbour straight.
- White metal frames + team-colored awnings. Two levels: garages below, hospitality above.
- Belle Époque buildings (Casino, Hotel de Paris) are landmark architecture around Casino Square, NOT the pit building.

**Silverstone (1989):**
- The 1987 pits: 40 concrete garages in a long 2-story block, press center on top
- Functional utilitarian design
- White/gray concrete with team-colored garage doors
- Flat roof with antenna masts

**Spa (1989):**
- Concrete garage block + the iconic **Englebert Tower**
- Tower is wider at base, narrows upward, with team logo at top
- Pit building blends into forest edge — muted green/brown tones
- Roof has large team banners along the edge

**Monza (1989):**
- **Brand new for 1989** — high-tech glass and steel, very modern for the era
- Trapezoidal section: glass wall facing track is angled (anti-glare)
- Steel uprights at 24m intervals, recticular steel girders
- 48 modular pits (4m frontage each) for 16 teams (3 bays per team)
- Lightness and transparency — completely different from the other three tracks

### Prompt (Base)

```
Low-poly pit building structure at a 1991 formula 1 circuit, a long two-story concrete garage block
with 16 team garage doors along the ground floor, each door painted in bold racing colors,
flat roof with simple parapet, upper floor with small rectangular windows.
Flat cel-shaded painted texture, clean bold outlines, no photo-realism.
In-game 3D anime racing game aesthetic. Isometric render on white background.
Dimensions approximately 80 meters long.
```

### Prompt (Monza Glass Variant — unique, as it's the standout)

```
Low-poly pit building at the Monza formula 1 circuit, 1989 style, a long two-story structure
with a distinctive angled glass wall facing the track to prevent glare,
steel frame with visible uprights at regular intervals, flat roof with a terrace,
modular pit bays below. Clean anime cel-shaded style, painted textures,
light and airy appearance. In-game 3D aesthetic. Isometric render on white background.
```

---

## 2. Pit Wall

**Purpose:** Dividing wall between pit lane fast lane and pit box area.

### Spec

| Field | Value |
|-------|-------|
| Mesh | Extruded wall segment (flat rectangle, thin) |
| Topology | 6 tris per 4m segment |
| Size | 4m × 1.2m height, 0.1m thick |
| Color | White with red diagonal stripes (FIA standard pattern) |
| Material | URP Simple Lit, two-color texture |
| Placement | Continuous along pit lane, between fast lane and pit boxes. Procedural. |

### MVP Blockout
- **Asset:** Thin Box with stripe material

---

## 3. Pit Box Markings

**Purpose:** Ground markings for each of the 16 pit boxes.

### Spec

| Field | Value |
|-------|-------|
| Mesh | Decal on pit lane surface (painted texture, no geometry) |
| Size | 4m × 6m per box |
| Design | White rectangle outline with car number inside |
| Material | Texture applied to pit lane mesh |
| Placement | Generated as part of pit lane material UV |

### MVP Blockout
- Drawn as part of pit lane surface texture (no separate asset)

---

## 4. Start/Finish Gantry

**Purpose:** Overhead structure spanning the track at the start/finish line.

### Spec

| Field | Value |
|-------|-------|
| Mesh | Two side pillars (box columns) + overhead beam (flat box) |
| Topology | ~80 tris |
| Size | 14m wide (spanning track) × 5m height × 1.5m depth |
| Design | White tubular frame with timing display panel area (no functional display in MVP) |
| Material | URP Simple Lit, white + team color accents |
| Placement | At spline progress 0.0 (start/finish). Placed once per track. |

### Prompt

```
Low-poly start/finish overhead gantry at a 1991 formula 1 circuit,
a white metal structure spanning the width of the track, two side pillars
connected by a flat beam across the top, simple digital-style display panel
area in the center. Flat cel-shaded painted texture, clean bold outlines,
no photo-realism. In-game 3D anime aesthetic. 16:9 aspect ratio.
```

### MVP Blockout
- **Asset:** 3 Boxes (2 pillars + 1 beam), white material

---

## 5. Pit Entry/Exit Signage

**Purpose:** Directional signs at pit entry and exit points.

### Spec

| Field | Pit Entry | Pit Exit |
|-------|-----------|----------|
| Mesh | Rectangle on pole + directional arrow | Rectangle on pole |
| Topology | ~15 tris | ~10 tris |
| Text | "PIT IN" implied (white on blue) | White arrow on blue rectangle |
| Placement | At pit entry progress and exit progress, one each per track | One each per track |

### Prompt

```
Low-pit pit entry direction sign at a 1991 formula 1 circuit, a blue rectangular panel
with a large white directional arrow, mounted on a short metal pole at track edge.
Flat cel-shaded painted style, clean bold outlines. Isometric render on white background.
```

### MVP Blockout
- Colored quad with arrow drawn on it

---

## Asset Summary

| Asset ID | Name | Tri Budget | Method | MVP Placeholder |
|----------|------|-----------|--------|-----------------|
| ASSET-102a | Pit building (base) | 2000 | Per-track scene | Large Box set, gray |
| ASSET-102b | Pit wall segment | 6 | Procedural | Thin Box, stripe mat |
| ASSET-102c | Pit box markings | 0 (texture) | Texture on pit lane | — |
| ASSET-102d | Start/finish gantry | 80 | Manual (1 per track) | 3 Boxes, white |
| ASSET-102e | Pit entry/exit sign | 15 | Manual (2 per track) | Colored quad on pole |
