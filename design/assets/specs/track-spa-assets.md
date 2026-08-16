# Asset Spec — Track: Spa-Francorchamps

> **Source:** art-bible.md §5.4 (Spa identity), track-system.md, spa-francorchamps.be, wikipedia
> **Era:** 1989 season configuration (6.940 km, 19 corners, 102m elevation)
> **Atmosphere:** Ardennes forest, dense green canopy, dappled light, elevation changes, misty
> **Palette emphasis:** Forest green (#2E5C3A), dark asphalt (#3A3A3A), moss tones, brown earth
> **Placeholder Strategy:** Blockout uses colored Primitives at approximate positions

---

## Track Identity

Spa in 1989 was unchanged from the 1979 shortened layout: 7 km through the Ardennes forest. The circuit is defined by massive elevation changes (102m — more than any other circuit on the calendar), dense forest lining almost the entire track, and the famous Eau Rouge/Raidillon complex. The pit complex had the iconic **Englebert Tower** — a distinctive tapering tower that served as race control and team area.

**Per-track trackside objects** listed below are in ADDITION to shared assets (ASSET-101 barriers, ASSET-103 grandstands, etc.).

---

## Unique Landmarks

### 1. Englebert Tower

| Field | Value |
|-------|-------|
| Type | Tower integrated into pit building |
| Location | Center of pit straight, behind pit boxes |
| Style | 1950s modernist concrete tower, tapered, wider at base, narrow at top |
| Size | ~20m tall, ~8m wide at base, ~3m at top |
| Notes | Iconic Spa landmark. Has large team logo/branding at top. Integrated into pit building roof. |

**Prompt:**
```
Low-poly exterior of the Englebert Tower at Spa-Francorchamps pit straight,
a tapered concrete modernist tower from the 1950s, wider at the base and narrowing upward,
integrated into the pit building roof, large team branding at the very top,
surrounded by dense Ardennes forest in the background. Fujishima + Matsuri fusion style,
cel-shaded painted texture, clean bold outlines. Warm afternoon light filtering through trees.
In-game 3D anime aesthetic.
```

### 2. Eau Rouge / Raidillon Bridge

| Field | Value |
|-------|-------|
| Type | Bridge over the track |
| Location | At the bottom of Eau Rouge, where the track crosses the stream |
| Style | Small concrete bridge carrying access road |
| Notes | The Eau Rouge stream runs under the track here. This is the lowest point of the circuit. |

**Prompt:**
```
Low-poly concrete bridge at the bottom of Eau Rouge at Spa-Francorchamps,
where the racetrack crosses a small mountain stream (the Eau Rouge),
dense Ardennes forest on both sides, warm afternoon light creating dappled shadows.
Fujishima + Matsuri fusion style, cel-shaded painted texture, clean outlines.
In-game 3D anime aesthetic.
```

### 3. La Source Hairpin Grandstands

| Field | Value |
|-------|-------|
| Type | Large grandstand + hospitality area |
| Location | Around La Source hairpin (T1) |
| Notes | The slowest corner on the circuit, with large elevated grandstands. Renovated in 1989/1990. |
| Style | Concrete stepped terraces with metal bench seating |

### 4. Ardennes Forest (Ambient)

Spa is the only track where **trees are the defining visual feature**. The forest is dense on both sides of the track for most of the lap. This is achieved with:
- Dense placement of ASSET-105a (conifer) trees along track edges
- Green canopy visible from all camera angles
- Dappled lighting effect (simulated in lighting, not geometry)

**Prompt:**
```
Dense Ardennes forest alongside a 1991 formula 1 circuit, tall dark green conifer trees
with scattered broadleaf trees in warm greens, golden afternoon sunlight filtering through
the canopy creating dappled shadows on the track surface. Fujishima + Matsuri fusion style,
cel-shaded painted textures, clean outlines. In-game 3D anime aesthetic.
```

---

## Track-specific Asset Count

| Asset | Count | Placement Notes |
|-------|-------|-----------------|
| Grandstands | ~6 | La Source, Eau Rouge, Kemmel, Pouhon, Blanchimont, pit straight |
| Sponsor billboards | ~10 | Pit straight, Kemmel straight, approach to Pouhon, approach to Blanchimont |
| Distance boards | ~5 sets | Before La Source, Eau Rouge, Les Combes, Pouhon, Bus Stop chicane |
| Light poles | ~8 | Pit lane, pit straight |
| Trees (ASSET-105a conifer) | ~80+ | Dense along entire track (defining visual feature) |
| Trees (ASSET-105b broadleaf) | ~20 | Mixed in with conifers, especially near paddock |
| Barrier segments | Procedural | Along all edges, many with gravel traps |

---

## Key Visual References

- **Forest immersion:** Spa is the only track where you feel surrounded by nature
- **Eau Rouge → Raidillon:** The most famous corner sequence in F1 — a steep downhill left, then a blind uphill right-left sweep
- **Elevation:** 102m change means the track drops and climbs dramatically. The Kemmel straight climbs uphill from Eau Rouge
- **Englebert Tower:** The iconic pit building landmark — no other track has this
- **Weather:** Possible to have rain on one section and sun on another (deferred from MVP)
