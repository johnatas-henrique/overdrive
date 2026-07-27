# Overdrive — Art Bible

> **Status:**
> - Section 1: Visual Identity Statement — APPROVED 2026-07-27
> - Section 2: Color Palette — APPROVED 2026-07-27
> - Section 3: Lighting & Atmosphere — APPROVED 2026-07-27
> - Section 4: Character Art Direction — APPROVED 2026-07-27
> - Section 5: Environment & Level Art — APPROVED 2026-07-27
> - Section 6: UI Visual Language — APPROVED 2026-07-27
> - Section 7: VFX & Particle Style — APPROVED 2026-07-27
> - Section 8: Asset Standards — APPROVED 2026-07-27
> - Section 9: Style Prohibitions — APPROVED 2026-07-27
> - **Art Director Sign-Off (AD-ART-BIBLE):** APPROVED 2026-07-27
> - Approval gate: [#560]

---

## Section 1 — Visual Identity Statement

### One-Line Visual Rule

Overdrive looks like a hand-crafted 1990s Japanese racing anime rendered as a modern video game: Fujishima's heroic clarity meets Hino Matsuri's delicate expressive linework.

### Supporting Visual Principles

**Principle 1 — Speed is joy, not danger.**
When a visual decision could go either way (motion blur style, camera shake intensity, particle density), choose the option that makes speed feel exhilarating rather than threatening. Motion blur should emphasize velocity, not disorientation. Camera shake should be rhythmic (engine vibration, gear shift), not violent (crash impact).

**Principle 2 — The line makes the art.**
When deciding between a rendered surface and a drawn one, choose the drawn one. Characters are defined by clean confident outlines and fine detailed linework, not by texture maps or shader complexity. This applies to characters, vehicles, and UI elements — if it can be read as line art, it should be.

**Principle 3 — Beauty without vulgarity.**
Female characters are drawn with the same respect and visual care as male characters. Beauty is achieved through expressiveness, posture, and presence — never through sexualization or gratuitous exposure. When a character's attractiveness is relevant, it serves personality (confidence, warmth, focus), not the viewer.

### Core Fusion

Overdrive's visual identity is a fusion of two Japanese illustrators:

| Source | Contribution |
|---|---|
| **Kosuke Fujishima** (Toppu GP, éX-Driver, Sakura Wars, Tales of series, You're Under Arrest!, Oh My Goddess!) | Clean heroic proportions, approachable character design, natural athletic anatomy, confident mechanical/vehicle drafting, polished cel-shaded readability for game contexts |
| **Hino Matsuri** (Vampire Knight, Captive Hearts, MeruPuri) | Extremely fine delicate linework, meticulous detail in hair and fabric, large luminously expressive eyes carrying emotional depth, hand-drawn quality without digital smoothness |

### Character Registry

All character art uses the Fujishima + Matsuri fusion. Refer to `design/art/prompts/` for the tested Krea2 prompt library.

### Era Reference

- **Car design:** Early 1990s Formula 1 (1990-1992) — narrow low nose, no halo bar, lower cockpit sides exposing the driver's helmet, thin steering wheels with minimal buttons, smaller rear wings, exposed rear tires
- **Racing atmosphere:** Golden afternoon sunlight, warm color temperature, clear blue skies with soft white clouds, motion blur on peripheral elements
- **Emotional tone:** Joyful, heroic, alive — never melancholic, never gritty. Speed as exhilaration, not danger

### Confirmed Applications

| Element | Style | Tested | Result |
|---|---|---|---|
| Male characters | Fujishima + Matsuri | [#528], [#530] | APPROVED |
| Female characters | Fujishima + Matsuri | [#528], [#530] | APPROVED |
| Formula cars (static) | Fujishima + Matsuri | [#534] | APPROVED |
| In-game cockpit view | Fujishima + Matsuri | [#544]-[#558] | APPROVED |
| In-game chase view | Fujishima + Matsuri | [#550]-[#556] | APPROVED |
| Children/non-pilots | Fujishima + Matsuri | [#558] | APPROVED |

### Effective Krea2 Prompt Template

```
Kosuke Fujishima and Hino Matsuri fusion style, [subject description].
[Composition, pose, framing].
[Environment and lighting details].
The meticulous fine linework and vibrant cel-shaded clarity of the
Fujishima + Matsuri fusion renders [specific detail focus].
[Additional mood/atmosphere sentence].
```

### Reference Artists

- **Primary:** Kosuke Fujishima — Toppu GP (racing manga, current), éX-Driver (cars), You're Under Arrest! (vehicles), Sakura Wars (character design), Tales of series (character design)
- **Secondary:** Hino Matsuri — Vampire Knight (linework reference, eye rendering, hair detail)
- **Tertiary (mood):** Toppu GP panels for race composition and speed lines; Sakura Wars key art for heroic team portraits

### Section 1 Test Results

| Test | Prompt | Result | Session |
|------|--------|--------|---------|
| Male driver, cockpit, curve 280km/h | Fujishima + Matsuri | APPROVED | [#544] |
| Female lead, grid + victory + garage | Fujishima + Matsuri | APPROVED | [#528] |
| Black girl, tire barrier, sunset | Fujishima + Matsuri | APPROVED | [#558] |
| Male pilot, start straight, chase far | Fujishima + Matsuri | APPROVED | [#556] |
| 1991 car, cockpit wide FOV | Fujishima + Matsuri | APPROVED | [#556] |

---

## Section 2 — Color Palette

> **Status:** APPROVED 2026-07-27
> **Sources:** 1989 FIA Formula One World Championship — real constructor colors per team

### Primary Palette

The seven anchor colors of Overdrive. Every color in the game derives from or relates to these. The palette is warm-shifted to match the golden afternoon lighting — whites are creamy `#FFF8F0`, grays are brown-toned, blacks lean warm.

| # | Name | Hex | RGB | Role | Meaning in This World |
|---|------|-----|-----|------|----------------------|
| 1 | **Overdrive Orange** | `#FF6B2B` | 255, 107, 43 | Energy, UI accents, speed | The color of exhilaration. Used for the speedometer accent, "GO" signals, menu highlights, and anything that says *this is exciting*. Appears in the logo, the title screen, and the moment you cross the finish line. |
| 2 | **Victory Red** | `#E03C31` | 224, 60, 49 | Critical warnings, urgency | In F1 heritage, red is the oldest team color (Ferrari, 1950). In Overdrive, it marks critical HUD states (fuel < 25%, tire < 25%). Red means *pay attention now*. |
| 3 | **Champion Gold** | `#F5C518` | 245, 197, 24 | Victory, sunlight, premium | The color of the golden hour. Used for victory screens, P1 indicators, and the warm light that makes Overdrive look like a memory of the best race you ever had. |
| 4 | **Racing Blue** | `#1E3A5F` | 30, 58, 95 | Sky, calm states, depth | The color of a clear race-day sky. Racing Blue is the background that lets everything else pop — it's the sky above the track, the calm HUD state when fuel and tires are healthy. Blue means *all is well*. |
| 5 | **Pit White** | `#FFF8F0` | 255, 248, 240 | Text, clarity, clean surfaces | The color of clarity. Pit White is text on dark backgrounds, the white stripes on curbs, the clean space in menus. Warm-toned (not pure `#FFFFFF`) to stay under the golden sun. White means *read this*. |
| 6 | **Carbon Black** | `#1A1A1A` | 26, 26, 26 | Contrast, asphalt, outlines | The color of carbon fiber and rubber. Carbon Black is the dark that makes light colors sing — HUD backgrounds, text outlines, the track surface under afternoon sun. Warm-toned (not pure `#000000`) to avoid looking like a void. Black means *this is solid*. |
| 7 | **Grid Green** | `#2D8C3C` | 45, 140, 60 | Go signals, grass, safe states | The color of "go." Grid Green is the starting light, the healthy fuel/tire bar, the grass beside the track. Green means *you're safe, you're clear, you can push*. |

### Semantic Color System

Every color in Overdrive communicates meaning. The player must never have to guess what a color means — each hue maps to one primary concept, reinforced by context.

| Color | Hex | Primary Meaning | Secondary Meaning | Context Rule |
|-------|-----|----------------|-------------------|-------------|
| **Red** | `#E03C31` | Critical warning (fuel/tire < 25%) | Team identity (aggressive teams) | Warnings always appear in fuel/tire bars with icon backup. Position 1 uses Champion Gold, never red, to avoid confusion. |
| **Yellow/Amber** | `#F5C518` | Caution — medium state (25-50%) | Caution flag, pit advisory | Caution flag is yellow with a flag icon. HUD bars use amber fill. Yellow means *pay attention, plan ahead*. |
| **Green** | `#2D8C3C` | Safe — healthy state (> 50%) | Go signal (start lights) | Green bars = full. Green light = go. Green means *keep pushing*. |
| **Blue** | `#1E3A5F` | Calm — all systems nominal | Sky, environmental | Blue appears in HUD backgrounds and skybox. It's the resting state — when you see blue, nothing needs attention. |
| **White** | `#FFF8F0` | Information — read this | Curbs, clean surfaces | White is always text or structural lines. It carries data, not emotion. |
| **Black** | `#1A1A1A` | Background — this is context | Asphalt, rubber, outlines | Black frames everything. It's the dark behind the light, the road beneath the wheels. |
| **Orange** | `#FF6B2B` | Excitement — this is thrilling | Speed, acceleration, highlight | Orange is the game's energy signature. It appears at moments of peak excitement. |

**Flag Colors (F1 Heritage):**

| Flag | Hex | Meaning | Shape Backup |
|------|-----|---------|-------------|
| Green | `#2D8C3C` | Track clear, race start | Checkered pattern |
| Yellow | `#F5C518` | Caution, slow down | Diagonal stripes |
| Red | `#E03C31` | Race stopped, danger | Solid fill |
| Blue | `#1E3A5F` | Faster car approaching | Arrow icon |
| White | `#FFF8F0` | Final lap | Checkered pattern |
| Black | `#1A1A1A` | Black flag, penalty | Stop icon |

### Team Identity Palette

16 teams from Super Monaco GP, with the real 1989 Formula 1 constructor colors. The in-game year is 1991; teams use the Super Monaco GP fictional names with the real 1989 colors of the constructors they were based on. This avoids copyright issues while maintaining period-authentic liveries.

**Design rule:** Primary color covers ≥ 60% of the car body. Secondary color covers wings, sidepods, and helmet stripe. The player's car gets a brighter, more saturated treatment; rival cars use a slightly muted version for depth.

#### Tier 1 (Top 4 — Championship Contenders)

| ID | SMGP Team | Based On (1989) | Car | Primary | Hex | Secondary | Hex | Notes |
|----|-----------|-----------------|-----|---------|-----|-----------|-----|-------|
| `team_tier1_a` | **Madonna** | McLaren-Honda | MP4/5 | Marlboro Red | `#E03C31` | White | `#FFF8F0` | McLaren's iconic red-and-white began in 1974. The MP4/5 was white with red engine cover and side panels. [F1.com](https://www.formula1.com/en/latest/article/mclaren-liveries-through-the-years.3M1dkzZe78TyKvRN0ZAsht) |
| `team_tier1_b` | **Firenze** | Ferrari | F1-89/640 | Rosso Corsa | `#DC2828` | — | — | Solid Ferrari red with yellow prancing horse shield. The 640 was the first F1 car with semi-automatic gearbox. [Ferrari.com](https://www.ferrari.com/en-EN/formula1/f1-89) |
| `team_tier1_c` | **Millions** | Williams-Renault | FW12C/FW13 | Canon Blue | `#1A3A6B` | Yellow + White | `#F5C518` / `#FFF8F0` | Canon Williams livery — dark blue body with yellow stripe and white sections. [Williams F1](https://www.williamsf1.com/articles/bbf88c5f-eb24-4394-b654-6ef712117387/our-winning-history-of-racing-with-yellow) |
| `team_tier1_d` | **Bestowal** | Benetton-Ford | B188/B189 | Benetton Green | `#2E7D32` | Yellow + Blue + Red | `#F5C518` / `#1565C0` / `#E03C31` | "United Colors" of Benetton — the B188 ran yellow, green, blue, and red blocks. Green gradually became the dominant Benetton identity. [F1 Colours](https://f1colours.sebpatrick.co.uk/articles/livery-histories-benetton/) |

#### Tier 2 (Above Average)

| ID | SMGP Team | Based On (1989) | Car | Primary | Hex | Secondary | Hex | Notes |
|----|-----------|-----------------|-----|---------|-----|-----------|-----|-------|
| `team_tier2_a` | **May** | March-Leyton House-Judd | CG891 | Miami Blue | `#66C5C5` | White | `#FFF8F0` | "Leyton blue" — a pastel turquoise adopted from Miami Blue. Designer Adrian Newey's first F1 car. Very distinctive shade, almost emerald-green at certain angles. [thebiggarage](https://thebiggarage.jouwweb.nl/f1/f1-teams/leyton-house-f1/leyton-house-pages) |
| `team_tier2_b` | **Losel** | Lotus-Judd | 101 | Camel Yellow | `#E8A830` | Dark Blue | `#1A3A6B` | Camel Racing Yellow (called "Norfolk Mustard") dominates the car, with dark blue sections. An iconic livery described as "pale yellow-orange hue." [MotorSportRetro](https://www.motorsportretro.com/2014/08/camel-lotus-101/) |
| `team_tier2_c` | **Tyrant** | Tyrrell-Ford | 017B/018 | Tyrrell Blue | `#1E4D8C` | White | `#FFF8F0` | Tyrrell ran Honda engines through their Braun sponsorship. Blue and white livery. |
| `team_tier2_d` | **Blanche** | Brabham-Judd | BT58 | Brabham Blue | `#1A3A8C` | White | `#FFF8F0` | Brabham's return to F1 after 1988. Blue and white with no major title sponsor. [Wikipedia](https://en.wikipedia.org/wiki/Brabham_BT58) |

#### Tier 3 (Below Average)

| ID | SMGP Team | Based On (1989) | Car | Primary | Hex | Secondary | Hex | Notes |
|----|-----------|-----------------|-----|---------|-----|-----------|-----|-------|
| `team_tier3_a` | **Minarae** | Minardi-Ford | M188B/M189 | Lois Yellow | `#F5C518` | Black + White | `#1A1A1A` / `#FFF8F0` | Minardi 1989 with Lois sponsorship — predominantly yellow with black and white accents. The beloved Italian backmarker identity. [F1 Colours](https://f1colours.sebpatrick.co.uk/teams/minardi/) |
| `team_tier3_b` | **Linden** | Ligier-Ford | JS33 | Gitanes Blue | `#1A3A6B` | — | — | Solid Gitanes blue. Ligier's French tobacco blue was one of the most recognizable mid-field liveries. |
| `team_tier3_c` | **Dardan** | Dallara-BMS Scuderia Italia-Ford | F189 | Rosso Corsa | `#DC2828` | Black + White | `#1A1A1A` / `#FFF8F0` | BMS Scuderia Italia ran red cars with black and white details (Marlboro sponsorship without the chevron). [F1 Colours](https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries) |
| `team_tier3_d` | **Bullets** | Arrows-Ford | A11 | USF&G White | `#FFF8F0` | Red + Blue | `#E03C31` / `#1E4D8C` | Arrows 1989 with USF&G sponsorship — predominantly white with red and blue stripes. A clean, American-inspired livery. [F1 Colours](https://f1colours.sebpatrick.co.uk/teams/arrows/) |

#### Tier 4 (Bottom 4 — Including Player's Starting Team)

| ID | SMGP Team | Based On (1989) | Car | Primary | Hex | Secondary | Hex | Notes |
|----|-----------|-----------------|-----|---------|-----|-----------|-----|-------|
| `team_tier4_a` | **Rigel** | Rial-Ford | ARC2 | Rial Blue | `#1A3A8C` | Yellow | `#F5C518` | Rial was a German wheel manufacturer. Their 1989 car used the company's corporate blue and yellow. [F1 Colours](https://f1colours.sebpatrick.co.uk/teams/rial/) |
| `team_tier4_b` | **Comet** | Coloni-Ford | FC188B/C3 | Coloni White | `#FFF8F0` | Sky Blue + Yellow | `#66C5C5` / `#F5C518` | Coloni 1989 with Himont sponsorship — white base with sky blue and yellow accents. [F1 Colours](https://en.wikipedia.org/wiki/Formula_One_sponsorship_liveries) |
| `team_tier4_c` | **Orchis** | Onyx-Ford | ORE-1 | Onyx Blue | `#1A2A5C` | Pink + White | `#E87A90` / `#FFF8F0` | Onyx 1989 with Moneytron sponsorship — deep blue with distinctive PINK accents. One of the most unusual and memorable liveries of the late 1980s. [F1 Colours](https://f1colours.sebpatrick.co.uk/teams/onyx/) |
| `team_tier4_d` | **Zeroforce** ★ | Zakspeed-Yamaha | ZR891 | West Red | `#8B1A1A` | White | `#FFF8F0` | Zakspeed ran West sponsorship in a dark red and white scheme years before McLaren adopted it. The player's starting team. [F1 Colours](https://f1colours.sebpatrick.co.uk/teams/zakspeed/) |

> ★ Zeroforce = player's starting team. The car is dark red (`#8B1A1A`) with white (`#FFF8F0`) accents.

**Tier Visual Language:**
- **Tier 1:** Rich, high-conspicuity colors (red, blue, green) — these teams look like they belong on billboards. Gold accents on select cars mark championship pedigree.
- **Tier 2:** Distinctive, memorable mid-grid colors (turquoise, mustard yellow, blue/white) — each car has an immediately recognizable silhouette.
- **Tier 3:** Simpler, cleaner schemes (yellow, solid blue, red/white, white/red/blue) — functional liveries that don't distract from the top teams.
- **Tier 4:** Backmarker charm (blue/yellow, white/sky blue, blue/pink, dark red/white) — colorful, sometimes eccentric, like the real backmarkers they represent.

### Track Environment Palette

All track colors are warm-shifted to match golden afternoon lighting. Asphalt is brown-gray, not blue-gray. Grass is warm green, not cool green.

| Element | Hex | RGB | Notes |
|---------|-----|-----|-------|
| **Asphalt** | `#3D3835` | 61, 56, 53 | Warm dark gray — brown undertone, not blue. The road under golden sun. |
| **Asphalt (sunlit)** | `#5A524D` | 90, 82, 77 | Lighter warm gray — where the sun hits the track surface |
| **Kerb Red** | `#E03C31` | 224, 60, 49 | Same as Victory Red — curbs reuse the team palette for cohesion |
| **Kerb White** | `#FFF8F0` | 255, 248, 240 | Same as Pit White — curb stripes are the track's own flag |
| **Grass** | `#4CAF50` | 76, 175, 80 | Warm green — lush, alive, slightly yellow-shifted |
| **Grass (sunlit)** | `#66BB6A` | 102, 187, 106 | Lighter warm green — afternoon light on grass |
| **Gravel** | `#A1887F` | 161, 136, 127 | Warm brown-beige — natural, earthy |
| **Runoff** | `#78909C` | 120, 144, 156 | Cool gray — deliberately less warm than asphalt to read as "different surface" |
| **Sky (clear)** | `#5C9CE6` | 92, 156, 230 | Warm blue — slightly yellow-shifted from pure blue |
| **Sky (horizon)** | `#FFB74D` | 255, 183, 77 | Golden gradient — the sun lives here |
| **Cloud** | `#FFF8F0` | 255, 248, 240 | Warm white — same as Pit White |
| **Barrier (concrete)** | `#9E9E9E` | 158, 158, 158 | Neutral warm gray — infrastructure, not distraction |
| **Barrier (tire wall)** | `#212121` | 33, 33, 33 | Near-black — tire walls are Carbon Black |
| **Grandstand** | `#8D6E63` | 141, 110, 99 | Warm brown — wood and steel, workshop aesthetic |
| **Pit Lane** | `#424242` | 66, 66, 66 | Dark warm gray — slightly lighter than asphalt, same family |

**Lighting Temperature:** All environment colors assume a 4500K–5500K golden afternoon sun. The sun direction is always warm (slightly orange). Shadows are cool (slightly blue-tinted) to create depth. The sky gradient goes from warm blue at zenith to golden at horizon.

### HUD/UI Palette

The HUD must be readable at 200+ km/h in under 0.5 seconds. Color carries state; numbers carry precision.

**In-Race HUD (consistent, does NOT change per team):**

| Element | Hex | Usage |
|---------|-----|-------|
| HUD Background | `#1A1A1A` at 70% opacity | Dark semi-transparent panel behind all HUD elements |
| Primary Text | `#FFF8F0` | Speed, position, lap count — the numbers you read first |
| Secondary Text | `#B0BEC5` | Race time, labels, smaller data |
| Speed Accent | `#FF6B2B` | Speedometer highlight, active elements, "you are here" |

**State Colors (Fuel & Tire Bars):**

| State | Hex | Meaning | Bar Fill |
|-------|-----|---------|---------|
| Healthy (> 50%) | `#2D8C3C` | Safe | Solid green fill |
| Caution (25–50%) | `#F5C518` | Plan ahead | Solid amber fill |
| Critical (< 25%) | `#E03C31` | Danger | Solid red fill + pulse animation |

**Menu/UI Palette (menu screens use team color tinting):**

| Element | Hex | Usage |
|---------|-----|-------|
| Menu Background | `#1A1A1A` | Dark, warm — the garage at dusk |
| Menu Panel | `#2A2520` | Slightly lighter warm brown — workshop wall |
| Menu Text | `#FFF8F0` | Primary — all readable text |
| Menu Accent | `#FF6B2B` | Selected item, active button, hover state |
| Menu Secondary | `#F5C518` | Highlights, tier badges, premium feel |
| Menu Divider | `#424242` | Subtle separation — not a hard line, a shadow |
| Team Tint | Per-team primary at 20% opacity | Menu background tint matches player's team color |

**Contrast Requirements:**
- All text: Pit White `#FFF8F0` on Carbon Black `#1A1A1A` — contrast ratio 15.8:1 (exceeds WCAG AAA)
- State bars: Colored fill on dark background — minimum 4.5:1 contrast at 16px
- Team tint: Never used alone for information — always paired with text or icon
- Outline: 2px Carbon Black outline on all text over variable backgrounds

### Colorblind-Safe Backup

Overdrive's semantic colors (red, yellow, green) must be distinguishable by players with protanopia, deuteranopia, and tritanopia. **Rule: No game state is communicated by color alone.**

| Semantic Color | Colorblind Risk | Shape/Icon Backup | Implementation |
|---------------|----------------|-------------------|---------------|
| **Green** (safe/go) | Protanopia: appears brownish | ✓ Checkered flag icon for "GO"; ✓ Bar fill shape (full rectangle) | Green bar = full rectangle. Green light = checkered pattern. |
| **Yellow** (caution) | Deuteranopia: hard to distinguish from red | ✓ Diagonal stripe pattern on caution flag; ✓ Bar fill shape (half rectangle) | Yellow bar = half-full rectangle with stripe texture. |
| **Red** (critical) | Protanopia: appears dark/muted | ✓ Pulsing animation on critical bars; ✓ Text overlay ("FUEL LOW", "TYRES WORN"); ✓ Stop icon on red flag | Red bar = pulsing animation + text. Cannot be missed even if color is invisible. |
| **Blue** (calm/sky) | Tritanopia: appears greenish | ✓ Blue used for environmental elements (sky), not game state | Blue is ambient, never carries warnings. Safe to lose. |
| **Orange** (excitement) | Protanopia: appears yellowish | ✓ Orange used for accent/highlight, not state; ✓ Paired with animation (pulse, glow) | Orange is emotional, not informational. Safe to lose. |

**Colorblind Mode (Settings toggle):**
When enabled, the HUD applies a high-contrast palette that replaces hue-based differentiation with value-based differentiation:
- Green → Bright white `#FFFFFF`
- Yellow → Medium gray `#9E9E9E`
- Red → Dark red `#8B0000` (lower value, higher contrast with white)
- All bars gain pattern overlays: solid (green), stripes (yellow), dots (red)

**Testing Requirement:** Every HUD element must be verified against protanopia, deuteranopia, and tritanopia simulation before art sign-off.

---

## Section 3 — Lighting & Atmosphere

> **Status:** APPROVED 2026-07-27

### Design Rule

Every game state has a distinct lighting signature. The player should be able to close their eyes, reopen them, and know exactly what state they're in from the light alone. Lighting is the invisible narrator — it tells you where you are in the race before a single word appears on screen.

### Global Lighting Baseline

All states share these invariants:

| Property | Value | Rationale |
|----------|-------|-----------|
| **Sun color temperature** | 4500K–5500K | Golden afternoon — warm, heroic, alive. This is Overdrive's emotional anchor. |
| **Sun direction** | Upper-left, 45° elevation | Consistent shadow direction across all states. Shadows fall down-right, never toward camera. |
| **Shadow tint** | Cool blue `#1A3A6B` at 20–30% opacity | Cool shadows on warm light = depth without grit. Prevents flat/cartoony look. |
| **Ambient light** | Warm fill `#FFE0B2` at 40% | Bounce light from warm asphalt. Keeps shadow areas readable and warm. |
| **Sky gradient** | Zenith `#5C9CE6` → Horizon `#FFB74D` | Warm blue overhead, golden at the horizon. The sun always lives in the lower third of the sky. |
| **Atmospheric haze** | None at short range; subtle warm haze at 200m+ | Heat shimmer on asphalt, not fog. Clarity at racing distances. |

### State-by-State Lighting Definitions

---

#### State 1: Menu / Idle

**Primary mood:** Quiet anticipation — the calm before the race, like sitting in a garage at golden hour, helmet in hand.

**Lighting character:**
- Time of day: Late afternoon, 5000K, sun low at 20° above horizon
- Contrast: Low — soft, diffused, almost flat. No harsh shadows.
- Direction: Warm key light from the left, filling the scene like window light in a workshop
- Color cast: Warm amber `#FFE0B2` at 15% opacity over entire scene — a sun-drenched haze

**Atmospheric descriptors:** Still, warm, golden, expectant, intimate.

**Energy level:** Contemplative.

**Mood-carrying visual element:** A single shaft of golden sunlight cuts through the garage door, illuminating dust motes floating in the air. The light catches the edge of the car's bodywork, creating a soft rim highlight on the rear wing endplate. Everything beyond that shaft falls into warm, comfortable shadow.

---

#### State 2: Countdown

**Primary mood:** Electric tension — the grid is alive, the lights are coming, and the world narrows to a single moment.

**Lighting character:**
- Time of day: Same golden afternoon (4500K), but the camera is looking slightly upward at the starting gantry
- Contrast: High — the amber starting lights are the brightest elements in the scene, punching through the warm ambient
- Direction: Sun behind the camera, illuminating the grid evenly. Starting lights add overhead point sources.
- Color shift: Scene desaturates 10% — the world goes slightly muted to make the red/amber starting lights pop

**Atmospheric descriptors:** Tense, electric, expectant, compressed, crystalline.

**Energy level:** Contemplative (but building — the calm before the explosion).

**Mood-carrying visual element:** The five red starting lights illuminate one by one from left to right, each casting a warm amber pool on the asphalt directly below. When they all extinguish, the scene instantly snaps back to full golden saturation — the release of tension is a visual event, not just an audio cue.

---

#### State 3: Qualifying Flying Lap

**Primary mood:** Focused precision — a single car, a clear track, and the world reduced to the next apex.

**Lighting character:**
- Time of day: Peak afternoon, 5500K, sun at 45° — the brightest, clearest lighting state
- Contrast: Medium-high — crisp shadows define track edges and curbs, but no darkness. Everything is legible.
- Direction: Sun overhead-left, casting defined but not dramatic shadows
- Sky: Clear, minimal clouds. The sky is a clean gradient from warm blue to golden horizon — no distractions.

**Atmospheric descriptors:** Clean, sharp, rhythmic, luminous, focused.

**Energy level:** Measured.

**Mood-carrying visual element:** The track surface has a subtle heat shimmer — a wavering distortion in the air 2 meters above the asphalt that makes the track feel alive and fast. When the car passes through a shaded section (grandstand overhang, tree shadow), the sudden shift from bright sun to cool shade and back creates a rhythmic strobing that matches the car's speed.

---

#### State 4: Racing

**Primary mood:** Joyful frenzy — 16 cars, golden light, speed as celebration. This is the state Overdrive exists for.

**Lighting character:**
- Time of day: Golden hour begins — 4500K, sun dropping toward horizon, long shadows stretching across the track
- Contrast: High and dynamic — shadows from other cars sweep across your cockpit as you draft. Light shifts as you change position on track.
- Direction: Sun from the left, low angle. Creates dramatic side-lighting on cars. Front-lit on straights, back-lit in braking zones.
- Dynamic elements: Sun flickers through grandstand structures, tree-lined sections create alternating light/shadow bands at speed

**Atmospheric descriptors:** Frenetic, golden, exhilarating, alive, rhythmic.

**Energy level:** Frenetic.

**Mood-carrying visual element:** The sun catches the helmets of cars ahead — each driver's helmet becomes a bright point of light in the golden haze, creating a constellation of racing positions. As you overtake, the helmet-light slides from right to left across your windshield, a visual confirmation of position change that requires no HUD.

---

#### State 5: Pit Transit

**Primary mood:** The deceleration — speed bleeds away, the world opens up, and the frenetic energy dissolves into something calmer.

**Lighting character:**
- Time of day: Unchanged from Racing state (golden hour) — the world doesn't change, only your relationship to it does
- Contrast: Decreasing — as the car slows, the motion blur fades and the scene becomes sharper, more still
- Direction: Same low sun, but the pit entry walls create a tunnel effect — alternating shadow and warm light as you pass pit wall openings
- Color shift: Subtle desaturation of 5% — the world quiets down visually as speed drops

**Atmospheric descriptors:** Transitional, dissolving, focused, mechanical, intimate.

**Energy level:** Transitional.

**Mood-carrying visual element:** The pit lane entry wall casts long horizontal shadows across the car's bodywork — like passing through venetian blinds. Each shadow stripe is a visual reminder that you're leaving the race and entering the service zone. The last shadow stripe ends at your pit box number.

---

#### State 6: Pit Service

**Primary mood:** Mechanical calm — the still center of the storm, precise and contained.

**Lighting character:**
- Time of day: The pit box exists in two lighting zones simultaneously — golden afternoon above, cool fluorescent below
- Contrast: Medium — the pit box overhead lights create a cooler, more clinical zone within the warm environment
- Direction: Overhead fluorescent strip lights (5500K, cooler than the sun) cast even, shadowless light on the car. The golden sun illuminates the pit lane beyond the box edges.
- Color shift: Pit box interior shifts toward neutral — the amber cast is replaced by cleaner light. This is the only state where the scene feels slightly cooler than the global baseline.

**Atmospheric descriptors:** Still, precise, mechanical, clinical, calm.

**Energy level:** Still.

**Mood-carrying visual element:** The overhead fluorescent light reflects off the freshly changed tires — new rubber is slightly glossy, catching the cool overhead light in a way that distinguishes it from the sun-baked track asphalt. The contrast between the cool pit box interior and the warm golden world beyond the pit wall edge creates a visual "bubble" of calm.

---

#### State 7: Finished

**Primary mood:** Triumphant catharsis — the race is over, you crossed the line, and the world celebrates with you.

**Lighting character:**
- Time of day: Peak golden hour — 4200K, sun at 10° above horizon, everything bathed in deep amber-gold
- Contrast: High but warm — deep shadows, brilliant highlights, maximum visual drama
- Direction: Sun directly ahead (behind the finish line), creating a silhouette effect on the car crossing the line
- Color shift: Scene pushes 10% warmer and 5% more saturated than racing state — the world literally glows brighter when you win

**Atmospheric descriptors:** Triumphant, golden, cathartic, radiant, heroic.

**Energy level:** Measured (but emotionally intense).

**Mood-carrying visual element:** The sun is directly ahead as you cross the finish line — a massive golden lens flare blooms across the entire windshield, washing the cockpit in amber light. For 2 seconds, the entire screen is golden. As the flare recedes, the checkered flag and pit crew become visible through the fading glow. The sun through the windshield at this angle is the visual signature of victory.

---

#### State 8: Paused

**Primary mood:** Neutral utility — the game is frozen, the player is making decisions, the world waits without emotion.

**Lighting character:**
- Time of day: Frozen at the exact moment of pause — no time-of-day shift
- Contrast: Reduced 15% — shadows lighten, highlights dim. The scene becomes flatter, more document-like.
- Direction: Unchanged from active state
- Color shift: Desaturate 20% — the world goes muted, pushing visual attention to the pause menu UI

**Atmospheric descriptors:** Neutral, muted, frozen, utilitarian, flat.

**Energy level:** Still.

**Mood-carrying visual element:** A subtle vignette darkens the screen edges by 30%, framing the pause menu. The racing scene behind the menu is visible but blurred (Gaussian, 4px radius) and desaturated — present but not competing for attention. No elements animate. No particles move. Time is literally frozen.

### Transition Table

Lighting shifts between states are not instantaneous — they ease over defined durations to prevent visual jarring.

| From → To | Transition | Duration | What Changes | Visual Cue |
|-----------|-----------|----------|--------------|------------|
| **Menu → Countdown** | Scene loads to grid | Instant (load) | Menu's soft amber replaced by grid's high-contrast golden light | Camera fades from black to grid view, starting lights off |
| **Countdown → Racing** | Lights out → full saturation | 0.3s | 10% desaturation snaps to full color. Starting lights extinguish. | Amber light pools vanish. Golden sun takes over. The world "wakes up." |
| **Racing → Qualifying** | N/A (separate modes) | N/A | Qualifying uses the same lighting as Racing but without other car shadows | — |
| **Racing → Pit Transit** | Desaturation begins | 1.0s | 5% desaturation. Motion blur reduces. Pit wall shadows begin. | Visual energy drops. The world quiets. |
| **Pit Transit → Pit Service** | Pit box zone entry | 0.5s | Fluorescent overhead lights activate. Warm ambient drops. | Cool light pools appear on car bodywork. Sunlight confined to pit lane beyond. |
| **Pit Service → Racing** | Pit exit acceleration | 1.5s | Fluorescent lights deactivate. Full golden saturation returns. Motion blur builds. | Cool-to-warm shift. Shadows sharpen. The world heats up again. |
| **Racing → Finished** | Finish line cross | 0.0s (instant) | Scene immediately pushes warmer + more saturated. Sun position locked ahead. | Golden lens flare blooms. The world celebrates. |
| **Finished → Menu** | Post-race flow | 1.0s fade | Warm golden fades to menu's soft amber. | Cross-dissolve from sunset to garage interior. |
| **Any → Paused** | Pause activated | 0.2s | Desaturation 20%, contrast reduction 15%, vignette applied, blur 4px | Scene flattens. Menu appears. World waits. |
| **Paused → Any** | Pause dismissed | 0.2s | Desaturation removed, contrast restored, vignette removed, blur cleared | Scene snaps back to full visual life. |

### Lighting State Summary

A quick-reference table for implementation.

| State | Sun Temp (K) | Saturation | Contrast | Desat% | Blur | Vignette | Signature Element |
|-------|-------------|------------|----------|--------|------|----------|-------------------|
| Menu | 5000 | 100% | Low | 0% | Off | Off | Dust motes in sun shaft |
| Countdown | 4500 | 90% | High | 10% | Off | Off | Red starting lights, one by one |
| Qualifying | 5500 | 100% | Med-High | 0% | Off | Off | Heat shimmer on asphalt |
| Racing | 4500 | 105% | High | 0% | Motion | Off | Helmet-lights in golden haze |
| Pit Transit | 4500 | 95% | Med | 5% | Reducing | Off | Shadow stripes from pit wall |
| Pit Service | 5500 (box) | 90% | Med | 5% | Off | Off | Cool fluorescent on new tires |
| Finished | 4200 | 105% | High | -10% | Off | Off | Sun-through-windshield lens flare |
| Paused | (frozen) | 80% | Low | 20% | 4px | 30% | Blurred, desaturated, frozen |

---

## Section 4 — Character Art Direction

> **Status:** APPROVED 2026-07-27

### Design Rule

Characters in Overdrive are readable as people, not as textures. Every character design decision must answer: *can you feel this person's personality from the helmet alone?* During racing, the helmet IS the character. During menus, portraits, and podiums, the person behind the helmet is revealed.

---

### 4.1 Visual Archetypes Per Role

**Drivers (Protagonist, Rivals, Supporting)**

| Role | Silhouette | Distinguishing Traits | Reference |
|------|------------|----------------------|-----------|
| **Protagonist (Player)** | Taller, leaner than average. Shoulders slightly wider than head width. Stands with weight forward — ready to move. | Racing suit is team-colored with one personal accent (stripe on collar, number on chest). Helmet has a signature design element that evolves across career. Widest expression range — determined, joyful, focused, triumphant. | Fujishima: heroic proportions from Toppu GP protagonist. Matsuri: fine linework on hair and suit details gives personality even at small portrait size. |
| **Rivals (Tier 1–4)** | Stockier or more angular than protagonist. Posture confident to arrogant. Tilt of chin or angle of stance conveys competitive energy. | Each rival has one defining silhouette feature (hairstyle, body language, signature accessory). Helmets are team-colored with unique stripe pattern per driver. | Fujishima: distinct rival archetypes from Tales series — each rival immediately recognizable by silhouette. |
| **Supporting Drivers** | Neutral, proportional. Slightly less defined than protagonist or rivals. | Team suit is primary identifier. Less personal accent than protagonist. Expression competent but not flamboyant. | Fujishima: background cast in Sakura Wars — well-designed but not competing for attention. |

**Team Personnel**

| Role | Silhouette | Traits | Reference |
|------|------------|--------|-----------|
| **Team Owner / Principal** | Broad, imposing. Suits (not racing suits). Stands with authority. Older, more weathered face. | Formal suit in team colors. Lapel pin with team logo. Expression ranges from calculating to proud to furious. | Fujishima: commanding authority figures in Sakura Wars — presence through posture, not size. |
| **Engineer** | Lean, slightly hunched from leaning over consoles. Glasses or headset. Hands always busy. | Team-branded polo. Pockets full of pens. Expression is focused, analytical, occasionally warm. | Fujishima: technical supporting characters from Toppu GP. |
| **Pit Crew** | Compact, athletic, uniform during service. | Full team race suits, balaclava, gloves. During pit stops they function as a unit (well-oiled machine). In garage scenes, individual faces and expressions are visible. | Pit service: unit identity. Garage: individual identity. Tradeoff approved at [#677]. |

**NPCs**

| Role | Silhouette | Traits | Reference |
|------|------------|--------|-----------|
| **Commentator** | Head-and-shoulders broadcast framing. Expressive, animated. | Headset, suit jacket, mic flag. Expression mirrors race energy — excited or analytical. | Fujishima: broadcast framing from Toppu GP manga panels. |
| **Fans (Grandstand)** | Simplified, colorful masses. Individual faces only in close-up. | Team-colored clothing. Caps, scarves, flags. Movement is collective. | Enough detail to feel alive; not enough to distract from racing. |
| **Podium Presenter** | Neutral figure — steward, official, or commentator. | Formal wear, delivers trophy and bouquet to winning driver. Gender-neutral design. Purpose is ceremonial authenticity, not decoration. | Approved at [#680]: included as neutral figure within Principle 3 boundary. |
| **Children** | Smaller proportions (1:5.5–6 head-to-body). Same Fujishima + Matsuri fusion. | Racing-themed clothing (team caps, miniature suits). Expression is wonder and excitement. Tested successfully at [#558]. | Proves style works at child proportions. |

---

### 4.2 Distinguishing Feature Rules

Since helmets cover faces during racing, personality must be conveyed through **helmet design, suit color pattern, and body language** — in that order of visibility.

**Identifiability Hierarchy (at racing speed):**
1. **Helmet shape + color pattern** — Primary. Each team has a base helmet color (Section 2 palette). Each driver within a team has a unique stripe pattern.
2. **Suit color blocks** — Secondary. Team primary covers torso and legs. Secondary on shoulders, arms, collar.
3. **Car number** — Tertiary. On helmet side and nose cone. Readable at close range only.

**At Menu / Portrait Distance:**
1. **Face and expression** — Primary. Matsuri-style eyes carry emotional weight.
2. **Hairstyle** — Secondary. Each character has a distinct hair shape that reads in silhouette.
3. **Suit details** — Tertiary. Sponsor patches, collar style, zipper pull, glove color.

**Rule:** No two characters on the same team share a helmet stripe pattern, hair silhouette, or body posture archetype. The grid of 16 must read as 16 individuals, not 16 cars.

---

### 4.3 Expression and Pose Targets

**Racing (Cockpit View):** Characters are not visible. The player IS the driver. No character model competes for attention.

**Portraits (Menus, Pre-Race, Results, Podium):** Fully expressive Japanese anime style — not restrained, not photorealistic. Eyes are large, luminous, emotionally loaded (Matsuri). Body language is confident and dynamic (Fujishima).

| Expression | Use Case | Target Feel | Reference |
|-----------|----------|-------------|-----------|
| **Determined Focus** | Pre-race, qualifying | Locked-in, sharp eyes, jaw set. The world narrows to the track. | Fujishima: Toppu GP racing face — clarity without grit. |
| **Joyful Triumph** | Victory, podium | Open smile, eyes bright, fist raised or arms wide. Pure celebration. | Fujishima: Tales of series victory poses — earned, not smug. |
| **Disappointed Resolve** | Poor finish, DNF | Eyes downcast but jaw set. Not defeated — recalibrating. | Matsuri: emotional depth without melodrama. |
| **Surprised Reaction** | Unexpected overtake, crash ahead | Eyes wide, mouth open, hands reflexive. Brief, human. | Fujishima: approachable surprise, not exaggerated shock. |
| **Cool Confidence** | Rival confrontation, menu idle | Slight smirk, relaxed posture, helmet under arm. | Fujishima: Sakura Wars rival archetypes — charisma without arrogance. |
| **Warm Gratitude** | Post-race, team interaction | Soft smile, eye contact, handshake or nod. The human moment after the machine stops. | Matsuri: quiet emotional beats, sincere without sentimentality. |

**Rule:** Every expression must feel like a real person having a real moment. No anime tropes (sweat drops, nosebleeds, chibi reactions). Grounded emotion rendered with anime expressiveness.

---

### 4.4 Proportion Philosophy

All characters use **Fujishima's heroic proportions** (1:7.5 head-to-body). Approved at [#677].

| Property | Value | Rationale |
|----------|-------|-----------|
| **Head-to-body (adults)** | 1:7.5 | Slightly longer legs than realistic 1:7. Heroic without being superhuman. Fujishima standard in Toppu GP and Tales of series. |
| **Shoulder width** | 2.2–2.5× head width (drivers) | Athletic — these athletes wrestle 700kg cars at 300km/h. Not bodybuilders, not slender. |
| **Head-to-body (children)** | 1:5.5–6 | Larger heads, softer features. Same style, smaller frame. Tested at [#558]. |
| **Stylization by role** | Drivers: full heroic. Personnel: slightly more realistic. Fans: simplified. | The more important the character, the more Fujishima heroic treatment applies. |

**Matsuri's contribution:** While Fujishima defines body proportions, Matsuri's influence appears in the fine detail within those proportions — delicate rendering of fingers, precise linework on fabric folds, meticulous hair strands giving a hand-crafted quality within the heroic frame.

**Rule:** No photorealistic proportions. No super-deformed proportions. The sweet spot is "heroic human."

---

### 4.5 Helmet Design

Helmets must be: (1) readable at 200km/h, (2) beautiful at portrait distance, (3) period-authentic 1991.

**Shape:**
- **Type:** Full-face, single-piece shell — 1991 F1 regulation, the last era before complex visor mechanisms
- **Chin bar:** Slightly elongated, angular — period-correct Arai/Shoei design
- **Visor:** Wide, single-piece, slightly convex — large eye port for visibility
- **Ventilation:** Minimal — 2-3 small vents on crown. Clean surface is more readable at speed.

**Visor Tint by Tier:**

| Tier | Visor | Rationale |
|------|-------|-----------|
| **Tier 1** | Gold or silver mirror | Championship pedigree — the visor reflects the world. You can't see their eyes. Intimidating. |
| **Tier 2** | Light smoke | Semi-transparent — you glimpse the eyes. Competent but not untouchable. |
| **Tier 3** | Clear to light tint | Open, visible eyes. Straightforward competitors. |
| **Tier 4 (Player)** | **Clear** | Symbolic: the underdog has nothing to hide and everything to prove. Clear visor frame has team-colored accent. Approved at [#677]. |

**Decoration — Three Layers:**
1. **Base color** — team primary (Section 2), 60% of surface
2. **Stripe pattern** — unique per driver within a team, 25% of surface. Simple enough to read at speed (diagonal, V-shape, asymmetric)
3. **Personal accent** — visible only at portrait distance, 15%. A tiny symbol, name on the back, a date. Rewards close inspection without cluttering the at-speed read.

**Identity at speed:** Helmet stripe pattern + team color = unique identifier. Section 3 describes: "the sun catches the helmets of cars ahead — each becomes a bright point of light in the golden haze." The stripe pattern distinguishes one point from another when drafting behind three cars.

---

### 4.6 Racing Suit Design

**Color Architecture:**

| Zone | Color | Coverage |
|------|-------|----------|
| Torso (front/back) | Team primary | 40% of suit |
| Shoulders + arms | Team secondary | 25% of suit |
| Collar + cuffs | Accent color | 5% of suit |
| Gloves | Team primary or black | Hands — grip surface black, back of hand matches team |
| Boots | Black or team primary | Feet |

**Sponsor Patches:** Present but restrained (1991 style — smaller than modern F1). Patches on: chest (small, centered), upper arm (one per arm), helmet side. Patches do NOT cover the suit's color architecture — team identity reads first.

**Period-Authentic Details (1991):**
- **Collar:** High, padded, velcro closure — 1991 F1 suits had prominent collars that modern suits lack
- **Zipper:** Central, exposed, pull tab visible — not hidden behind a flap
- **Sleeves:** Fitted but not skin-tight — fabric folds visible (Matsuri detail opportunity)
- **Material:** Matte, slightly textured (Nomex) — hand-drawn quality (Principle 2)
- **Knee/elbow reinforcement:** Subtle darker shade of the zone color

---

### 4.7 LOD Philosophy

Detail drops from the inside out — fine facial features and fabric texture go first; silhouette and color blocks persist longest.

| Level | Distance | Preserved | Drops | Cartoon |
|-------|----------|-----------|-------|---------|
| **LOD 0** | Portrait | Full Matsuri detail: eye luminosity, hair strands, fabric texture, suit wrinkles, glove stitching, helmet reflection | Nothing — art bible quality | Matsuri maximum |
| **LOD 1** | Close | Face and helmet detail. Suit color blocks. Major fabric folds. Sponsor patches. | Hair strands, fine stitching, small suit details | Fujishima clean |
| **LOD 2** | Medium | Helmet shape + stripe pattern. Suit color blocks. Body posture. | Facial features, fabric folds, sponsor patches | Readable at action distance |
| **LOD 3** | Far (racing) | Helmet color + basic stripe. Suit primary color. Silhouette. | All fine detail — only color blocks + shape | Speed: color + shape = identity |

**Drop Priority:** 1) fabric texture/stitching → 2) facial features/hair strands → 3) suit secondary zones → 4) **last to stand:** team primary color, helmet base color, body silhouette.

**Rule:** At LOD 3, a driver is identified by: team primary color + helmet base color + body posture. If this trio doesn't uniquely identify a driver, the design fails at speed.

---

### 4.8 Non-Driver Characters

Non-drivers exist on a spectrum from **full character** (team owner) to **simplified archetype** (fan). The rule: *the closer a non-driver is to the player's story, the more individualized they are.*

| Type | Detail Level | Notes |
|------|-------------|-------|
| **Team Owner** | Full — unique face, body, expression range | Portrait quality matches drivers. Fujishima: Sakura Wars team leaders. |
| **Engineer** | Full — unique face, glasses/headset, body language | Individualized within team. Fujishima: technical support in Toppu GP. |
| **Pit Crew** | Unit identity during pit; individual in garage | Matsuri: group cohesion. Approved at [#680]. |
| **Commentator** | Broadcast-only, head-and-shoulders | Two: one excited, one analytical. |
| **Fans** | Simplified — color + movement carry energy | Individual faces only in extreme close-up. |
| **Podium Presenter** | Full — formal wear, neutral figure | Brief screen time but high quality. Delivers trophy, then exits. |
| **Children** | Full when in story; simplified in crowd | Style tested at [#558]. |

**Rule:** No non-driver character is drawn in a different style. A fan in the grandstand is simplified by detail reduction, not by style shift.

---

### 4.9 Character-Specific Prohibitions

- **No photorealistic skin** — Breaks the hand-crafted anime feel. Cel-shaded with Matsuri-style fine linework for shadow edges. (Principle 2)
- **No glossy/gacha-game eyes** — Matsuri's eyes are luminous and expressive, not glossy collectible objects. (Matsuri reference)
- **No sexualized posing or costume** — Principle 3 direct application.
- **No gritty/dirty faces** — Speed is joy, not danger. Drivers are clean, focused, alive. (Principle 1)
- **No chibi/super-deformed reactions** — Emotional tone is grounded anime, not gag manga. (Fujishima reference)
- **No visible blood or injury** — Overdrive is joyful. Crashes result in DNF, not wounds. (Emotional tone)

---

## Section 5 — Environment & Level Art

> **Status:** APPROVED 2026-07-27

### Design Rule

The track environment is the stage for speed, not a destination itself. Every trackside element must answer: *does this make the car feel faster when it blurs past?* Environments exist to frame the racing — grandstands create tunnel-vision, barriers define the line, and vegetation becomes streaking color at speed. The hand-drawn aesthetic of Principle 2 extends to environments through painted textures, bold silhouette, and warm-period color.

---

### 5.1 Architectural Style

**Period anchor:** 1991 F1 — the last era before Tilke-dromes standardized global circuit architecture. Each track's structures reflect its real-world heritage, filtered through the Fujishima/Matsuri aesthetic.

**Principle:** Structures are *drawn architecture*, not built architecture. Every building should look like a Fujishima background painting — confident perspective lines, warm-toned surfaces, selective detail that rewards close inspection but reads as clean silhouette at speed.

| Structure | 1991 Authentic | Overdrive Interpretation |
|-----------|---------------|--------------------------|
| **Grandstands** | Steel-frame, wooden benches, open-air | Warm brown steel (`#8D6E63`) with Pit White seats. Simple flat canopies. Crowds as color-blocked team supporters. |
| **Pit Buildings** | Low, functional, concrete + steel | Flat-roofed concrete boxes with garage door openings. Team-colored banners above each garage. |
| **Timing Towers** | Tall, narrow, analog/digital hybrid | Warm-lit display panels. Large segmented digits — not LCD screens. |
| **Hospitality Suites** | Elevated glass-front platforms | Clean geometric volumes with reflective glass (golden-hour sky reflection). |
| **Marshals' Posts** | Small elevated platforms with orange flag stations | Compact structures at braking zones. Color-coded flag indicators. |
| **Camera Platforms** | Roof-mounted and ground-level rigs | Small skeletal structures with boxy camera shapes — period-correct 1991 broadcast cameras. |

**Architectural Detail Budget:** No structure should have detail that reads as noise at racing speed. Pass the blur test: at 280km/h, does it become a pleasing color band or visual noise? Detail at 0–50m = full Fujishima fine-detail. At 50–150m = clean silhouette with key accents. At 150m+ = 2–3 color blocks max.

---

### 5.2 Texture Philosophy

**Core decision:** Painted stylized textures, not PBR. The environment maintains the hand-drawn look through texture painting, not shader complexity.

| Surface | Technique | Rationale |
|---------|-----------|-----------|
| **Asphalt** | Hand-painted base with subtle warm grain. No normal-map roughness variation. | At speed, asphalt is a color field. PBR adds photorealistic noise breaking the aesthetic. |
| **Grass** | Stylized tuft at near distance, flat warm-green (`#4CAF50`) at mid-far. ±5% hue variation. | Peripheral blurring color at speed. Near detail rewards slow moments. |
| **Gravel** | Painted beige-brown (`#A1887F`) with soft speckle. No individual stones. | Warm brown signals "different surface" without simulating individual rocks. |
| **Concrete barriers** | Flat warm gray (`#9E9E9E`) with painted weathering (dark streaks at base). | Speed-framing elements — flat painted concrete reads as solid without competing. |
| **Tire walls** | Near-black (`#212121`) with soft horizontal banding. | Tire walls are safety boundaries — dark solid mass, not detailed objects. |
| **Kerbs** | Flat alternating red (`#E03C31`) and white (`#FFF8F0`) stripes. Painted geometry, not textured. | High-contrast stripe reads instantly at any speed. |
| **Metal (guardrails)** | Flat silver-gray with warm tint. Highlight edge as a single bright painted line. | Golden-hour catchlight as drawn highlight, not specular map. |
| **Building walls** | Flat warm tones (palette values). No tile/brick normal maps. | Background — flat painted surfaces maintain the drawn look at every distance. |
| **Water (Monaco)** | Stylized blue with painted ripple pattern. Sky reflection as color gradient. | Water is atmosphere, not simulation. Consistent with drawn aesthetic. |

**Resolution budget:** Asphalt 512×512 tiling → flat color 50m+. Grass 256×256 → flat 30m+. Barriers 256×256 → flat 40m+. No PBR maps in MVP. Entire environment uses single simple-lit or unlit shader preserving painted color values under golden-hour lighting (Section 3). Shader complexity reserved for cars and VFX.

---

### 5.3 Prop Density Rules

**Philosophy:** Moderate and purposeful. Every prop serves one function: (1) define track boundaries, (2) communicate speed through blur, or (3) establish per-track identity. Decoration for decoration's sake violates Principle 2.

| Zone | Density | Rationale |
|------|---------|-----------|
| **Start/finish straight** | High — grandstands, gantry, banners, timing tower | Visual anchor. Maximum density creates a "canyon" framing the start. |
| **Fast straights** | Moderate — catch fencing, banners, occasional marshal post | Speed corridors — props blur into streaks conveying velocity. |
| **Technical corners** | High — tire walls, catch fencing, marshal posts | Danger zones — more props signal "pay attention" and define the racing line. |
| **Pit lane** | Moderate — pit wall, garage openings, overhead lights | Functional density — infrastructure, not scenery. |
| **Runoff areas** | Low — gravel traps, grass | Escape room — less density = less visual pressure. |
| **Background (150m+)** | Very low — simple shapes, color blocks | Never competes with racing surface. |

**Density gradient rule:** Dense at track edge (maximum blur), sparse in background (atmosphere). Creates natural tunnel-vision framing the racing line.

---

### 5.4 Environmental Storytelling

**Principle:** The track tells the story of racing without text. Every worn surface communicates *racing happens here* — a living circuit, not a pristine playground.

| Detail | Location | Story Told |
|--------|----------|-----------|
| **Tire marks (racing line)** | Braking zones, apexes, chicane exits | "This is where cars fight" — dark rubber streaks showing the optimal line. |
| **Worn grass patches** | Corner exit edges | "Cars push limits here" — brown-yellow patches in the warm green grass. |
| **Oil stains** | Pit boxes, pre-race grid | "Teams service here" — dark patches on pit lane asphalt. |
| **Rubber on kerbs** | High-speed kerbs | "The fast line cuts here" — dark marks on red/white kerb surface. |
| **Concrete weathering** | Older structures | "This track has history" — vertical streaking on walls. |
| **Faded sponsor paint** | Trackside walls | "Sponsors come and go" — ghosted letter shapes from old paint. |
| **Heat shimmer** | Long straights, braking zones | "The asphalt is hot" — post-processing wavering air distortion. |

**Per-Track Unique Details:** Monaco = harbor reflections + yacht masts. Silverstone = open airfield + distant hangars. Spa = dense forest pressing track + Eau Rouge valley shadow. Monza = ancient tree canopy dappling the straights + aged Italian concrete parkland.

**Rule:** Storytelling details visible at 0–50m and during slow moments. At speed, they blend into the environment's general warmth. Never disrupt the racing-line read.

---

### 5.5 Per-Track Identity

Each track has a distinct visual personality beyond layout — atmospheric, architectural, vegetative.

| Track | Dominant Color | Architecture | Vegetation | Light Quality | Unique Element |
|-------|---------------|-------------|-----------|--------------|----------------|
| **Monaco** | Mediterranean blue + warm stone | Narrow street walls, stacked buildings, harbor-front hotels | Potted palms, planters | Warm and enclosed — canyon shadows | Harbor water with yacht reflections. Tight, intimate, vertical. |
| **Silverstone** | Open sky blue + RAF gray | Flat hangar buildings, simple grandstands, wide runoff | Sparse grass, hedgerows | Open and bright — wide sky, minimal shadows | Expansive British countryside airfield feel. |
| **Spa** | Forest green + altitude gray | Minimal buildings — forest dominates | Dense Ardennes forest pressing track | Dappled — alternating light/shadow bands | Eau Rouge valley. The forest is the track's identity. |
| **Monza** | Park green + aged concrete | Old grandstands, concrete barriers, parkland | Ancient chestnut tree canopy | Filtered — dappled light on straights | Temple of Speed heritage. Italian park racing. |

**Color palette adjustments per track:** Monaco — asphalt slightly warmer/browner. Silverstone — standard palette. Spa — asphalt slightly cooler, grass deeper green. Monza — standard warm with tree-shadow overlay on straights.

**Rule:** Per-track identity uses atmosphere (light, vegetation, architecture) — not artificial color grading. Each track uses the base palette (Section 2) with subtle shifts maintaining golden-hour consistency.

---

### 5.6 Skybox / Background

**Decision:** Painted 2D skybox with subtle parallax. The sky is atmosphere, not a destination.

- **Sky gradient:** Zenith `#5C9CE6` → Horizon `#FFB74D` (Section 3). Gradient shader, not texture. Smooth transition responding to game-state lighting.
- **Cloud layer:** Soft cumulus, warm white `#FFF8F0`. Hand-painted texture — stylized, rounded, non-threatening. 2–3 formations per skybox.
- **Distant terrain:** Painted silhouette — track-appropriate horizon shapes (mountains, city, forest). Warm atmospheric haze toward horizon.
- **Distant structures:** 2–3 tone silhouettes (Monaco skyline, Spa hills, Monza parkland). No individual building detail.

**Per-track skybox:** Monaco = Alpine foothills + cityscape, Mediterranean warmth. Silverstone = flat countryside, vast open sky. Spa = Ardennes forested hills, valley haze. Monza = faint Alpine silhouette, tree canopy partially framing the sky.

**Background depth budget:** 0–200m = full 3D geometry. 200–500m = billboard trees/buildings. 500m–2km = painted skybox layer. 2km+ = sky gradient + clouds.

---

### 5.7 Night / Weather Consideration

**Decision:** No night racing. Rain not planned. Golden afternoon (Section 3) is the permanent on-track lighting condition.

**Garage/UI exception:** Menu/Idle state (Section 3, State 1) may use late-afternoon or dusk-adjacent lighting for atmosphere. This is a presentation decision, not a gameplay lighting system. No skybox variant, floodlights, or wet-surface materials.

**Rule:** All environment resources serve the golden-afternoon baseline. Zero budget for night, rain, or weather variants.

---

### 5.8 FIA Two-Lane Pit Lane

**Reference:** Track System (track-system.md §7) — fast lane + 16 offset service boxes.

**Visual zone distinction:**

| Zone | Surface | Markings | Lighting |
|------|---------|----------|----------|
| **Fast lane** | Asphalt `#3D3835` (same as track) | White centerline. Speed-limit "80" painted at entry. | Natural golden-hour (Section 3, State 5). |
| **Service boxes** | Asphalt `#424242` (slightly lighter, visibly distinct) | White box outline per team. Team number in box. | Overhead fluorescent strips 5500K (Section 3, State 6). |
| **Pit wall** | Concrete `#9E9E9E` barrier | Timing displays, entry/exit signs. | Natural + reflected. |

**Asphalt differentiation:** 5-value difference between fast lane (`#3D3835`) and service box (`#424242`) creates subtle visual boundary without physical wall. Clearly visible from stationary cockpit (State 6).

**Pit entry/exit:** Entry = yellow line across track + "PIT ENTRY" sign + barrier narrowing. Exit = green line + dashed blend line onto track.

**Pit box model:** Overhead canopy with fluorescent fixtures. 1991 equipment (manual wheel guns, simple jacks). Team banner + number. Floor marking.

---

### 5.9 Grid and Start Area

**Reference:** Track System (track-system.md) — 16 cars, 2×8 formation, ~8m row spacing, ~3.5m column spacing.

**Grid visual elements:**
- **Grid slot markings:** White painted rectangles, 2×8. Faded tire wear texture.
- **Pole position:** Larger marking, "1" inside. Brighter than other slots.
- **Starting gantry:** Warm brown steel (`#8D6E63`) frame spanning track width. 5 red light fixtures hanging from crossbar.
- **Starting lights:** Large circular red fixtures — sequential illumination during Countdown (Section 3, State 2). Brightest elements during countdown.
- **Track width:** White edge lines — wider spacing at grid to accommodate 2×8 formation.
- **Pit wall proximity:** Barrier separating grid from pit lane. Crew visible behind.

**Grid layout (2×8):**

| Left Column | Right Column |
|-------------|-------------|
| P1 (pole) | P2 |
| P3 | P4 |
| P5 | P6 |
| P7 | P8 |
| P9 | P10 |
| P11 | P12 |
| P13 | P14 |
| P15 | P16 |

Odd positions on left (racing line side). Even on right. Row spacing ~8m, column spacing ~3.5m.

**Rule:** The grid is the most information-dense zone. It must communicate: (1) 16 cars start here, (2) race is about to begin, (3) direction of travel. Starting gantry + lights are the visual anchor.

---

## Section 6 — UI Visual Language

> **Status:** APPROVED 2026-07-27

### Design Rule

The UI is a transparent layer between the player and the race — present when needed, invisible when not. Every element earns its place by passing the 0.5-second reading test. Color carries state, numbers carry precision, and animation rewards attention without demanding it.

---

### 6.1 HUD Visual Philosophy

**Decision:** Screen-space overlay, not diegetic. The HUD floats above the game world, not on the car dashboard. Rationale: (1) cockpit models have limited dashboard space, (2) the GDD defines 4 cockpit elements + 7 optional chase elements overlaying the cockpit view — diegetic placement cannot accommodate this, (3) readability at 200km/h demands consistent element positioning regardless of car model.

**7 Elements (Chase view):** Speed, position, lap, fuel bar, tire bar, rival info, PIT THIS LAP.

**4 + 7 Elements (Cockpit view, overlay ON by default per GDD):** The same 7 chase elements overlay the cockpit view. The player can disable this in Settings (Section 3 HUD GDD).

**Visual hierarchy at speed (reading order):**
1. **Speed** — largest element, center-bottom. The primary number. `#FF6B2B` accent on current value.
2. **Position** — top-left. Large numeral + ordinal suffix (1st, 2nd, 3rd…). P1 uses Champion Gold `#F5C518`.
3. **Fuel bar + Tire bar** — left and right sides. Color + shape + animation backup per Section 2 colorblind rules.
4. **Lap** — top-right. Current / Total (7/15). Secondary text size.
5. **Rival info** — bottom-right. Smallest persistent element. Name + gap.
6. **PIT THIS LAP** — Transient. Appears at `min(0.80, max(0, pitEntryProgress - 0.05))`. Fades after physical pit entry.

---

### 6.2 Typography

**Two-font system:**

| Context | Font | Weight | Size (1080p) | Usage |
|---------|------|--------|--------------|-------|
| **HUD** | **Gemunu Libre** | Bold / ExtraBold | 32–72px | Speed, position, lap count — numbers read at speed |
| **UI** | **Spline Sans** | Regular / Medium | 16–24px | Menu labels, dialogue, settings, descriptions |

**HUD typography rules:**
- Tabular figures (same-width digits) — speedometer does not jump when values change
- Numbers snap instantly; no LCD-style digit-rolling on numeric values (UX rule: intermediate digits create stale reads at speed)
- Gemunu Libre Bold at 72px for speed; 48px for position; 32px for lap/time
- White `#FFF8F0` on `#1A1A1A` at 70% opacity background. Contrast ratio 15.8:1 (WCAG AAA)
- 2px Carbon Black `#1A1A1A` outline on all text over variable backgrounds

**UI typography rules:**
- Spline Sans Regular at 18px for body text; Medium 24px for buttons; Bold 36px for titles
- Menu text: `#FFF8F0` on `#1A1A1A` (menu background)
- Secondary labels: `#B0BEC5` at 16px
- Accessibility: minimum 14px at 1080p, minimum contrast 4.5:1

---

### 6.3 Iconography

**Style:** Flat outlined, 2px minimum stroke weight at 1080p. Consistent with Principle 2 ("The line makes the art"). Icons are drawn in the same confident linework style as Fujishima's character art — simplified to essential shapes, no fills, no gradients.

**Icon set:**
- Fuel: Gas pump silhouette (outlined)
- Tire: Tire cross-section (outlined)
- Pit: Wrench crossed with tire (outlined)
- Caution: Yellow triangle with "!" (outlined)
- Position: P1–P16 numeral with ordinal suffix
- PIT THIS LAP: Pit board icon

**Colorblind backup icons (built into same style):**
- Green safe → Checkered flag icon (outlined with full fill for "all clear")
- Yellow caution → Diagonal stripe overlay (pattern inside bar)
- Red critical → Stop octagon icon + pulsing animation + text label

**Size:** 24×24px minimum at 1080p for readability. Larger at 32×32 for focal icons (fuel, tire).

---

### 6.4 Animation Feel

**Decision:** Mechanical precision with organic warmth — transitions are crisp and purposeful (1991 digital dashboard) with subtle anime-inspired warmth in reveals (fades, gentle overshoot).

**Rules:**
- **Numeric values snap instantly.** Speed, position, lap, and timer update on the exact tick — no LCD-style rolling digits. The player must never read a stale value. (UX rule)
- **Bar fills (fuel, tire) may use stepped transitions.** The bar is literally passing through values — LCD-style segments are acceptable and period-authentic.
- **Element reveal:** Fade in 0.15s with 5px upward slide. No aggressive overshoot.
- **Element hide (transient):** Fade out 0.3s with 10px downward slide. PIT THIS LAP uses this.
- **Menu transitions:** 0.2s cross-fade between screens. Team tint (20% opacity) sweeps in with 0.3s ease.
- **Countdown lights:** The five red starting lights illuminate one-by-one with 0.5s interval. Each light has a 0.1s brightness pulse on activation.
- **Pause overlay:** 0.2s vignette darken + 4px blur (Section 3, State 8).
- **Speed accent pulse:** The `#FF6B2B` accent on the speed number pulses subtly (1.5s cycle, 10% brightness oscillation) — alive but not distracting.

---

### 6.5 Menu Visual System

**Palette:** Section 2 Menu palette:
- Background: `#1A1A1A` (warm dark — garage at dusk)
- Panels: `#2A2520` (warm brown workshop wall)
- Text: `#FFF8F0`
- Accent: `#FF6B2B`
- Secondary accent: `#F5C518`
- Divider: `#424242`
- Team tint: Team primary at 20% opacity on menu background

**Team tint rule:** Team tint is atmospheric only — never carries information (Section 2 rule). Since some team colors (Minarae yellow `#F5C518`, Losel amber `#E8A830`) produce low contrast at 20% over `#1A1A1A`, this is acceptable because text and icons carry all information.

**Key screens:**
- **Title screen:** Logo centered, "Press Start" pulsing (1.0s cycle), warm garage lighting (Section 3, State 1).
- **Team selection:** 16-team grid in tier order. Primary color swatch + team name. Selected team gets orange accent border.
- **Grid Display:** Pre-race confirmation. 16-car grid in 2×8 formation (vertical list with position numbers). "Start Race" button only — no Back/Cancel (GDD AC).
- **Settings:** Dark panels, team-tinted. Tab navigation (Input, Audio, Display, Accessibility, Difficulty).
- **Results:** Podium layout. Top 3 highlighted (Gold `#F5C518`, Silver `#B0BEC5`, Bronze `#8D6E63`). Player position highlighted with orange accent.

---

### 6.6 Input Context Visual States

The game has two mutually exclusive input contexts (OverdriveGameplay and OverdriveUI), each with a distinct visual treatment so the player always knows which mode they are in.

| Context | Visual Treatment | Example Screens |
|---------|-----------------|-----------------|
| **OverdriveGameplay** (Racing, Qualifying, Countdown) | HUD overlay on game world. 70% opacity dark panels. No full-screen elements. No cursor. | In-race HUD, countdown lights |
| **OverdriveUI** (Menus, Settings, Results) | Full-screen panels. 90% opacity `#1A1A1A` background. Team tint at 20% on backgrounds. Cursor visible. | Title screen, team selection, settings, results |
| **PitService** (hybrid UI) | Race HUD persists beneath a dense service overlay (`#1A1A1A` at 90% opacity — denser than race HUD's 70%). Service overlay displays fuel progress, tire swap status, and exit prompt. Underlying race HUD remains visible but de-emphasized (lower opacity). | Pit stop overlay with fuel gauge + tire indicators |

**Rule:** The transition between contexts must be visually clear. OverdriveGameplay → OverdriveUI uses the Section 3 Pause transition (0.2s vignette + 4px blur). Pit entry → PitService uses a gradual 0.5s overlay fade to signal "you're in a service state, not racing."

---

### 6.7 Accessibility & Colorblind

- **No game state communicated by color alone** (Section 2 rule). All HUD state colors have shape/icon backup.
- **2px outline** on all text over variable backgrounds ensures readability on any track surface.
- **Minimum text size:** 14px (UI body), 32px (HUD numbers) at 1080p.
- **Minimum contrast:** 4.5:1 for UI text, 7:1 for HUD numbers against their background.
- **Colorblind mode (Settings toggle):** Replaces hue differentiation with value differentiation (Section 2: green → white, yellow → gray, red → dark red + pattern overlay).
- **Pause always accessible:** Escape/Start fixed binding works in all gameplay contexts (GDD AC).

---

### 6.8 Prohibitions

- No diegetic HUD elements (gauges on the car dashboard that become unreadable at speed)
- No animated backgrounds that compete with HUD text
- No mouse-only interactions during gameplay
- No font smaller than 14px at 1080p
- No color-only state indicators

---

## Section 7 — VFX & Particle Style

> **Status:** APPROVED 2026-07-27

### Design Rule

Overdrive's VFX serve one purpose: make speed feel joyful. Every particle, streak, and screen effect must pass the test "does this make 280km/h feel exhilarating?" If it adds anxiety, disorientation, or visual noise, it fails. The Fujishima + Matsuri linework principle extends to VFX — effects are drawn as carefully as characters, not dumped from a particle generator.

---

### 7.1 Speed Perception System (Speed Lines + Motion Blur)

**Architecture:** Two-layer speed perception combining subtle motion blur with fine drawn speed lines.

**Layer 1 — Subtle Periphery Motion Blur:**
- Screen-space post-process blur applied to the background periphery (grandstands, guardrails, trackside buildings)
- Blur amount scales with velocity: 0% at 0km/h → 15–20% at 280km/h
- Cockpit and car remain perfectly sharp — the player's visual anchor never blurs
- Golden afternoon colors blur into warm smears (amber, gold, soft brown) — never muddy or grey
- Rationale: motion blur provides organic velocity feel that matches how peripheral vision works at speed

**Layer 2 — Fine Drawn Speed Lines:**
- Screen-space overlay: thin horizontal lines that streak across the peripheral vision
- Color gradient: `#F5C518` (gold) at low speed → `#FF6B2B` (orange) at top speed — the color progression encodes acceleration
- Line density scales with velocity: sparse at 100km/h → dense streaks at 280km/h
- Line length varies: short near the track horizon, longer toward the screen edges (depth cue)
- Line thickness: 1–2px at 1080p — fine enough to not obscure the scene, visible enough to read as "manga panel"
- Opacity: 30–60% depending on speed — never opaque enough to block gameplay
- Rationale: drawn lines reinforce the Fujishima art style and signal "this is speed, not danger"

**Combined effect:** Blur softens the world (organic speed feel), speed lines overlay the blur (comic art identity). Neither dominates — together they communicate "this is an anime racing game moving at full speed."

**Phase scope:** MVP. Both layers are screen-space post-effects with no per-car particle cost.

---

### 7.2 Tire Smoke & Dust

**Trigger conditions:**
- Hard braking (brake input >0.7) → brief puff from locked tires
- Hard cornering (steer input >0.7 at speed) → trailing smoke from scrubbing tires
- Off-track (gravel, grass, runoff) → persistent dust cloud

**Visual properties:**
- Color: `#B8C4D4` (cool white with 1991 blue-ish cast) — period-correct F1 tire smoke, warmed slightly to stay in palette
- Density: light puff on braking (4-6 particles), moderate on cornering (8-12 particles), heavy on off-track (12-20 particles)
- Dissipation: 0.5s puff → 1.5s fade. Off-track dust lingers longer (2.5s)
- 
- **Shape:** Soft round particles with 2px drawn outline at core (Principle 2 faint echo)

**Phase scope:** MVP. Particle counts per event kept low for 16-car budget.

---

### 7.3 Sparks (Contact VFX)

**Design choice:** Firework-style sparks. Sparks are celebration, not damage feedback (Principle 1).

**Trigger conditions:**
- Kerb contact (riding kerbs) → mild spark burst
- Hard kerb contact (cutting a kerb at speed) → moderate burst
- Car-to-car contact → moderate burst from both cars
- Minor wall contact → brief burst
- Major collision → no spark burst (collision handles as impact shake, not VFX)

**Visual properties:**
- Color: `#F5C518` (bright gold) core → `#FFF8F0` (warm white) tips — reads as "sparkle" not "grinding metal"
- Burst shape: radial explosion, 8–12 rays, each ray 8–16px length in 0.3s
- Duration: 0.3s burst → 0.7s trailing fade
- Density: 2–4 particles (mild) / 6–10 particles (moderate)
- No sustained spark stream — the effect fires and fades, leaving no lingering trace

**Why firework over grinding:**
- Grinding sparks are directional and sustained — they read as "something is being damaged"
- Firework sparks are brief and radial — they read as "that looked cool"
- Consistent with "speed is joy, not danger"

**Phase scope:** MVP.

---

### 7.4 Exhaust & Engine VFX

**Heat haze (shimmer):**
- Shader effect on exhaust area: subtle air distortion shimmer
- Intensity scales with RPM: idle (barely visible) → high RPM (moderate shimmer)
- Applies only to the exhaust pipe opening, not the rear wing or diffuser

**Exhaust flame:**
- Normally aspirated (NA) engines (V12, V10, V8): no visible exhaust flame during normal operation. Period-correct for 1991 F1 NA engines — heat haze only
- Downshift/backfire pop: brief (0.1s) blue flame `#4FC3F7` from exhaust on aggressive downshift. One pop per event — not a sustained effect
- Rationale: period-authentic 1991 F1 engines did not produce visible exhaust flame. The backfire pop is a reward for aggressive downshifting, not a constant effect

**Exhaust placement:**
- Rear center (period 1991 F1 layout). Single exhaust pipe visible from chase and cockpit mirror views.
- Particle emission point aligned with pipe geometry

**Phase scope:** MVP.

---

### 7.5 Camera Shake

**Design choice:** Minimal, rhythmic, purposeful. Shake is a metronome, not an earthquake.

**Shake types:**

| Trigger | Shake | Duration | Notes |
|---------|-------|----------|-------|
| Engine vibration | 1px sinusoidal at 60Hz | Continuous | Barely perceptible — adds "alive" feel. Only in cockpit view |
| Gear shift | 3px vertical jerk | 0.1s | Sharp but brief. Rewards manual shifting |
| Kerb contact | 2–4px single-axis | 0.15s | Direction depends on which side contacts kerb |
| Car contact | 3px mixed-axis | 0.2s | Brief collision punctuation |
| Sustained off-track | None | — | off-track is a driving error, not a sensory experience |
| Major collision | None via shake | — | Handled by physics, not camera (Principle 1) |

**Phase scope:** MVP.

---

### 7.6 Start / Finish Line & Podium VFX

**Start lights:**
- Five red LED-style lights, illuminated horizontally on the starting gantry
- Each light illuminates with 0.5s interval
- Each light has a 0.1s brightness pulse (brief overshoot then settle) on activation
- All lights go green (`#2D8C3C`) simultaneously on GO — the green is the same green as the Section 2 HUD safe state
- 3D light object modeled as part of the starting gantry (Section 5 trackside architecture)

**Finish line:**
- Checkered pattern on track surface (painted texture, not VFX)
- Checkered flag icon in HUD position area at crossing (Section 6 flat outlined icon style)

**Podium confetti:**
- Gold `#F5C518` and warm white `#FFF8E1` rectangles (3×5mm), not circles
- Rectangles are flat outlined like Section 6 UI icons — consistent with Principle 2
- 50 rectangles per burst, 3 bursts (on P1/P2/P3 reveal, on trophy presentation)
- 1.5s float down after each burst

**Phase scope:** MVP.

---

### 7.7 Future Weather & Particle Architecture

**MVP scope:** No rain, no night. Section 6 (no weather planned). This architecture exists so the system does not need to be rewritten.

**Architecture:** Unity VFX Graph with modular emitter modules.

- Core system: one VFX Graph asset per car, with disabled-by-default modules for rain, dust, snow, night
- Each module is a self-contained subgraph: inputs are "active: bool" + "intensity: float"
- Adding a new condition (rain, dust storm, night glow) means: create new module subgraph → add to car VFX Graph → toggle on in gameplay code
- No existing modules are modified or rebuilt — swap in, not rewrite

**Specific future modules (designed but not built):**
- Rain module: tire spray, windshield droplets, surface wetness reflection
- Dust module: off-track dust enhancement for arid tracks
- Night module: exhaust flame glow, brake-disc glow, headlight volume

**Phase scope:** Alpha architecture planning. Not built in MVP.

---

### 7.8 Performance Budget

**Target:** All VFX systems combined must consume ≤ 1ms per frame at 60 FPS with 16 cars visible.

| System | Budget per frame | Notes |
|--------|-----------------|-------|
| Speed lines (screen-space) | ≤ 0.1ms | Cheap full-screen overlay — no per-particle cost |
| Motion blur (screen-space) | ≤ 0.3ms | Post-process blur, gaussian samples |
| Tire smoke particles | ≤ 0.2ms | Max 20 particles per car, pooled |
| Sparks | ≤ 0.1ms | Brief bursts, pooled |
| Exhaust heat haze | ≤ 0.1ms | Local shader effect on exhaust geometry |
| Camera shake | ≤ 0.05ms | Transform offset only, no render cost |
| Start lights + confetti | ≤ 0.15ms | Spawned once per race, not per car |
| **Total** | **≤ 1.0ms** | Headroom for expansion |

**Pooling strategy:** All particle effects use object pooling — no instantiation during gameplay. Pool sizes calculated for worst case (16 cars simultaneously triggering effects).

**Optimization priority order:** speed lines → motion blur → tire smoke → sparks → start lights → exhaust → confetti. If budget exceeded, trim from the right.

**Phase scope:** MVP.

---

## Section 8 — Asset Standards

> **Status:** APPROVED 2026-07-27

### Design Rule

Every asset in Overdrive exists to make the car feel fast and the world feel hand-crafted. Asset standards are the invisible guardrails that keep polygon counts, texture memory, and draw calls within budget — so the player never sees a frame drop, only golden-hour speed. All 16 cars are equal: every car can be the player's car or a rival, carrying the same LOD0 quality and the same texture resolution.

**WebGL reference:** Based on Unity 6 WebGL documentation (6000.3) — WASM heap up to 4GB, ASTC texture compression via WEBGL_compressed_texture_astc extension, GPU instancing universal since 2021. WebGPU available in ~95% of browsers (2026). Budgets below are conservative for widest device support and will be validated through benchmark.

---

### 8.1 Polygon Budgets

#### Car Budgets (Same for all 16 cars)

| LOD Level | Distance | Target Tris | Includes | Notes |
|-----------|----------|-------------|----------|-------|
| **LOD 0** | 0–30m (cockpit, close chase) | 25,000–50,000 | Full car body, cockpit interior, driver helmet + hands, steering wheel, mirrors, antenna, rear wing detail | The hero asset at any distance. Every car is potentially the player's car. |
| **LOD 1** | 30–80m (mid-distance chase, nearby rivals) | 10,000–15,000 | Simplified body, cockpit opening (no interior), driver helmet silhouette | Team identity still fully readable. Helmet color + stripe visible. |
| **LOD 2** | 80–150m (distant pack, mirrors) | 3,000–5,000 | Body silhouette, wing simplified, wheels as cylinders | Color + shape = team identity. No driver visible. |
| **LOD 3** | 150m+ (background, rearview mirror distant) | 800–1,500 | Billboard or extreme simplified | Flat card with team color + helmet color. |

**Note on 25k–50k budget:** The asset-store F1 car at 103k LOD0 can be used but requires decimation to ~40k tris (acceptable for arcade fidelity). At this budget, the car holds up in cockpit view while keeping 16-car total manageable: worst-case 16 × 50k = 800k tris, real-case ~300k (LOD distribution).

#### Environment Budgets

| Asset Category | Target Tris | Notes |
|----------------|-------------|-------|
| Track surface (per km) | 30,000–50,000 | Tiled mesh sections |
| Track environment (per km) | 40,000–70,000 | Barriers, grass, gravel, fencing |
| Pit building (full) | 6,000–10,000 | 16 garage openings + pit wall |
| Grandstand (per section) | 3,000–6,000 | Crowd is billboard (see below) |
| Timing tower | 2,000–4,000 | Texture-driven detail |
| Marshal post | 500–1,000 | |
| Bollard / cone | 100–300 each | GPU instancing |
| Tire wall (per stack) | 200–500 | |

#### Spectator Strategy

| Distance | Representation | Tris Cost |
|----------|---------------|-----------|
| 0–30m | Simplified 3D crowd blocks | 5k–10k per section |
| 30–100m | Billboard sprites with painted texture | 200–500 per section |
| 100m+ | Single flat plane | 2 tris per section |

---

### 8.2 LOD Strategy

| LOD Transition | Distance | Crossfade |
|---------------|----------|-----------|
| LOD 0 → LOD 1 | 30m | 10% crossfade |
| LOD 1 → LOD 2 | 80m | 10% crossfade |
| LOD 2 → LOD 3 | 150m | Dither crossfade |
| LOD 3 → Cull | 300m | Instant cut |

**Car LOD override:** The car the player is currently driving forces LOD 0 in cockpit view (LOD group disabled for that camera). All other cars use normal LOD transitions.

---

### 8.3 Texture Standards

**All 16 cars use identical resolution.** No distinction between player car and rival.

#### Resolution Limits

| Asset Type | Max Resolution | Notes |
|------------|---------------|-------|
| **Car body (all 16)** | 2048×2048 | Single texture atlas per team. All cars equal. |
| **Car helmet** | 512×512 | |
| **Track surface** | 512×512 tiling | |
| **Environment** | 256×256 tiling | |
| **Buildings** | 512×512 | Unique per type |
| **Skybox** | 1024×1024 | Painted gradient |
| **UI sprite atlas** | 2048×2048 | |
| **VFX particles** | 256×256 | Sprite sheets |

#### Texture Formats

| Asset Type | Format (Priority) | Notes |
|------------|------------------|-------|
| **Car body** | ASTC 6×6 (fallback: ETC2, DXT5) | WEBGL_compressed_texture_astc available on most modern browsers. Unity builds can deliver separate compressed bundles. |
| **Environment** | ASTC 6×6 / ETC2 | |
| **UI sprites** | ASTC 6×6 (uncompressed RGBA32 if artifacts visible) | |
| **Skybox** | ASTC 6×6 | |
| **VFX** | ASTC 8×8 | |

**ASTC support (2026):** `<canvas>` context can query `WEBGL_compressed_texture_astc` extension. Unity documentation shows how to deliver two builds (DXT for desktop, ASTC for mobile) and select at load time via JavaScript in the WebGL template.

**Compressed texture fallback path:** If no GPU compression format is supported, Unity falls back to software decompression at runtime. The application still works but uses more memory.

**No normal maps:** Per Section 5. Painted textures only.

---

### 8.4 File Format & Pipeline

**Source → Export → Import chain:**

1. **Model source:** Blender `.blend`
2. **Export:** FBX with settings:
   - Forward: `-Z Forward`
   - Up: `Y Up`
   - Scale: 1.0 (apply transforms before export)
   - Smoothing: `Face` (edge sharpness exported)
   - Modifiers applied before export
3. **Texture source:** Krita `.kra` or Aseprite `.ase` (UI)
4. **Interchange format:** PNG (not direct .kra/.psd import)
5. **Unity import:** PNG → Unity auto-compresses to ASTC/ETC2

**Normal map convention:** NOT USED in MVP. If added later, use OpenGL (Y+ tangent space), Linear color space.

#### Naming Convention

```
[category]_[name]_[variant]_[lod].[ext]
```

| Prefix | Example |
|--------|--------|
| `car_` | `car_tier1a_body_lod0.fbx`, `car_tier1a_body_2048.png` |
| `env_` | `env_monaco_barrier_lod0.fbx`, `env_asphalt_tiling_512.png` |
| `bld_` | `bld_pitbuilding_16garage.fbx` |
| `chr_` | `chr_driver_zeroforce_lod0.fbx` |
| `ui_` | `ui_hud_icons_2048.png` |
| `vfx_` | `vfx_tiresmoke_sheet_256.png` |
| `sky_` | `sky_monaco_1024.png` |

#### Folder Structure

```
Assets/Art/
  Cars/
    Models/tier1a/car_tier1a_body_lod0.fbx
    Textures/tier1a/car_tier1a_body_2048.png
    Materials/tier1a/car_tier1a_body.mat
  Environment/
    TrackSurface/Textures/
    Barriers/Models/ + Textures/
    Buildings/Models/ + Textures/
    Props/Models/ + Textures/
    Tracks/monaco/, /silverstone/, /spa/, /monza/
  Characters/Models/ + Textures/
  Skybox/
Assets/UI/Sprites/ + Fonts/
Assets/VFX/Particles/Textures/ + Materials/
Assets/Audio/Cars/ + SFX/
Assets/Shaders/
```

---

### 8.5 Material & Shader Standards

| Asset | Shader | Notes |
|-------|--------|-------|
| **Car paint** | URP Simple Lit (specular enabled) | Shiny car paint under golden-hour sun. Specular + diffuse. No PBR metallic. |
| **Car carbon** | URP Simple Lit | Matte, low specular |
| **Cockpit interior** | URP Simple Lit | Flat painted look |
| **Helmet** | URP Simple Lit | Glossy shell |
| **Tire** | URP Simple Lit | Near-black, no specular |
| **Environment** | URP Simple Lit | Asphalt, barriers, buildings |
| **Grass / sky** | Unlit | Painted colors, no lighting response |
| **Crowd sprites** | Unlit | Billboard |
| **UI** | URP Unlit | Screen-space overlay |

**Car materials per team:** CarPaint, Carbon, Cockpit, Tire, Helmet, Mirror, Exhaust.

**Texel density target:** 8–12 texels/m (car body), 3–5 texels/m (track), 2–4 texels/m (buildings).

---

### 8.6 Optimization Rules

**Draw call budget:** ≤ 150 per frame (WebGL 2.0 with instancing), ≤ 100 (WebGL 1.0 legacy).

**Batching strategy:**
- **Static batching:** track sections, buildings (static geometry merged)
- **GPU instancing:** cars, props (bollards, cones, barriers), crowd sprites
- **Sprite atlas:** single atlas for all UI elements

**Particle pooling:** ~650 objects pre-allocated. Zero Instantiate/Destroy during gameplay.

---

### 8.7 Addressables Group Strategy

| Group | Contents | Lifecycle |
|-------|----------|-----------|
| **Shared** | UI, fonts, shaders, loading screen | App startup, never unload |
| **Cars/{teamId}** | Car prefab + LODs + textures + materials + audio | Race load → race end |
| **Tracks/{trackId}** | Track mesh + environment + skybox + lighting | Race load → race end |

**Per-car bundle estimate:** ~7–12 MB (2048×2048 texture + LOD meshes + materials + engine audio).

**Per-track bundle estimate:** ~50–100 MB (full track with geometry + textures + skybox + lighting).

**WebGL split:** If any track bundle exceeds 50 MB, split into sub-bundles (mesh vs textures).

---

### 8.8 Performance Reference

| Metric | Target | Notes |
|--------|--------|-------|
| Frame time | ≤ 16.67ms (60 FPS) | |
| Simulation tick | ≤ 6ms (p95), ≤ 8ms (max) | ADR-0001 |
| Total tris on screen | ≤ 800k (PC/WebGL), ≤ 500k (mobile WebGL) | Conservative |
| Draw calls | ≤ 150 (WebGL 2.0) | With GPU instancing |
| Texture memory (all cars) | ~80 MB (16 × 2048² textures, ASTC compressed) | 2048×2048 ASTC 6×6 ≈ 5MB each |
| Texture memory (total) | ≤ 400 MB | WebGL with 4GB heap headroom |
| VFX budget | ≤ 1ms per frame | Section 7 |
| Particle pool | ~650 pre-allocated | |
| WASM heap | ≤ 2048 MB (Unity WebGL max: 4096 MB) | Conservative setting for widest device support |

---

### 8.9 Prohibitions

- No per-car texture quality tiers (all cars equal)
- No normal maps on painted surfaces
- No specular maps (Simple Lit shader handles specular procedurally)
- No runtime Instantiate/Destroy for VFX (pool only)
- No PBR metallic workflow (painted aesthetic)

---

## Section 9 — Style Prohibitions

> **Status:** APPROVED 2026-07-27

This section consolidates prohibitions established across the preceding eight sections. Treat these as hard gates — assets or code that violate any rule below must be flagged during review.

---

### 9.1 Visual Style Violations

- **No grinding sparks.** Impact effects are firework-style only. Sparks imply danger; the game's tone is joyful speed. (Section 7)
- **No full-screen blur or opaque speed lines.** Speed is conveyed through subtle motion blur and thin translucent streaks — never a visual obstruction. (Section 7)
- **No sustained camera shake.** Momentary micro-shake is permitted for hits; anything longer breaks the controlled cinematic feel. (Section 7)
- **No exhaust flames on normally aspirated engines.** Flame effects reserved for forced-induction vehicles only. (Section 7)
- **No PBR metallic workflows.** Materials use the project's stylized Simple Lit shading. Metallic/roughness/specular maps are prohibited. (Section 5, Section 8)

---

### 9.2 Environmental Violations

- **No night scenes.** The golden-afternoon baseline is the sole lighting condition. (Section 3)
- **No rain or wet-surface effects.** Weather is clear skies only. (Section 3)
- **No normal-mapped surfaces on environments.** Painted albedo textures only. (Section 5)
- **No real-world branding or advertising.** All signage uses original fictional marks. (Section 5)
- **No Standard Lit shader on environments.** Simple Lit exclusively. (Section 5)

---

### 9.3 Character Violations

- **No gendered outfit stereotyping.** Female drivers wear fitted racing suits identical in coverage and function to male drivers. No gratuitous skin exposure. (Section 4)
- **No casual physical contact between characters.** Touching limited to celebration contexts (fist bumps, high fives). (Section 4)
- **No body-type-dependent art style.** All drivers — regardless of body type — rendered with the same proportional language and detail level. (Section 4)

---

### 9.4 UI / UX Violations

- **No diegetic HUD elements.** Speed, fuel, tires exist in screen space, not projected into the 3D world. (Section 6)
- **No animated backgrounds behind readable text.** Motion in UI restricted to transitions and indicators. (Section 6)
- **No mouse-only input during gameplay.** Every gameplay action has a gamepad equivalent. (Section 6)
- **No text below 14px at 1080p.** No exceptions for decorative labels. (Section 6)
- **No color-only state indicators.** Every color-coded state backed by icon, pattern, or animation. (Section 2, Section 6)

---

### 9.5 Technical Violations

- **No per-car quality tiers.** Every vehicle receives identical texture resolution, polygon budget, and material complexity. No "hero car" shortcuts. (Section 8)
- **No runtime `Instantiate` or `Destroy` for VFX.** Particle effects use pooling or pre-allocated systems. (Section 7, Section 8)
- **No normal maps on any asset class.** This rule applies project-wide, not just to environments. (Section 5, Section 8)

Overdrive's visual identity actively excludes:

- Generic modern anime (no glossy gacha-game rendering, no standard booru-style faces)
- Realistic/simulator (no photogrammetry, no PBR obsession, no tire degradation simulation as visual feature)
- Dark/gritty (no Attack on Titan shadows, no cyberpunk neon, no dystopian weather)
- Vintage/retro pastiche (not literally 70s cel-animation, not pixel art, not CRT filter fetishism)
- AI-generic (the Fujishima reference ensures game-readable proportions, the Matsuri reference ensures hand-crafted line quality — these are the guardrails against uniformity)

---

*Document created 2026-07-27. Art bible status: 9/9 sections complete.
