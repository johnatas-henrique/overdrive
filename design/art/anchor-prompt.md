# Overdrive — AI Art Anchor Prompt

> Stylised 3D flat-colour arcade racer, inspired by 4 Pixels Per Gallon (3goo.co.jp) and Horizon Chase Turbo — Senna Forever. Bold shapes, saturated flat colour fields, sense of speed as the ruling principle. No gradients, no photorealism, no grit. Every pixel declares velocity.

---

## 1. Core Style Keywords

Always include a subset of these in every prompt:

```
stylized 3D arcade racing game, flat saturated colours, no gradients, bold colour fields, clean edges, sense of speed, low-poly stylized, geometric, pixel art aesthetic in 3D space
```

**Negative prompts** (things to exclude):

```
--no realistic, photorealistic, bloom, god rays, lens flare, volumetric fog, grit, dirt, film grain, depth of field, chromatic aberration
```

---

## 2. Midjourney Parameters

| Parameter | Recommended | When |
|-----------|-------------|------|
| Aspect | `--ar 16:9` | Cutscenes, concept art |
| Aspect | `--ar 3:2` | Key art, hero shots |
| Stylize | `--s 150` | Default — balanced style, not too wild |
| Stylize | `--s 250` | Cutscenes — more artistic freedom |
| Weird | `--w 30` | Helmet designs — room for creative shapes |
| Chaos | `--c 20` | Environment exploration — varied outcomes |
| Version | `--v 6.1` | Latest — best with flat colour styles |

---

## 3. Prompt Templates Per Use Case

### 3.1 Car Liveries (Concept Art)

Prompt structure: `[team description] [camera angle] [track context] [style keywords] [parameters]`

**Example — Macklen (McLaren parody):**

```
open-wheel formula race car, red body with white accents, number 1 on the nose and rear wing, Marlboro-style red-and-white livery, satin matte finish, flat colour fields, no gradients, solarized palette style, stylized 3D arcade racing aesthetic, chase camera view, pit lane background with pit crew in red, Monaco harbour backdrop, clean edges, sense of speed --ar 16:9 --s 150 --v 6.1 --no realistic, bloom, lens flare, god rays
```

**Example — Willard (Williams parody):**

```
open-wheel formula race car, navy blue body with white and gold stripes, number 5 on nose and rear wing, Canon-era Williams styling, flat colours, satin finish, track debris visible, exhaust heat haze stylized as orange zigzag on flat background, medium shot three-quarter front, Spa Francorchamps Eau Rouge background, stylized 3D arcade aesthetic --ar 16:9 --s 150 --v 6.1
```

**Example — Ferrell (Ferrari parody):**

```
open-wheel formula race car, Ferrari red #DC0000 body, yellow accents, number 27 on nose, V12 car silhouette, Monza start-finish straight, tifosi in geometric grandstands, red and yellow flag lines on grandstand roof, flat saturated colour design, retro 90s racing aesthetic --ar 16:9 --s 150 --v 6.1
```

**Example — Lorris (Lotus parody / player start car):**

```
open-wheel formula race car, Camel yellow #E8A800 and black #181818 livery, number 11 on the nose, gold body with black wings, late 80s low-nose geometry, John Player Special-inspired colour split, stylized 3D, flat colour, geometric simplicity, garage pit stop lighting, warm overhead lamps reflecting on yellow paint, cockpit camera low angle --ar 16:9 --s 150 --v 6.1
```

**Example — Layton Hall (Leyton House parody):**

```
open-wheel formula race car, dark turquoise #00CED1 and teal green #175D52 livery, number 16, futuristic 1991 flat-sidepod design, CK logo on sidepod in white outline, stylized 3D, flat colour, no bloom, Interlagos infield lake background, geometric trees, dense green terrain, bright daylight high contrast --ar 16:9 --s 150 --v 6.1
```

---

### 3.2 Race Action (Cutscenes)

**Race start (pack shot):**

```
8 open-wheel formula cars bunched into first corner, side-by-side at turn-in, brake lights glowing, tyres smoking in flat stylized cloud puffs, red, yellow, blue, green, turquoise liveries contrasting, grandstand packed with flat colour silhouettes of spectators, checkered flag gantry above, stylized 3D, flat saturated colours, bold shapes, clean edges, Saturday afternoon sunlight, green and blue palette for foliage, shadow as darker flat tone, no gradient, no blur --ar 16:9 --s 250 --v 6.1
```

**Cockpit view — speed sensation:**

```
first person cockpit camera in open-wheel formula car, steering wheel in foreground with flat coloured buttons, gear shift lights at top of wheel frame, rival car nose visible ahead, track barriers and fencing rushing past as simplified flat shapes, grey asphalt, red and white kerb blocks, stylized speed lines radiating from centre of screen, flat saturated colour, clean sharp edges, retro arcade racing 1990s aesthetic, 640x480 pixel art upscale feel, high contrast, warm afternoon glow --ar 16:9 --s 150 --v 6.1
```

**Overtake moment:**

```
car number 11 (Camel yellow and black) overtaking car number 5 (navy blue) on the outside of a fast sweeper, both cars leaned into corner, yellow car slightly ahead, wheel to wheel, kerb blocks beneath tyres, grandstand with flat-colour spectators on the outside of the corner, stylized speed lines from both cars, corner marshals in orange flat colour at post, clean sharp edges, flat saturated colours, sunny afternoon, geometric background --ar 16:9 --s 250 --v 6.1
```

**Victory celebration — podium:**

```
open-wheel formula car number 11 parked in parc fermé, driver helmet (silver-white with diagonal blue and red bands) visible through cockpit, champagne spray as flat blue-and-white zigzag shapes (no realistic liquid), podium girls in flat colour, checkered flag waving, stylized geometric confetti as tiny squares, golden hour sunset behind podium, stylized 3D flat colour, clean edges, no gradients --ar 16:9 --s 250 --v 6.1
```

**Night race:**

```
open-wheel formula car on night street circuit, city buildings as flat geometric blocks with emissive yellow-lit windows, streetlights as bright orange cones casting flat hard-edged shadows on track, car headlights as white trapezoids on asphalt, brake lights glowing red, dark blue sky with no stars, Monaco harbour visible as dark flat navy plane with reflected building lights as rectangular blocks, stylized 3D flat colour, high contrast, clean edges --ar 16:9 --s 200 --v 6.1
```

---

### 3.3 Environment & Track Concept

**Spa Francorchamps clone (temperate forest):**

```
stylized recreation of Spa Francorchamps Eau Rouge sector, open-wheel formula car cresting the Raidillon rise, dense geometric pine trees in layered dark green and blue-grey on both sides of the track, Armco barriers as continuous silver band, red and white kerbs, overcast sky in cold blue-grey #6B8FA3, track surface in dark #2A2A2A, simplified grandstand at the top of the hill, mist band at treeline as flat horizontal grey stripe, stylized 3D arcade aesthetic, flat colour, clean edges, no fog --ar 16:9 --s 150 --v 6.1
```

**Monza clone (park venue):**

```
stylized recreation of Monza Parabolica curve, open-wheel formula car at corner exit, large grandstand on the inside filled with geometric red-and-white flat spectators, formal park with hedge cubes and geometric flowerbeds in red and yellow, bright blue sky #3B82D6, white cloud puffs as flat circles, warm sunlight, high contrast, stylized 3D arcade aesthetic, clean flat saturated colours, retro racing feel --ar 16:9 --s 150 --v 6.1
```

**Monaco clone (street circuit):**

```
stylized recreation of Monaco Fairmont hairpin, open-wheel formula car at slowest corner, buildings on the outside as blocky geometric shapes in warm beige and cream, hotel facade with simplified windows as flat dark rectangles, harbour water as flat navy plane with small geometric sailboats, yacht in harbour with white hull, palm trees as stylized card polygons, bright sunny Mediterranean sky, hard dark shadow shapes on track surface, flat colour, stylized 3D --ar 16:9 --s 150 --v 6.1
```

**Interlagos clone (inland hillside):**

```
stylized recreation of Interlagos Senna S section, open-wheel formula car between two S-curves, grandstands with green-and-white flat spectators on main straight side, geometric terracotta-roofed buildings in infield, reservoir lake as flat dark blue oval behind track, sculpted green hills in background with simplified shadow bands, warm humid sky #3B82D6, high contrast, dark tyre marks on grey asphalt, stylized 3D flat colour --ar 16:9 --s 150 --v 6.1
```

---

### 3.4 Helmet Designs

```
racing driver helmet, silver-white background with diagonal blue #1565C0 and red #DC0000 bands, black #181818 bottom edge, flat colour, stylized geometric, viewed from left profile, inside a formula car cockpit with roll hoop visible, flat lighting, no reflection, no gradient, clean sharp edges, retro 90s helmet shape, close-up --ar 3:2 --s 150 --w 30 --v 6.1
```

**To adapt for another helmet:** change the colour sequence and band arrangement based on the Section 5.3 description of each driver.

---

### 3.5 UI / HUD Mockup

```
racing game heads-up display overlay, arcade racing game UI, top-left has a stylized track mini-map drawn as simplified geometric shape with coloured dots for car positions, top-centre has large speed number 287 km/h in bold white sans-serif, below it position "P8/8" and lap counter "Lap 2/4", top-right has fuel gauge as horizontal blue bar and tyre condition as horizontal cyan bar, all UI elements have sharp clean edges, no shadows on UI, flat design, semi-transparent dark background panels, racing telemetry aesthetic, retro arcade clean --ar 16:9 --s 150 --v 6.1
```

---

### 3.6 Key Art / Cover

```
dynamic composition of 3 open-wheel formula cars racing side by side, red car leading, yellow car second, blue car third, coming out of corner at high speed, brightly coloured saturated flat colour aesthetic, stylized 3D arcade racing game style, checkered flag overlay corner, golden hour sky, clean sharp shapes, bold colour contrast, readable car numbers: 1, 5, 27, motion marks as flat coloured lines trailing each car, retro 90s racing game poster, no text, no logo --ar 16:9 --s 250 --v 6.1
```

---

## 4. Colour Hex Reference (Quick Copy)

| Name | Hex | Visual |
|------|-----|--------|
| Macklen Red | `#C8102E` | McLaren red |
| Willard Blue | `#0051BA` | Williams blue |
| Ferrell Red | `#DC0000` | Ferrari red |
| Bennett Yellow | `#FFD700` | Benetton yellow |
| Bennett Green | `#006B3F` | Benetton green |
| Jordash Green | `#006B3F` | Jordan green |
| Jordash Blue | `#003DA5` | Jordan blue |
| Tyrant Navy | `#404058` | Tyrrell navy |
| Tyrant Blue | `#002060` | Tyrrell royal blue |
| Lorris Gold | `#E8A800` | Lotus gold |
| Lorris Black | `#181818` | Lotus black |
| Layton Turquoise | `#00CED1` | Leyton House turquoise |
| Layton Teal | `#175D52` | Leyton House teal |
| Race Red | `#E8301A` | Alert |
| Track Black | `#2A2A2A` | Asphalt |
| Kerb White | `#F0F0F0` | Track edge |
| Asphalt Grey | `#4A4A4A` | Runoff |
| Signal Yellow | `#F5C800` | Caution |
| Fuel Blue | `#00BFFF` | Fuel gauge |
| Tyre Cyan | `#00E5FF` | Tyre indicator |

---

## 5. Workflow Tips

1. **Start with the template** that matches your use case (car, track, cutscene, etc.)
2. **Replace the team description** with the team you want (Macklen, Willard, Ferrell, etc.)
3. **Copy the colour hex** from the reference table if you want a specific shade
4. **Upscale** your favourite 2-3 variations before refining
5. **Use the --no list** to eliminate photorealistic effects — this is critical for the flat colour style
6. **Re-roll (🔁) compositions** that lean toward realism — the flat colour style needs consistent reinforcement
