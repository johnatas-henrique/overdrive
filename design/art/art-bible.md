# Art Bible — Overdrive

_Created: 2026-06-16_
_Status: Signed Off (AD-ART-BIBLE: 2026-06-22 ✅ | Version 1.0)_

---

## Section 1: Visual Identity Statement

> **Art Director Sign-Off (AD-ART-BIBLE)**: 2026-06-22 ✅

### 1.1 The One-Line Visual Rule

**Flat colours, sharp edges, pure speed — every pixel declares velocity.**

When any visual decision is ambiguous, this rule resolves it: eliminate gradients, soften nothing, let every shape and colour field push the eye forward. If it doesn't feel like it's moving at 300 km/h, it doesn't belong.

### 1.2 Supporting Visual Principles

**P1: Stream for Speed** — _Design test: "When choosing between detail and silhouette clarity, this principle says: the shape must read at 300 km/h."_

Anchored to pillar **"Speed That Is Felt"**. Vehicles, environments, and UI elements are reduced to their most readable silhouette. Body panels are broad colour fields with minimal panel breaks. Road details (kerbs, markings, elevation changes) use high-contrast colour blocks rather than texture. The car's identity must resolve from a blur in the corner of the eye during a 400m straight.

**P2: Colour Speaks, Decoration Whispers** — _Design test: "When choosing between a decorative flourish and a functional colour signal, this principle says: every colour carries meaning — use it."_

Anchored to pillar **"Simple Strategy, Real Decisions"**. Fuel state, tire wear, boost readiness, and rival threat are communicated through the palette itself — not through icons or meters that fight the speed. Green-to-red shifts on the HUD, tire-glow temperature bands, and track-surface colour zones replace numerical readouts. A gradient is never the answer; a colour shift is.

**P3: Progress Is a Palette Shift** — _Design test: "When showing player advancement, this principle says: change the colour, not the geometry."_

Anchored to pillar **"Racing Is Progression"**. As the player upgrades parts and switches teams, the material language shifts — not the silhouette. Early-season cars (or lower-tier teams) use matte, desaturated colour fields; late-season cars (or top teams) gain saturations, subtle metallic flecks (applied as flat colour bands, never gradients), and glow accents on engine components. The same clean geometry reads as "starter" or "champion" through palette and finish alone.

**P4: Team Colours, Driver Faces** — _Design test: "When introducing a rival, this principle says: the car's colour is the team's identity, the driver's character is their own."_

Anchored to pillar **"Grid of Personalities"**. The car livery belongs to the **team** — two drivers from the same team share the same car colours and patterns. What distinguishes each rival driver is their **driving behaviour** (aggressive, consistent, impulsive, defensive) and their **personal signature** — helmet design, car number, and on-track mannerisms. A player recognizes a rival not by "a red car" but by "the red car that dives inside at Turn 3" or "the blue car with the yellow chevron helmet that defends the line stubbornly." The team palette satisfies the visual constraint (flat, saturated, no blending) while the personality type satisfies the recognition need.

### 1.3 Cutscene Integration Note: The Ink-Speed Bridge

**Direction**: Speed Keyframe / Redline-style anime — bold brush ink strokes, variable line width, flat saturated colours from the game palette, dynamic camera angles, motion marks.

The gameplay-to-cutscene transition uses three **bridge elements** that share identical treatment across both modes:

1. **Shared Palette** — The exact same flat, saturated colour palette governs gameplay materials and cutscene fills. A rival's car colour in gameplay is the same hex value used for their ink-flat body in cutscenes. No colour translation, no desaturation — the palette is the palette.

2. **Shape Language Continuity** — The stylized gameplay geometry defines the cutscene drawing. Cutscene ink lines trace the curves and edges of the gameplay model — they are not redrawn from scratch. What reads as a smooth body panel in gameplay becomes a brush-ink edge in the cutscene. The same silhouette, the same proportions, just rendered in line.

3. **Motion Marks as Shared Grammar** — Speed lines, cornering scratches, and boost-trail marks appear in **both** modes: particle-based in gameplay, hand-drawn ink marks in cutscenes. Their placement, direction, and colour follow identical rules. A drift in gameplay generates white scratch particles; the same drift in a cutscene gets white ink scratch strokes along the identical arc. The player subconsciously reads them as the same language.

The net effect: the cutscene doesn't look like a different game — it looks like the game's geometry **drew itself** with a brush inked in the same colours, at the same speed.

---

## Section 2: Mood & Atmosphere

### 2.1 Race (In Progress)

**Primary emotion**: Desperate focus — the tunnel-vision intensity of 300 km/h with everything on the line. Not panic, but a razor-thin margin between control and catastrophe.

**Lighting character**: High-contrast midday, hard sun directly ahead or slightly overhead. Full-spectrum white with hot desaturated highlights. Minimal ambient fill — shadows are sharp and near-black, forcing the eye to the road ahead. When weather or time-of-day shifts occur, they're abrupt (rain, dusk, tunnel flash) not gradual.

**Atmospheric descriptors**: Bleached, scorched, electric, relentless, lean

**Energy level**: Frenetic

**Pillar connection**: The Arcade Spectrum direction demands pure, aggressive colour fields — the track is a ribbon of bold surface tone, rivals are silhouettes in flat team colours (no detail, just recognition). The one-line rule ("every pixel declares velocity") manifests as motion lines doubling as speed feedback, track-edge markers blurring into solid colour bands, and a HUD reduced to absolute essentials — fuel bar, tachometer redline, position counter. No decorative UI.

### 2.2 Pre-Race / Paddock

**Primary emotion**: Focused anticipation — the quiet before the storm. A pit garage at dawn: purposeful, ordered, ready.

**Lighting character**: Cool, diffuse overcast — northern light through a hangar door. Blue-grey ambient (6200K-7000K) with soft directional light from one side. Low contrast, slightly desaturated. Warm accent points only where interactable (the car's engine bay glow, a terminal screen, a crew member's helmet light).

**Atmospheric descriptors**: Clean, oil-and-concrete, methodical, hushed, grounded

**Energy level**: Measured

**Pillar connection**: Bold colour fields pivot to utilitarian greys, steel blues, and signal-orange accents — the palette of a real pit lane but rendered with flat, posterized geometry. Flat shading keeps UI elements (upgrade trees, stat bars, crew portraits) readable at a glance.

### 2.3 Victory / Podium

> **MVP scope**: Results screen is static text (position, time, rival reaction). Full podium ceremony (confetti, champagne, golden-hour lighting, 3D podium) is **Alpha** scope.

**Primary emotion**: Triumphant release — the payoff. Confetti, champagne, roar of the crowd. Deserved, earned, and absolutely unapologetic.

**Lighting character**: Golden hour from behind the podium (low sun, 3200K, long shadows). High contrast with warm spill across the player character and car. Lens flare / bloom permitted here — the one state where we break the "no post-processing" rule for a brief, celebratory moment.

**Atmospheric descriptors**: Incandescent, jubilant, saturated, explosive, warm

**Energy level**: High

**Pillar connection**: Arcade Spectrum palette reaches maximum saturation — team colours pop, gold and silver fill the frame, confetti is a particle field of flat coloured squares (not realistic flakes). The Speed Keyframe style applies: confetti blast, trophy raise, fist pump are all keyframes with motion smear.

### 2.4 Defeat / Off-Podium

**Primary emotion**: Quiet burn — not tragedy, not comedy, but the sour taste of _almost_. A driver walking away from the car, helmet under arm.

**Lighting character**: Twilight, just after the sun has dropped. Deep blue ambient (8000K-10000K), very low contrast, everything picking up a cool rim light. Desaturated to near-monochrome — only the car's livery retains a ghost of its colour.

**Atmospheric descriptors**: Fading, hollow, cool, subdued, grit

**Energy level**: Measured (close to contemplative)

**Pillar connection**: Flat colour fields drain to almost nothing — the palette at its most restrained, proving the highs by showing the lows. The one-line rule still holds: "every pixel declares velocity" — except here velocity is _zero_, and that stillness is the point.

### 2.5 Cutscene (Narrative)

**Primary emotion**: Dynamic range — varies by scene, but anchored by a Speed Keyframe/Redline aesthetic: bold poses, graphic compositions, high-stakes framing.

**Lighting character**: Stylized and motivated — each scene has a strong key light with a single dominant colour source. Comic-book spotlighting: hard rim lights, coloured shadows, no fill light. Night scenes: deep indigo with neon sources (cyan/magenta/yellow). Day scenes: bleached white with warm kickers.

**Atmospheric descriptors**: Bold, graphic, punchy, stylized, kinetic

**Energy level**: Varies (measured to frenetic), always with graphic intensity

**Pillar connection**: Cutscenes are the purest expression of Speed Keyframe. Every shot is a single definitive frame — characters in bold poses, flat colour backgrounds, minimal in-between motion. Dialogue in still or near-still panels; action beats use extreme smear frames and exaggerated speedlines.

### 2.6 Championship Progression

**Primary emotion**: Escalating momentum — new tracks unlock, new rivals appear, the championship grid fills out.

**Lighting character**: Neutral, map-room lighting — glowing holographic table in a dark room. The track map is emissive (coloured lines on dark background), each unlocked node pulses briefly before settling. Ambient is near-black (5-10% grey).

**Atmospheric descriptors**: Expansive, connective, emergent, clean, ambitious

**Energy level**: Measured (building to high)

**Pillar connection**: Championship map is "bold colour fields" at its purest — tracks are flat geometric nodes connected by sharp vector lines, each region in a single bold colour block on dark background. The one-line rule applies to the transition animation: the line connecting one race to the next _is_ a speedline, drawn in real time.

### 2.7 Mood State Transitions

| Transition          | Visual Treatment                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| Paddock → Race      | Flash cut to black, hard cut to track. No fade. Sound of ignition hitting on the cut.                   |
| Race → Victory      | Slow-motion kicks in over the last 3 seconds. Colour saturation ramps up as the finish line approaches. |
| Race → Defeat       | Audio drops out before the car stops. Colour desaturates frame by frame. Slow fade to twilight paddock. |
| Cutscene → Race     | Speedline wipe: horizontal white lines streak across left-to-right, revealing the track behind them.    |
| Race → Championship | The last frame of track freezes, then panel-wipes into the map view.                                    |

---

## Section 3: Shape Language

> **Art Director Sign-Off (AD-ART-BIBLE)**: 2026-06-22 ✅

### 3.1 Team Car Design (Fixed per Team)

Each of the 8 teams has a **unique car silhouette and livery** that does not change. The player's car is the car of whichever team they currently drive for. Part upgrades are stat-only — they affect performance numbers, not the 3D model geometry.

This means **8 car models to design and build total** — one per team. No per-upgrade-level visual variants, no morphing geometry. The player identifies a car on track by its team livery (colour + pattern + silhouette), and the driver inside it by helmet + number + behaviour.

For rival cars, each team's design stays fixed across all seasons — Macklen always looks like Macklen, Ferrell always looks like Ferrell. The player's car changes look only when they switch teams.

**Reference images for the silhouette aesthetic:**

| Image                                   | Reference For                   |
| --------------------------------------- | ------------------------------- |
| `van-diemen-rf90-formula-ford-1990.jpg` | Compact silhouette inspiration  |
| `ralt-rt35-1991.jpg`                    | Athletic silhouette inspiration |
| `williams-fw14b-1992.jpg`               | Complex silhouette inspiration  |

These three references define the **visual vocabulary** — smooth curves, simplified aero elements, bold colour blocking — not a progression path.

#### Rival Identification: Team + Driver

Corrected from an earlier draft that confused driver and team identity. In real racing (and in Overdrive):

1. **The car belongs to the team** — team livery (colour scheme, decals, patterns) is shared by all drivers on that team.
2. **The driver is identified by** — **driving behaviour** (personality type), **helmet design** (unique per driver), **car number** (on the nose and sidepod), and **on-track mannerisms** (how they defend, attack, react under pressure).

Each of the 8 teams has a distinct car design — different silhouette, proportions, and details — making every team recognisable at a glance. The visual variety comes from both team livery and the car's fundamental shape. Driver identity adds a second layer (helmet + number + behaviour) on top.

##### Driver Recognition at Speed

A player recognizes a rival through a combination that works at peripheral vision:

| Signal                | Source                                      | Readable From         |
| --------------------- | ------------------------------------------- | --------------------- |
| The car's team livery | Body colour + pattern                       | 200m+                 |
| The car number        | Nose / sidepod numeral                      | 100m+                 |
| The helmet design     | Top of cockpit, coloured peak               | 50m+                  |
| The driving behaviour | Corner entry, braking point, defensive line | Instant (after 1 lap) |

**Example**: The same blue-and-yellow team livery appears on two cars in the grid. But the player learns that car #7 (red chevron helmet) always brakes late and tries the inside, while car #14 (white helmet, blue stripe) holds the racing line and makes you go around. Recognition happens through behaviour, confirmed by helmet and number.

##### Team Colours Palette

Overdrive's 7 rival teams (and the player) draw from a restricted palette of flat, saturated team colours:

_Team colours and driver assignments are defined in Section 4.3 (Team Palette) and Section 5 (Character & Driver Visual Design)._

### 3.2 Environment Shape Language

**The rule**: Everything is simplified and stylised — except the track itself, which is the most detailed surface.

| Element                     | Shape Language                                             | Rationale                                                             |
| --------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| **Track surface**           | Smooth, continuous — the most detailed surface in the game | Eye naturally follows it; speed reads against simplified surroundings |
| **Kerbs**                   | Bold colour blocks, simplified ramps                       | High-contrast visual anchors at corner entry/exit                     |
| **Barriers**                | Simplified walls, flat colour bands                        | Readability at 300 km/h; no texture detail                            |
| **Buildings / grandstands** | Simplified boxes with broad colour fields                  | Speed sensation — they flash past as colour blocks                    |
| **Trees / landscape**       | 3-4 polygon cards with flat colour                         | No leaf detail, no transparency — pure silhouette                     |
| **Sky / clouds**            | Flat gradient bands or simplified cloud shapes             | No photorealistic sky; cel-style horizon bands                        |
| **Tunnels / bridges**       | Dark simplified geometry with emissive edge strips         | Speed lines on tunnel walls as particle FX                            |

**Ground-to-car lighting**: Light bounces off surfaces as large colour planes, not specular highlights. This reinforces the stylized look and prevents visual noise at speed.

### 3.3 UI Shape Language

The UI follows a clean, modern grammar — flat colour fields, bold typography, no unnecessary decoration. Rounded corners are allowed on buttons and badges; gradients are forbidden. Every element is flat and readable.

| Element              | Shape                                          | Behaviour                                  |
| -------------------- | ---------------------------------------------- | ------------------------------------------ |
| **Fuel bar**         | Horizontal rectangle with stepped decrement    | Drops in discrete blocks, not smooth drain |
| **Tachometer**       | Vertical segmented bar                         | Segments light up in sequence as revs rise |
| **Position counter** | Angular badge, bold numeral                    | Shape scales up/down on overtake/fall      |
| **Portraits**        | Simplified bust, flat colour fill              | Matches Speed Keyframe cutscene style      |
| **Buttons**          | Flat, slight rounding allowed, no bevel        | Click feedback via colour shift only       |
| **Dialogue boxes**   | Sharp-cornered panels, border in accent colour | No shadow, no transparency                 |

### 3.4 Visual Hierarchy at Speed

Racing at 300 km/h means the eye has milliseconds to parse the frame. The hierarchy is:

1. **Alert** (red flash, position change, flag)
2. **Player car** (the main visual anchor — camera tracks it)
3. **Nearby rival** (the sacred colour + silhouette read at peripheral)
4. **Track** (the only smooth surface — leads the eye forward)
5. **Track edges** (kerb colour blocks, barrier bands)
6. **Background / environment** (facets flashing past — peripheral speed reference)
7. **HUD / UI** (minimal, clean, positioned at screen edges)

**Rule**: If two elements compete for the same visual priority, the one closer to the racing line wins. HUD elements are pushed to the edges so they never overlap the tarmac ahead.

### 3.5 Reference Images

Saved under `design/art/references/`:

| File                                    | Subject                                          |
| --------------------------------------- | ------------------------------------------------ |
| `van-diemen-rf90-formula-ford-1990.jpg` | Low-poly compact silhouette style reference      |
| `ralt-rt35-1991.jpg`                    | Low-poly athletic silhouette style reference     |
| `williams-fw14b-1992.jpg`               | Low-poly complex aero silhouette style reference |

## Section 4 — Color System

### 4.1 Game Palette (Functional Colours)

Five core colours anchor the visual identity across every game state. These are the only colours used for track elements, kerbs, and critical UI primitives:

| Colour        | Hex       | Use                                         |
| ------------- | --------- | ------------------------------------------- |
| Race Red      | `#E8301A` | Alert, danger, player damage, critical fuel |
| Track Black   | `#2A2A2A` | Asphalt base (adjusted per track, ±1 step)  |
| Kerb White    | `#F0F0F0` | Track edges, start/finish line, UI text     |
| Asphalt Grey  | `#4A4A4A` | Runoff areas, secondary track surfaces      |
| Signal Yellow | `#F5C800` | Caution, kerbs, flag, highlight             |

**Rule:** No gradients in the game palette. Every colour is a solid, flat value.

### 4.2 Sky & Atmosphere (Per-Track Palette)

Each track has a fixed sky palette based on its region and climate. Weather variation is colour-shift only — no dynamic weather simulation.

| Climate             | Region Examples                 | Sky Colour              | Light Quality                       |
| ------------------- | ------------------------------- | ----------------------- | ----------------------------------- |
| Warm / Sunny        | Brazil, Australia, Italy, Spain | `#3B82D6` (Warm Blue)   | High contrast, hard shadows         |
| Temperate           | UK, France, Germany             | `#6B8FA3` (Cold Blue)   | Soft, overcast, diffuse             |
| Rainy / Cold        | Belgium, Netherlands, Japan     | `#8B9BB4` (Closed Grey) | Flat, low saturation                |
| Championship Finale | Any track                       | `#E8943A` (Golden Hour) | Warm, long shadows, bloom permitted |

### 4.3 Team Palette (8 Teams)

Each team has a fixed livery colour pair inspired by the 1990–1991 F1 grid. These colours identify the team at a glance — the driver is identified by helmet + number + behaviour.

| Team            | Parody of    | Primary                    | Secondary                                   | Notes                  |
| --------------- | ------------ | -------------------------- | ------------------------------------------- | ---------------------- |
| **Macklen**     | McLaren      | `#C8102E` (Red)            | `#FFFFFF` (White)                           | Marlboro-era McLaren   |
| **Willard**     | Williams     | `#0051BA` (Blue)           | `#FFFFFF` + `#FFD700` (White + Yellow)      | Canon Williams         |
| **Ferrell**     | Ferrari      | `#DC0000` (Ferrari Red)    | `#FFD700` (Yellow)                          | Scuderia Ferrari       |
| **Bennett**     | Benetton     | `#FFD700` (Yellow)         | `#006B3F` + `#003DA5` (Green + Blue)        | 1991 Benetton          |
| **Jordash**     | Jordan       | `#006B3F` (Emerald Green)  | `#003DA5` (Royal Blue)                      | 7UP Jordan 191         |
| **Tyrant**      | Tyrrell      | `#404058` (Dark Navy)      | `#002060` (Royal Blue) + `#FFD700` (Yellow) | 019-era Tyrrell        |
| **Lorris**      | Lotus        | `#E8A800` (Camel Gold)     | `#181818` (Black)                           | Camel Lotus 102        |
| **Layton Hall** | Leyton House | `#00CED1` (Dark Turquoise) | `#175D52` (Dark Teal)                       | CG911-era Leyton House |

### 4.4 HUD Palette

Seven functional colours reserved for the interface layer:

| Colour         | Hex       | Use                               |
| -------------- | --------- | --------------------------------- |
| Pure White     | `#FFFFFF` | Primary text, speed, revs         |
| Alert Red      | `#E8301A` | Critical fuel, warning, low tyres |
| Fuel Blue      | `#00BFFF` | Fuel gauge                        |
| Tach Yellow    | `#F5C800` | Rev limiter zone                  |
| Tyre Cyan      | `#00E5FF` | Tyre temperature indicator        |
| Position Ghost | `#808080` | Ghost car / opponent delta        |
| Overtake Green | `#00FF66` | Overtake streak, positive delta   |

### 4.5 Championship Progression Mood Shift

As the championship reaches its climax (final races, title contention), lighting and post-processing shift subtly:

| Property     | Early Season       | Late Season (Title Decider) |
| ------------ | ------------------ | --------------------------- |
| Contrast     | Medium             | High                        |
| Sky Palette  | Standard per-track | +5% contrast, warmer bias   |
| Bloom        | Subtle             | Slightly elevated for drama |
| Team Colours | Same hex values    | Same hex values             |

The car itself never changes colour or geometry — team identity is恒定. The drama comes from atmosphere, not from the vehicle.

### 4.6 Colour Rules (Hard Constraints)

1. **No gradients.** Flat colour fields only. No linear gradients, no radial gradients, no vignettes.
2. **No team colour overlap.** No two teams share the same primary or secondary. If a match is detected, adjust one team's hue by ±15°.
3. **Track is always darker than cars.** Asphalt (Track Black) must be at least 2 steps darker in value than the darkest team livery on track.
4. **UI does not mix with world.** The HUD palette is separate from the game palette. No race element uses a HUD colour and vice versa.
5. **Kerb colours never match team liveries.** If a kerb colour (white, yellow, red) matches a team's livery colour on track, swap the kerb to the alternate colour.
6. **One sky per track, never dynamic.** Sky colour is chosen at track design time and locked. No time-of-day or weather cycling.

## Section 5 — Character & Driver Visual Design

### 5.1 Driver Identification Philosophy

Driver identity is three things: **helmet + number + behaviour**. Not face, not car silhouette. On track at 300 km/h, the player identifies a rival by:

1. The colour shape of the helmet inside the cockpit
2. The car number on the rear wing and nose
3. How the car behaves through corners

The car itself is the team's identity (livery). Two drivers from the same team share the same car colours — they are distinguished by helmet and number.

### 5.2 Car Numbers (1991 Season Reference)

| Team        | No. |      Reference Driver      |
| ----------- | :-: | :------------------------: |
| Macklen     | #1  | Senna (defending champion) |
| Willard     | #5  |          Mansell           |
| Ferrell     | #27 |           Prost            |
| Bennett     | #20 |           Piquet           |
| Jordash     | #33 |         de Cesaris         |
| Tyrant      | #3  |          Nakajima          |
| Lorris      | #11 |          Häkkinen          |
| Layton Hall | #16 |          Capelli           |

Numbers are fixed per team. Font is bold, white or black (maximum contrast against car livery), positioned on the rear wing endplate and nose cone.

### 5.3 Helmet Designs (Parody — Evocative, Not Copy)

Each helmet is inspired by the real driver's 1991 identity but modified enough to be a parody, not a replica.

| Team            | Helmet Description                                                | Colours                                 | Reference Inspiration                               |
| --------------- | ----------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------- |
| **Macklen**     | Yellow crown with navy and dark green bands, white central stripe | `#FFD700` `#1A237E` `#1B5E20` `#FFFFFF` | Senna — yellow base with dark green/navy triband    |
| **Willard**     | Medium blue with white diagonal band and gold accent              | `#1565C0` `#FFFFFF` `#FFD700`           | Mansell — blue with diagonal contrasting stripe     |
| **Ferrell**     | White with blue, red and green bands across the crown             | `#FFFFFF` `#1565C0` `#DC0000` `#006B3F` | Prost — white with multi-colour crown bands         |
| **Bennett**     | White with blue and red side stripes, yellow accent               | `#FFFFFF` `#003DA5` `#DC0000` `#FFD700` | Piquet — white base with coloured side elements     |
| **Jordash**     | White with inverted-V emerald green and royal blue stripes        | `#FFFFFF` `#006B3F` `#003DA5`           | de Cesaris — white with large coloured V shapes     |
| **Tyrant**      | White with red circle on crown and navy details                   | `#FFFFFF` `#E8301A` `#404058`           | Nakajima — white base with red circular motif       |
| **Lorris**      | Silver-white with diagonal blue and red bands, black details      | `#E0E0E0` `#1565C0` `#DC0000` `#181818` | Häkkinen — bright base with diagonal coloured bands |
| **Layton Hall** | Red with horizontal turquoise band and white accent               | `#DC0000` `#00CED1` `#FFFFFF`           | Capelli — red with contrasting horizontal stripe    |

### 5.4 Driver Behaviour Profiles

Each driver has a unique on-track personality visible within 1–2 laps of following them.

| Team            | Behaviour                                                                                                                                                        | Tactical Note                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Macklen**     | **Dominant.** Reference of the grid. Fastest consistent lap, perfect traction on exits, closes the door at the exact right point. Does not make unforced errors. | Player must pressure him for several laps to force a rare mistake. Victory over Macklen means beating the best. |
| **Willard**     | **Lightning bolt.** As fast as Macklen over one lap — sometimes faster. But makes errors: runs wide, spins under pressure, locks up in braking.                  | Watch for his mistake patterns. Patience pays — push hard and he will eventually crack.                         |
| **Ferrell**     | **Technical.** Smooth inputs, fast corner entry. Rarely makes errors but lacks Macklen's race pace.                                                              | Beat him through pit strategy — tyre wear and fuel planning. He follows the optimal line every time.            |
| **Bennett**     | **Consistent.** Clean line, hard to pass. Maximum grip, no gifts. Not the fastest but demands the most laps to overtake.                                         | Requires a clean overtaking move — he will not hand you the position.                                           |
| **Jordash**     | **Impulsive.** Best corner speed on the grid. Session-fast. But spins under pressure — 2+ consecutive corners of pressure forces an error.                       | Press him relentlessly through successive corners. He will spin or run wide.                                    |
| **Tyrant**      | **Defensive.** Guards the line with everything. Brake-tests into corners, opens wide on exit, pushes if you try the inside.                                      | Not a win threat but a blocker. Pass him early, avoid getting stuck behind.                                     |
| **Lorris**      | **Rookie.** Fast when confident, erratic when not. Daring overtakes followed by solo mistakes. Grows stronger in the second half of the race.                    | Unpredictable. Give space early, capitalise on his mistakes mid-race.                                           |
| **Layton Hall** | **Aggressive.** Drives at the absolute limit — which means over it, sometimes. Overtakes where nobody tries. 50% brilliance, 50% contact.                        | Both or nothing. High risk, high reward.                                                                        |

### 5.5 Blur Test

Every helmet design must pass the **32×32 pixel test**: rendered as a coloured silhouette at 32×32 px, each must be distinguishable from the other 7. If two blur together, the design goes back for revision.

> **Production gate**: This test must pass before the first helmet asset is committed to the game build. The test images are saved to `design/art/blur-test/` for review.

### 5.6 On-Screen Identification

- **First encounter:** driver name appears on screen only on first overtake or at race end
- **Standing:** displayed during race interstitials (#1 = Macklen, #5 = Willard, etc.)
- **During race:** identified by helmet colour and car number only — no floating name tags

## Section 6 — Environment Design

### 6.1 Track Design Philosophy

Every track is a **character**, not just a layout. The player should recognise each circuit by its silhouette, its colour palette, and its signature landmark — just as they recognise a rival by helmet, number, and behaviour.

**Design rule**: If a player can name the track after seeing the first corner, the environment design succeeds. If the only difference between two tracks is the kerb colour, the design fails.

### 6.2 Modular Shared Assets

The following elements are built once and reused across all tracks, reducing per-track production cost by ~80%:

| Asset                   | Shared Across | Notes                                                                                   |
| ----------------------- | ------------- | --------------------------------------------------------------------------------------- |
| **Kerb types**          | All tracks    | 3 variants: white+red (standard), white+yellow (fast corner), white+blue (run-off edge) |
| **Barriers**            | All tracks    | Armco, concrete wall, tire wall — same models, placed per layout                        |
| **Fencing**             | All tracks    | Catch fencing, pedestrian fencing, grandstand railings                                  |
| **Guard-rails**         | All tracks    | Same model, placed on elevated sections                                                 |
| **Pit building**        | All tracks    | Same base model with per-track colour/material variant                                  |
| **Grandstands**         | All tracks    | 2-3 size variants, placed per track needs                                               |
| **Trees**               | All tracks    | 3 stylized tree types (pine, round canopy, palm), palette-swapped per climate           |
| **Marshalling posts**   | All tracks    | Same model, blue flag light included                                                    |
| **Lighting towers**     | All tracks    | For night sections (Phase 2)                                                            |
| **Start/finish gantry** | All tracks    | Same base model, per-track overlay (track name + logo)                                  |

### 6.3 Track Selection — 1991 Calendar Clone

The 4 Phase 1 tracks are **faithful recreations of real 1991 F1 circuits** — layout, corner sequence, elevation, and key dimensions follow the real track. The intent: a player who knows the real Spa will recognise every corner in the game. A player who doesn't will learn a layout that real racers have mastered for decades.

If the game isn't fun on these 4 tracks, it's not the tracks — it's the core loop.

Parody names are used to avoid licensing issues; the geometry is real.

| Track (Parody) | Real Circuit                            | Country | Landscape                                        | Climate              | Signature Landmarks                                                        |
| -------------- | --------------------------------------- | ------- | ------------------------------------------------ | -------------------- | -------------------------------------------------------------------------- |
| **Ardennes**   | Spa-Francorchamps                       | Belgium | Ardennes forest — dense trees, rolling elevation | Cool, overcast       | Eau Rouge/Raidillon climb, bus stop chicane, Pouhon through trees          |
| **Brianza**    | Monza                                   | Italy   | Royal park — flat, open, formal gardens          | Warm, sunny          | Parabolica grandstand, Lesmo curves, twin-front straight with gantry       |
| **Riviera**    | Monaco                                  | Monaco  | City streets — tower-topped, harbour backdrop    | Sunny, Mediterranean | Tunnel exit (dark→light), harbour chicane, fairmont hairpin, swimming pool |
| **Interlakes** | Interlagos (Autódromo José Carlos Pace) | Brazil  | Hillside bowl — elevation changes, reservoir     | Warm, humid          | Senna's S grandstands, downhill Mergulho, reservoir infield, café          |

**Phase 2 adds 4 more tracks** (8 total, completing the 1.0 championship). Selection will be announced during the GDD phase.
**Phase 3 adds 8 more** (16 total — full 1991 season).

### 6.4 Landscape & Surroundings

The world outside the track is **stylized** — simplified buildings, geometric terrain, simplified trees. No photorealistic textures. The contrast between the smooth track surface and the stylized surroundings guides the player's eye.

- **Forest tracks** (Ardennes-clone): layered geometric trees, dark green/blue palette, mist band at treeline
- **Park tracks** (Brianza-clone): formal gardens (hedge cubes, geometric flowerbeds), open sky, warm colours
- **City tracks** (Riviera-clone): blocky buildings with lit windows (emissive quads), harbour water as flat dark blue plane
- **Inland tracks** (Interlakes-clone): sculpted terrain with simplified hills, reservoir as flat reflective plane

### 6.5 Paddock & Garage (Hybrid)

**Phase 1 — Hybrid (Early Access):**

- Static 3D garage scene: car centre-stage, tools on walls, team banners
- Slow camera pan across the scene (subtle movement, no player control)
- Car model reflects current team livery and visible upgrades (wings, nose, tyres)
- All interaction via 2D overlay menus (upgrades, race start, settings, save/exit)
- Scene loads once per session; menus are Babylon.js GUI

**Phase 2 — Navigable Hub (1.0):**

- Same garage, now part of a larger paddock
- Player-controlled camera (third-person, point-and-click movement)
- Rival team garages visible in background (loading screen hint: "these are your competition")
- NPC drivers with dialogue lines, walking animations
- Interaction prompts appear near key objects (car, crew chief, exit to paddock)
- All Phase 1 assets reused — only new content added

**Design rule**: The paddock must never take longer than 2 seconds to load. If the garage scene is heavy, it degrades the race cadence.

### 6.6 Weather & Time of Day

- **Dry** (Phase 1): per-track fixed sky palette as defined in Section 4.2. No dynamic weather.
- **Rain** (Phase 2 only): colour shift only — desaturated palette, blue/grey bias, no rain particle simulation, no wet driving physics. Visual-only mood change.
- **Night** (Phase 2 only): selected tracks only (Monaco-clone). Track illuminated by floodlights (emissive poles), sky = deep navy. City tracks benefit most from night treatment.

### 6.7 Visual Hierarchy at Speed

At 300+ km/h, the player cannot process detail. The environment is designed to be read in under 200ms:

| Layer             | What                                  | Visual Treatment                 |
| ----------------- | ------------------------------------- | -------------------------------- |
| **1 — Immediate** | Track surface, kerbs, braking markers | Smooth, high-contrast, saturated |
| **2 — Near**      | Barriers, run-off, marshalling posts  | Mid-saturation, blocky shapes    |
| **3 — Mid**       | Grandstands, buildings, hills         | Desaturated, simplified geometry |
| **4 — Far**       | Sky, horizon, distant landmarks       | Flat colour bands, no detail     |

**Design rule**: If a player has time to admire a tree texture at full speed, the tree has too much detail. Everything outside the track surface exists to be a blur.

## Section 7 — UI & HUD Design

### 7.1 Design Philosophy — "Misto"

The UI follows the **Misto** principle: dark backgrounds with subtle team-colour accents. The interface recedes; the content and the race speak. Every screen is built from three visual layers:

1. **Background** — solid dark (#0d0d0f), no textures, no gradients
2. **Panel** — slightly lighter (#111114) with a thin border (1px, 5% white), rounded corners (8px)
3. **Accent** — team colour appears in 3–4 specific spots only, never as a background fill

**Hard rules:**

- No gradients in menus (except the top accent bar)
- No rounded buttons: 4px radius maximum
- Icons are geometric shapes or emoji, not illustrated
- Team colour never exceeds 5% of screen area
- All type is left-aligned or center-aligned — never justified

### 7.2 Menu Screen Layout

Every menu screen follows this skeleton:

```
┌─────────────────────────────────────────────────────┐
│ ⬡ OVERDRIVE              LORRIS RACING │
│                            #11 — PILOTO │
├────────────┬────────────────────────────────────────┤
│            │                                        │
│ ▶ Corrida  │  ┌──────────────────────────────┐      │
│   █ Champ  │  │                              │      │
│   ▲ Upgr.  │  │         CAR DISPLAY           │      │
│   ● Equipe │  │    🏎️  LORRIS #11             │      │
│   ◆ Opções │  │     Nível 2 · 4 corridas       │      │
│            │  └──────────────────────────────┘      │
│            │                                        │
│            │  ┌──────────┬──────────┐               │
│            │  │ Motor     │ Aero     │               │
│            │  │ LV 2 ██  │ LV 1 █   │               │
│            │  ├──────────┼──────────┤               │
│            │  │ Freios   │ Câmbio   │               │
│            │  │ LV 1 █   │ LV 1 █   │               │
│            │  └──────────┴──────────┘               │
├────────────┴────────────────────────────────────────┤
│  💾 Salvar    📊 Grid    📖 Ajuda        🏁 CORRER │
└─────────────────────────────────────────────────────┘
```

**Components:**

| Element            | Style                                    | Notes                                                |
| ------------------ | ---------------------------------------- | ---------------------------------------------------- |
| **Top accent bar** | 3px solid in team colour                 | Only gradient allowed — team colour to transparent   |
| **Logo**           | Bold uppercase, 22px, colour #eee        | Team colour only on the glyph (⬡)                    |
| **Sidebar**        | 200px, left border accent on active item | Active: team colour border + 7% opacity bg           |
| **Panel**          | Inset, dark fill, thin white border      | Contains car display and stats                       |
| **Car display**    | Centered, dark inset (rgba 0,0,0,0.25)   | Car icon with drop-shadow in team colour             |
| **Stat bars**      | 2px height, rounded 1px                  | Fill colour = team colour, bar bg #1a1a1e            |
| **Footer**         | Top border 3% white                      | Actions: secondary buttons + primary team-colour CTA |
| **Primary CTA**    | Team colour background + dark text       | Only one per screen — always "CORRER"                |

### 7.3 HUD — Minimum Viable

**Phase 1** — clean, minimal. Three zones positioned for cockpit-camera visibility (lower screen portion occupied by steering wheel and dashboard):

```
┌─────────────────────────────────────────────┐
│ ┌──────┐  ┌────── 287 ──────┐   ⛽ ████░  │
│ │ MAP  │  │  Lap 2/4        │   ▦ █████░  │
│ │240px │  │     8th/8       │             │
│ └──────┘  └─────────────────┘             │
│                                             │
│              🏎️  (world)                    │
│                                             │
│    (cockpit — volante, painel)              │
└─────────────────────────────────────────────┘
```

| Zone              | Position       | Content                                                                          | Visual                                                                 | Repositonable                      |
| ----------------- | -------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| **Speed**         | Top-center     | Speed (km/h), no unit label                                                      | 72px bold white, every frame read (no throttle), direct from Physics   | Yes — whole zone moves             |
| **Position + Lap**| Top-right      | Position format (current/total), lap counter (current/total)                     | 32px bold, muted white, position above lap                             | Yes — whole zone moves             |
| **Lap Times**     | Top-left       | Current lap time, last lap time, fastest lap time in MM:SS.mmm                   | 16px monospace, muted white, stacked vertically                        | Yes — whole zone moves             |
| **Fuel + Tire**   | Lower-right    | Fuel bar (0-100%) with icon (pump), Tire bar (0-100%) with icon (tire)           | ~40px bar height, flat colour shifts (no gradient), green→yellow→red  | Yes — whole zone moves             |
| **Gap Info**      | Contextual     | Delta to car ahead AND behind, in seconds                                        | Shown only when in P2+ position, updates 20Hz via Event Bus           | Yes — whole zone moves             |
| **Minimap**       | Center-right   | Simplified track outline with position dots in team colours, below position block| 240×240px container, dark background (rgba(0,0,0,0.5)), toggleable     | Yes — whole zone moves             |
| **Countdown**     | Center-top     | 5 circles (24px diameter), red off / green on, 1s interval                       | Disappears after green flag (LIGHT_INTERVAL_TICKS=60)                 | Fixed position                     |
| **Alert Block**   | Center-center  | Max 2 simultaneous alerts (PIT READY, FUEL EMPTY, CAR AHEAD/BEHIND, ±1 POS)      | 16px uppercase sans-serif, FIFO replacement                           | Fixed position                     |
| **Menu**          | ESC key        | No button on screen                                                              | Accessed via keyboard only                                             | N/A                                |

**Design rules for HUD:**

- No floating name tags on rival cars — identified by helmet colour and car number only
- No team badge or name on screen — the player knows what car they are driving
- Map dots use team colours (Macklen = red, Lorris = gold, etc.)
- Overtake indicator: subtle flash at screen edge when a car overlaps your rear wing
- Position change: brief flash + (▲N / ▼N) next to position, fades in 1.5s
- Each zone is an independent StackPanel — positions can be swapped, moved, or hidden via layout config

### 7.4 Expandable HUD (Phase 2 / Settings Option)

The player can enable **Detailed HUD** in settings, adding:

- **Delta timing**: +0.342s to car ahead, shown top-center
- **Mini track map**: top-right, simplified layout with car positions as dots
- **Standings panel**: scrollable list of all 8 cars with gap times (toggle with button)
- **Tyre temperature**: 4 micro-circles beside the tyre wear bar (blue→green→yellow), optional overlay
- **Sector times**: coloured splits for current lap (green = personal best, purple = session best, red = slower)

Default is always Minimal HUD. The detailed toggle is saved per player profile.

### 7.5 Typography

| Use                     | Font                       | Weight         | Size    | Case                    |
| ----------------------- | -------------------------- | -------------- | ------- | ----------------------- |
| **Logo**                | Inter or system sans-serif | 700 (Bold)     | 22px    | Uppercase               |
| **Menu items**          | Inter or system sans-serif | 500 (Medium)   | 13px    | Sentence                |
| **Labels**              | Inter or system sans-serif | 500            | 10–11px | Uppercase, spaced 1–2px |
| **Values (stats)**      | Inter or system sans-serif | 600 (Semibold) | 13px    | Numeric                 |
| **HUD speed**           | Inter or system sans-serif | 700            | **72px** | Numeric                 |
| **HUD position/lap**    | Inter or system sans-serif | 700 (Bold)     | **32px** | Numeric                 |
| **HUD lap times**       | Inter or system sans-serif | 400 (Regular)  | **16px** | Numeric, monospace      |
| **Alert block**         | Inter or system sans-serif | 600 (Semibold) | **16px** | Uppercase               |
| **Body / descriptions** | Inter or system sans-serif | 400 (Regular)  | 12px    | Sentence                |

No decorative or display fonts. No monospaced fonts (avoid the "90s terminal" look). Everything is clean, geometric, and readable at a glance.

### 7.6 HUD Animations

| Event               | Animation                                                         | Duration      |
| ------------------- | ----------------------------------------------------------------- | ------------- |
| **Position change** | Flash arrow (▲N / ▼N) beside position number, fades out           | 1.5s          |
| **Overtake**        | Subtle edge flash (team colour) on the side the car passed        | 0.3s          |
| **Lap complete**    | Lap counter flips (mechanical tick — no smooth transition)        | 0.1s          |
| **Fuel critical**   | Fuel bar pulses (shifts between current colour and red)           | 0.5s interval |
| **Race end**        | Slow-motion entry (0.3s of 50% speed, then freeze + result panel) | 0.3s          |
| **Menu transition** | Instant — no fade, no slide. Content changes on same frame        | 0s            |

The rule: **mechanical, not organic**. Flips, ticks, cuts. No smooth fades, no easing curves, no organic transitions. The HUD behaves like a physical stopwatch, not a mobile app.

### 7.7 Track Silhouette (Race Setup Screen)

The track selection cards in the Race Setup screen show a top-down layout of each circuit. The silhouette follows these rules:

- **Style**: clean vector lines, white (`#FFFFFF`) on dark background (`#0d0d0f`), no fill, no gradients
- **Fidelity**: faithful to the real circuit layout — corner sequence and overall shape must be recognisable to anyone who knows the track
- **Line**: continuous 3–4px stroke with crisp corners, no bezier smoothing that distorts the original radius
- **Start/Finish**: thin accent-colour hash mark at the correct position on the layout (follows the team colour when a team is selected on the previous screen)
- **Labels**: none — no corner numbers, no elevation markers, no compass. Only the track + start/finish marker + scaling to fit the card (maintains aspect ratio)
- **Intent**: the player should recognise the circuit from its outline alone; the silhouette is a minimal map, not a decoration

These silhouettes are hand-drawn vector exports per track, not rendered from the 3D scene. Each Phase 1 track gets its own silhouette file in `design/art/silhouettes/`.

## Section 8 — Asset Standards

### 8.1 Performance Budget Philosophy

> **All budgets below are approximations derived from visual analysis of 4PGP reference screenshots.** They are not measured from source assets. Our strategy is: **build at maximum budget, test FPS, and reduce only if performance drops below 60 FPS.** This avoids premature optimisation while keeping a clear ceiling.

### 8.2 Triangle Budgets

| Asset                    | Max Tris     | Notes                                                             |
| ------------------------ | ------------ | ----------------------------------------------------------------- |
| **Car (per team)**       | 8.000        | Body, wings, suspension, mirrors, cockpit — 1 merged mesh per car |
| **Track surface**        | 250.000      | Asphalt, markings, kerbs integrated                               |
| **Kerb (shared asset)**  | 10.000       | 3 variants: standard, fast corner, run-off edge                   |
| **Barriers + fencing**   | 60.000       | Armco, tire walls, catch fencing — shared across tracks           |
| **Buildings**            | 80.000       | Simplified blocks with texture for windows/detail                 |
| **Grandstands**          | 40.000       | Tiered seating + crowd texture                                    |
| **Trees + landscape**    | 20.000       | Stylised, 2–4 polygon shapes per tree                             |
| **Signage + decoration** | 10.000       | Flat planes with texture (patrocinadores, boards)                 |
| **Total per track**      | **~470.000** | **Generous ceiling — reduce only if FPS drops below 60**          |

**Draw call budget**: ≤100 per frame (at 60 FPS target). Achieved via mesh merging (1 mesh per car, 1 mesh per track section) and material batching.

### 8.3 Texture Budgets

| Asset                   | Resolution | Format | Notes                                             |
| ----------------------- | ---------- | ------ | ------------------------------------------------- |
| **Car body (per team)** | 512×512    | PNG    | Painted texture: base colour + sponsors + details |
| **Track surface**       | 1024×1024  | PNG    | Asphalt + markings                                |
| **Kerb (shared)**       | 256×256    | PNG    | 3 colour variants                                 |
| **Barrier + fencing**   | 256×256    | PNG    | Shared atlas                                      |
| **Building facade**     | 512×512    | PNG    | Window/detail texture                             |
| **Grandstand crowd**    | 512×256    | PNG    | Crowd rows                                        |
| **Sky**                 | 1024×512   | PNG    | Per-track gradient (fixed per Section 4)          |
| **HUD elements**        | —          | Code   | Solid colours via Babylon.js GUI, no textures     |

**Total texture memory per track**: ~8–12 MB (well within 512 MB budget).

### 8.4 Car Model Requirements

Each car is a **single merged mesh** with one material (the painted texture from Section 8.3). This ensures:

- 1 draw call per car (not 10+ for separate parts)
- Material batching across cars sharing the same texture atlas (Phase 2)
- Frustum culling on the entire car, not individual parts

**Minimum visible detail at 300 km/h:**

- Car silhouette must be distinguishable from rivals at 50m distance
- Sponsor logos readable at 20m distance
- Helmet visible in cockpit view (no external model needed)

### 8.5 Asset Naming Convention

```
{category}/{team-or-track}_{element}_{variant}.{ext}

Examples:
cars/macklen_body.png          — Macklen car body texture
cars/willard_body.png          — Willard car body texture
tracks/monza_surface.glb       — Monza track surface mesh
tracks/monza_buildings.glb     — Monza buildings mesh
shared/kerb_standard.glb       — Standard kerb (shared)
shared/barrier_armco.glb       — Armco barrier (shared)
shared/tree_pine.glb           — Pine tree (shared)
```

**Categories**: `cars/`, `tracks/`, `shared/`, `ui/`, `cutscenes/`

### 8.6 File Formats

| Purpose      | Format | Notes                                            |
| ------------ | ------ | ------------------------------------------------ |
| 3D models    | .glb   | Binary glTF — compact, web-optimised             |
| Textures     | .png   | Lossless — avoids JPEG artefacts on flat colours |
| Cutscene art | .png   | 2x resolution (retina-ready)                     |
| Audio        | .ogg   | Web-optimised, small file size                   |

### 8.7 Resolution Strategy

- **Target**: scalable — no fixed resolution. Canvas adapts to viewport.
- **Minimum supported**: 1280×720 (HD)
- **Recommended**: 1920×1080 (Full HD)
- **Maximum tested**: 2560×1440 (QHD)

HUD elements scale with `AdvancedDynamicTexture idealWidth` (set to 1920). Track and car geometry renders at native resolution.

### 8.8 Material Pipeline

> **Art Director Sign-Off (AD-ART-BIBLE)**: 2026-06-22 ✅

**All world-visible geometry uses Babylon.js `UnlitMaterial`.** This is the single material path for the entire game. No `StandardMaterial`, `PBRMaterial`, or custom shader is used for gameplay visuals.

This decision follows directly from the one-line visual rule ("Flat colours, sharp edges, pure speed") and Principle P2 from Section 1.2 ("Light bounces off surfaces as large colour planes, not specular highlights"). With UnlitMaterial:

- **Lighting character is achieved through baked texture colour** — car body textures (512×512 PNG) contain base colour, sponsor logos, and baked lighting in the texture itself, not through scene lighting response.
- **Scene directional light + shadowmap ONLY** — a single directional light casts hard shadows for depth perception. No ambient, no point lights, no spotlights. The shadowmap affects the environment only (track surface, barriers, buildings), not cars.
- **No specular, reflection, or PBR material response** — cars receive zero specular highlights, zero reflections (even on chrome/glass elements), and zero PBR material response. Chrome accents are painted as grey-white colour bands in the texture, not reflective materials.

**Post-processing blacklist** (banned effects — never enabled):

- SSAO, SSR, tonemapping, color grading, lens flare, bloom (except GlowState cutscene — Section 2.3), depth of field, motion blur (except speed lines — Section 2.1), vignette, chromatic aberration, film grain

Exceptions (explicitly allowed):

- Directional light shadowmap (single, hard shadow, 2048×2048)
- Speed lines overlay (Section 2.1)
- GlowState bloom during cutscenes (Section 2.3)
- Screen shake on collision impact (Physics GDD, camera GDD)

## Section 9 — Palette JSON (Machine-Readable)

The palette is exported in a single JSON file at `design/art/palette.json`. This file is the **single source of truth** — game code, shaders, and and design tools should read from this JSON rather than hardcoding hex values.

```json
{
  "meta": {
    "game": "Overdrive",
    "version": "1.0",
    "description": "Single source of truth for all palette colours. No values should be hardcoded in game code — import from this file.",
    "lastUpdated": "2025-06-18"
  },
  "gamePalette": {
    "raceRed": {
      "hex": "#E8301A",
      "use": "Alert, danger, player damage, critical fuel"
    },
    "trackBlack": {
      "hex": "#2A2A2A",
      "use": "Asphalt base (adjusted per track, ±1 step)"
    },
    "kerbWhite": {
      "hex": "#F0F0F0",
      "use": "Track edges, start/finish line, UI text"
    },
    "asphaltGrey": {
      "hex": "#4A4A4A",
      "use": "Runoff areas, secondary track surfaces"
    },
    "signalYellow": {
      "hex": "#F5C800",
      "use": "Caution, kerbs, flag, highlight"
    }
  },
  "skyPalettes": [
    {
      "id": "warm",
      "name": "Warm / Sunny",
      "regions": ["Brazil", "Australia", "Italy", "Spain"],
      "sky": "#3B82D6",
      "lightQuality": "High contrast, hard shadows"
    },
    {
      "id": "temperate",
      "name": "Temperate",
      "regions": ["UK", "France", "Germany"],
      "sky": "#6B8FA3",
      "lightQuality": "Soft, overcast, diffuse"
    },
    {
      "id": "rainy",
      "name": "Rainy / Cold",
      "regions": ["Belgium", "Netherlands", "Japan"],
      "sky": "#8B9BB4",
      "lightQuality": "Flat, low saturation"
    },
    {
      "id": "finale",
      "name": "Championship Finale",
      "regions": ["Any track (title decider)"],
      "sky": "#E8943A",
      "lightQuality": "Warm, long shadows, bloom permitted"
    }
  ],
  "teams": [
    {
      "id": "macklen",
      "parodyOf": "McLaren",
      "number": 1,
      "primary": "#C8102E",
      "secondary": "#FFFFFF",
      "accent": null,
      "notes": "Marlboro-era McLaren",
      "driver": {
        "name": "Macklen #1",
        "referenceDriver": "Senna",
        "character": "Dominant",
        "helmet": {
          "colors": ["#FFD700", "#1A237E", "#1B5E20", "#FFFFFF"],
          "description": "Yellow crown with navy and dark green bands, white central stripe"
        }
      }
    },
    {
      "id": "willard",
      "parodyOf": "Williams",
      "number": 5,
      "primary": "#0051BA",
      "secondary": "#FFFFFF",
      "accent": "#FFD700",
      "notes": "Canon Williams",
      "driver": {
        "name": "Willard #5",
        "referenceDriver": "Mansell",
        "character": "Lightning bolt",
        "helmet": {
          "colors": ["#1565C0", "#FFFFFF", "#FFD700"],
          "description": "Medium blue with white diagonal band and gold accent"
        }
      }
    },
    {
      "id": "ferrell",
      "parodyOf": "Ferrari",
      "number": 27,
      "primary": "#DC0000",
      "secondary": "#FFD700",
      "accent": null,
      "notes": "Scuderia Ferrari",
      "driver": {
        "name": "Ferrell #27",
        "referenceDriver": "Prost",
        "character": "Technical",
        "helmet": {
          "colors": ["#FFFFFF", "#1565C0", "#DC0000", "#006B3F"],
          "description": "White with blue, red and green bands across the crown"
        }
      }
    },
    {
      "id": "bennett",
      "parodyOf": "Benetton",
      "number": 20,
      "primary": "#FFD700",
      "secondary": "#006B3F",
      "accent": "#003DA5",
      "notes": "1991 Benetton",
      "driver": {
        "name": "Bennett #20",
        "referenceDriver": "Piquet",
        "character": "Consistent",
        "helmet": {
          "colors": ["#FFFFFF", "#003DA5", "#DC0000", "#FFD700"],
          "description": "White with blue and red side stripes, yellow accent"
        }
      }
    },
    {
      "id": "jordash",
      "parodyOf": "Jordan",
      "number": 33,
      "primary": "#006B3F",
      "secondary": "#003DA5",
      "accent": null,
      "notes": "7UP Jordan 191",
      "driver": {
        "name": "Jordash #33",
        "referenceDriver": "de Cesaris",
        "character": "Impulsive",
        "helmet": {
          "colors": ["#FFFFFF", "#006B3F", "#003DA5"],
          "description": "White with inverted-V emerald green and royal blue stripes"
        }
      }
    },
    {
      "id": "tyrant",
      "parodyOf": "Tyrrell",
      "number": 3,
      "primary": "#404058",
      "secondary": "#002060",
      "accent": "#FFD700",
      "notes": "019-era Tyrrell",
      "driver": {
        "name": "Tyrant #3",
        "referenceDriver": "Nakajima",
        "character": "Defensive",
        "helmet": {
          "colors": ["#FFFFFF", "#E8301A", "#404058"],
          "description": "White with red circle on crown and navy details"
        }
      }
    },
    {
      "id": "lorris",
      "parodyOf": "Lotus",
      "number": 11,
      "primary": "#E8A800",
      "secondary": "#181818",
      "accent": null,
      "notes": "Camel Lotus 102",
      "driver": {
        "name": "Lorris #11",
        "referenceDriver": "Häkkinen",
        "character": "Rookie",
        "helmet": {
          "colors": ["#E0E0E0", "#1565C0", "#DC0000", "#181818"],
          "description": "Silver-white with diagonal blue and red bands, black details"
        }
      }
    },
    {
      "id": "layton_hall",
      "parodyOf": "Leyton House",
      "number": 16,
      "primary": "#00CED1",
      "secondary": "#175D52",
      "accent": null,
      "notes": "CG911-era Leyton House",
      "driver": {
        "name": "Layton Hall #16",
        "referenceDriver": "Capelli",
        "character": "Aggressive",
        "helmet": {
          "colors": ["#DC0000", "#00CED1", "#FFFFFF"],
          "description": "Red with horizontal turquoise band and white accent"
        }
      }
    }
  ],
  "hudPalette": [
    {
      "name": "Pure White",
      "hex": "#FFFFFF",
      "use": "Primary text, speed, revs"
    },
    {
      "name": "Alert Red",
      "hex": "#E8301A",
      "use": "Critical fuel, warning, low tyres"
    },
    { "name": "Fuel Blue", "hex": "#00BFFF", "use": "Fuel gauge" },
    { "name": "Tach Yellow", "hex": "#F5C800", "use": "Rev limiter zone" },
    {
      "name": "Tyre Cyan",
      "hex": "#00E5FF",
      "use": "Tyre temperature indicator"
    },
    {
      "name": "Position Ghost",
      "hex": "#808080",
      "use": "Ghost car / opponent delta"
    },
    {
      "name": "Overtake Green",
      "hex": "#00FF66",
      "use": "Overtake streak, positive delta"
    }
  ]
}
```

## Section 10 — AI Art Anchor Prompt

Written to standalone file `design/art/anchor-prompt.md`. Contains:

- **Core style keywords** — always-include terms for the flat-colour stylised 3D aesthetic
- **Midjourney parameters** — recommended `--ar`, `--s`, `--w`, `--c`, `--v` values per use case
- **15+ prompt templates** across 6 categories: car liveries (all 8 teams), race action, cockpit view, overtake moments, victory celebration, night race, all 4 tracks (Spa, Monza, Monaco, Interlagos), helmet designs, UI/HUD mockup, and key art/cover
- **Colour hex quick reference** — all 17 palette hex values for prompt injection
- **Workflow tips** — how to adapt templates, upscale, and avoid photorealism
