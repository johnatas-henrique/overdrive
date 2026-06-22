# ADR-0018: HUD Layout & Blocks

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                               |
| **Domain**                | Presentation — HUD / GUI                                                                        |
| **Knowledge Risk**        | MEDIUM — Babylon.js GUI (AdvancedDynamicTexture, Grid, control lifecycle)                       |
| **References Consulted**  | hud.md GDD, babylonjs-gui specialist review, Babylon.js GUI reference docs, art bible Section 7 |
| **Post-Cutoff APIs Used** | None                                                                                            |

## ADR Dependencies

| Field          | Value                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Depends On** | ADR-0001 (Event Bus — all HUD input), ADR-0006 (Input — confirm action for pit exit), ADR-0015 (Race Management — race state events) |
| **Enables**    | Player speed display, lap tracking, position awareness, resource management, pit UI                                                  |
| **Blocks**     | None                                                                                                                                 |

## Context

### Problem Statement

The HUD must display real-time race information (speed, position, lap, fuel, tire, minimap, pit status, race overlays) in a readable, responsive layout. The system must be:

- **Consumer-only**: reads state via events, never writes to gameplay state
- **Modular**: blocks independent and rearrangeable without code changes
- **Responsive**: works across viewport sizes (16:9 desktop, ultrawide, future Tauri/Electron)
- **Animatable**: mechanical transitions per art bible, but configurable for playtesting feedback
- **Testable without a GPU**: Babylon.js GUI controls can be tested in headless mode

### Constraints

- Babylon.js GUI (AdvancedDynamicTexture) for all rendering — no HTML/CSS overlay
- Event-driven — blocks react to Event Bus events, not polling
- Single ADT — no separate render targets for HUD layers
- All controls created at init, visibility toggled — no runtime create/destroy
- Art bible Section 7 defines visual style (colors, fonts, sizes, animation rules)

## Decision

### Architecture

```
HudManager (creates all blocks at init, manages subscriptions)
  ├── AdvancedDynamicTexture (idealHeight=1080, useSmallestIdeal=false)
  │     └── Grid (3 proportional columns)
  │           ├── Left Zone (0.20)    → MinimapBlock
  │           ├── Center Zone (0.58)  → StackPanel[ SpeedBlock, LapBlock, PositionBlock ]
  │           └── Right Zone (0.22)   → StackPanel[ ResourcesBlock ]
  │
  ├── Overlays (same ADT, top-level children)
  │     ├── CountdownBlock      → 5 red lights → GREEN
  │     ├── PitOverlayBlock     → replaces zone contents when pit active
  │     ├── DNFOverlay          → screen darkens, "DNF" text
  │     └── CheckeredOverlay    → animated checkered + top 3 + player
  │
  └── HudAnimator (shared animation utility)
        └── per-block configurable HudAnimStyle
```

### Key Interfaces

```typescript
// ── Block Interface ──

interface HudBlock {
  id: string;
  container: Container; // Babylon.js GUI Container — created in constructor
  onActivate(ctx: HudContext): void; // container.isVisible = true, subscribe events
  onDeactivate(ctx: HudContext): void; // container.isVisible = false, unsubscribe
  dispose(): void; // control.dispose()
}

// ── Context (dependency injection) ──

interface HudContext {
  adt: AdvancedDynamicTexture;
  playerCar: CarEntity; // non-null during race — SpeedBlock reads speedKmh
  eventBus: EventBus;
  hudAnimator: HudAnimator;
  config: HudConfig;
}

// ── Layout (Babylon.js-compatible Grid — proportional fractions, no star sizing) ──

interface HudZoneConfig {
  id: string; // 'left' | 'center' | 'right'
  widthFraction: number; // 0.0–1.0. ALL zone fractions MUST sum to 1.0.
  blocks: string[];
  padding: { x: number; y: number };
}

interface HudBlockConfig {
  id: string;
  visible: boolean; // default: true
  size: {
    width: number; // percentage of zone width (0.0–1.0)
    height: number; // percentage of zone height (0.0–1.0)
  };
  animStyle?: HudAnimStyle; // per-block override of art bible default
}

interface HudConfig {
  zones: HudZoneConfig[]; // ordered left→right, widthFraction sums to 1.0
  blocks: HudBlockConfig[]; // matched by id
  animSpeed: number; // animation duration multiplier (1.0 default)
  resourcesUpdateInterval: number; // ticks between resource bar refreshes (default: 10)
}

// ── Animation ──

enum HudAnimStyle {
  MECHANICAL = "mechanical", // 0.1s tick, discrete steps (flip/cut)
  SMOOTH = "smooth", // 0.3s ease-out (future)
  CUT = "cut", // instant, no animation
}

interface HudAnimationDef {
  target: Control;
  property: "scaleX" | "scaleY" | "alpha" | "rotation";
  from: number;
  to: number;
  style: HudAnimStyle;
  duration: number; // ms, multiplied by config.animSpeed
}

// ── Manager API ──

interface IHud {
  init(config: HudConfig): void; // called on GSM → Racing
  tick(dt: number): void; // drives HudAnimator.update()
  onPitEnter(): void; // pit overlay shown, race blocks hidden
  onPitExit(): void; // race blocks restored
  showOverlay(type: OverlayType): void; // countdown, DNF, checkered
  deactivate(): void; // on GSM → PostRace
}
```

### Grid Layout (Babylon.js Compatible)

Babylon.js Grid does NOT support `ParameterType.Star`. The GDD's `{ value: 1, unit: "star" }` pattern **does not exist** in the API. All columns are proportional fractions that sum to 1.0:

```typescript
// Grid initialization
const grid = new Grid("hudGrid");
grid.width = "100%";
grid.height = "100%";
grid.addColumnDefinition(0.2); // left zone   — 20%
grid.addColumnDefinition(0.58); // center zone — 58% (100 − 20 − 22)
grid.addColumnDefinition(0.22); // right zone  — 22%

// Validation: sum must be 1.0 ± 0.001
function validateZoneLayout(zones: HudZoneConfig[]): void {
  const sum = zones.reduce((s, z) => s + z.widthFraction, 0);
  if (Math.abs(sum - 1.0) > 0.001) {
    throw new ConfigError(`Zone widths sum to ${sum}, must be 1.0`);
  }
}
```

The center zone's `widthFraction: 0.58` maps directly to 58/100 proportional space. This is not "fill remaining" in a dynamic sense — it's a fixed proportion of the total grid. If future modes need dynamic width adjustment, the config is recalculated and Grid columns are rebuilt (rare operation — once per race).

### idealHeight vs idealWidth

The ADT uses `idealHeight = 1080` (not `idealWidth = 1920`). This is the standard Babylon.js HUD pattern:

```typescript
const adt = AdvancedDynamicTexture.CreateFullscreenUI("hud", true);
adt.idealHeight = 1080; // not idealWidth
adt.useSmallestIdeal = false; // optional — guarantees no clipping at expense of small elements
```

For 16:9 viewports, both `idealHeight` and `idealWidth` are equivalent. `idealHeight` is chosen because it's the documented Babylon.js HUD pattern and adapts correctly to non-16:9 aspect ratios (ultrawide, portrait). The percentage-based side zones (20%, 22%) adapt automatically to the actual aspect ratio.

### Control Lifecycle: Create-Once, Toggle Visibility

All blocks create their GUI controls in the constructor and never create or destroy controls at runtime. Activation/deactivation toggles `isVisible`:

```typescript
class HudBlock implements HudBlock {
  readonly container: Container;

  onActivate(ctx: HudContext): void {
    this.container.isVisible = true;
    this.subscriptions.push(ctx.eventBus.on("some.event", this.handleEvent));
  }

  onDeactivate(): void {
    this.container.isVisible = false;
    this.subscriptions.forEach((unsub) => unsub());
    this.subscriptions = [];
  }
}
```

Rationale:

- `addControl` triggers layout recompute (measure + arrange) — unnecessary overhead for infrequent state transitions
- Creating Container + children per activation allocates objects, then GC collects them on deactivation — wasteful for controls that will be re-shown
- For 8 blocks × ~5 controls each = ~40 controls, memory is negligible (< 100KB)
- Pit overlay toggles happen ~3–5 times per race — far too infrequent to justify lazy creation

### Event Subscription Management

Subscriptions are managed at block level for modularity. Each block stores unsubscribe handles and calls them on deactivation:

```typescript
private subscriptions: (() => void)[] = [];

subscribe<T>(event: string, handler: (payload: T) => void): void {
  this.subscriptions.push(this.ctx.eventBus.on(event, handler));
}
```

Total: ~12 subscriptions across 9 blocks — negligible for any event system.

### SpeedBlock: Event Bus (Throttled)

SpeedBlock uses Event Bus with a 20hz throttle (every 3 ticks at 60fps), consistent with other resource bars (6hz). Physics emits `speed.changed: { carId, speedKmh }` at a throttle-controlled rate, not every frame.

**Why not every frame (60 events/s):** The Event Bus is synchronous and 60 function calls × <1µs = negligible. The concern is architectural consistency — every other HUD block uses Event Bus at throttled rates. Making SpeedBlock the sole direct-read exception creates a special case that complicates testing and the HudContext contract.

**Why direct read (option A) is rejected:** The user and architect agreed to start with Option B (throttled event). If 20hz proves insufficient (jittery display), the fallback path is:

1. Increase throttle to every tick (60hz — still Event Bus)
2. If Event Bus overhead is measurable (unlikely), switch to direct read via HudContext.playerCar

The `HudContext.playerCar` reference is still passed for other blocks that may need direct property reads.

### Animation: HudAnimator

Animations are driven by a shared `HudAnimator` utility, not per-block inline code. This makes switching animation styles a one-line config change:

```typescript
class HudAnimator {
  private tweens: Map<string, TweenState> = new Map();

  play(anim: HudAnimationDef): void {
    if (anim.style === HudAnimStyle.CUT) {
      anim.target[anim.property] = anim.to; // snap
      return;
    }
    this.tweens.set(`${anim.target.name}.${anim.property}`, {
      start: Date.now(), // tick count for determinism
      target: anim.target,
      property: anim.property,
      from: anim.from,
      to: anim.to,
      style: anim.style,
      duration: anim.duration * this.animSpeed,
      elapsedTicks: 0,
    });
  }

  update(): void {
    this.tweens.forEach((t, key) => {
      t.elapsedTicks++;
      const progress = Math.min(t.elapsedTicks / (t.duration / (1000 / 60)), 1);
      if (t.style === HudAnimStyle.MECHANICAL) {
        // Discrete step at end of duration
        if (progress >= 1) {
          t.target[t.property] = t.to;
          this.tweens.delete(key);
        }
      } else if (t.style === HudAnimStyle.SMOOTH) {
        t.target[t.property] =
          t.from + (t.to - t.from) * easeOutCubic(progress);
        if (progress >= 1) {
          this.tweens.delete(key);
        }
      }
    });
  }
}
```

Per-block config: `blockConfig.animStyle` overrides the art bible default. Playtesting feedback that changes the desired animation style for a block is a one-line HudConfig change, not code refactoring.

### Pit Overlay: Single ADT, Toggle Visibility Groups

The pit overlay does NOT use a separate AdvancedDynamicTexture. All pit controls are created at init alongside race controls, inside the same zone containers. Toggling is by visibility group:

```
Normal state:
  ├── Left Zone    → MinimapBlock (visible)
  ├── Center Zone  → SpeedBlock | LapBlock | PositionBlock (visible)
  └── Right Zone   → ResourcesBlock (visible)

Pit state:
  ├── Left Zone    → (empty/hidden)
  ├── Center Zone  → PitRefuelBar | PitTireIcons | PitExitPrompt (visible)
  └── Right Zone   → (empty/hidden)
```

Block IDs: each pit control is a distinct block in the same zone container. When `onPitEnter()` fires, race blocks are hidden and pit blocks are shown.

Rationale for a single ADT:

- Two ADTs means two full-screen render targets → 2× GPU memory and compositing
- Babylon.js GUI handles visibility toggling efficiently (dirty rect optimization)
- Pit overlay shares the same ADT reference, same scaling, same idealHeight
- Zero layout recompute — controls exist in their Grid cells from init

### Minimap: Pure GUI (Phase 1)

The minimap uses standard Babylon.js GUI controls:

- Dark background: `Rectangle` with `rgba(0,0,0,0.5)`
- Track outline: `Line` controls (thin white strokes, static after creation)
- Car dots: `Ellipse` controls with team colors, positioned via `left`/`top`

Position dot updates on `position.changed` (not every frame). Setting `left`/`top` on ~8 controls is cheap — only dirty rects are re-rendered.

**Phase 2 path (rotation with car heading, zoom):** If profiling shows >1ms per frame for minimap:

1. Container-level rotation (`container.rotation = heading`) handles rotation cheaply
2. Scale (`container.scaleX = container.scaleY = zoomLevel`) for zoom
3. If still slow: migrate to `DynamicTexture` (2D canvas) for full procedural rendering

### States and Transitions

```typescript
// State: Inactive (Menu, Loading, PreRace) | Active (race) | PitOverlay | DNF | Checkered
// Transitions:
//   Inactive → Active          (GSM → Racing, GreenFlag)
//   Active ←→ PitOverlay       (pit.status active/idle)
//   Active → DNF               (car.dnf, player)
//   Active → Checkered         (race.checkered)
//   Any → Inactive             (GSM → PostRace)
//   Active → Paused            (GSM → Paused) — pause overlay on top of Active controls
```

### Countdown Lights

CountdownBlock subscribes to:

- `race.starting` → show 5 red lights
- `race.light.countdown({ lightsOn })` → turn off one light per event
- `race.green.flag` → remove block (or hide)

The countdown is a row of 5 `Ellipse` controls (red). Each `lightsOn` event sets the Nth ellipse invisible. When 0 → GreenFlag, all controls hidden.

### Default HudConfig

```typescript
const defaultHudConfig: HudConfig = {
  zones: [
    {
      id: "left",
      widthFraction: 0.2,
      blocks: ["minimap"],
      padding: { x: 0.015, y: 0.015 },
    },
    {
      id: "center",
      widthFraction: 0.58,
      blocks: ["speed", "lap", "position"],
      padding: { x: 0, y: 0.01 },
    },
    {
      id: "right",
      widthFraction: 0.22,
      blocks: ["resources"],
      padding: { x: 0.015, y: 0.015 },
    },
  ],
  blocks: [
    {
      id: "minimap",
      visible: true,
      size: { width: 0.95, height: 0.95 },
      animStyle: HudAnimStyle.MECHANICAL,
    },
    {
      id: "speed",
      visible: true,
      size: { width: 1.0, height: 0.35 },
      animStyle: HudAnimStyle.MECHANICAL,
    },
    {
      id: "lap",
      visible: true,
      size: { width: 1.0, height: 0.25 },
      animStyle: HudAnimStyle.MECHANICAL,
    },
    {
      id: "position",
      visible: true,
      size: { width: 1.0, height: 0.25 },
      animStyle: HudAnimStyle.MECHANICAL,
    },
    {
      id: "resources",
      visible: true,
      size: { width: 0.95, height: 0.95 },
      animStyle: HudAnimStyle.MECHANICAL,
    },
  ],
  animSpeed: 1.0,
  resourcesUpdateInterval: 10,
};
```

Config-driven via Data & Config Manager under `hud.*` namespace. HMR applies zone widths, block visibility, and block sizes live.

## Alternatives Considered

| Concern           | Alternative                            | Why Rejected                                                                                                                          |
| ----------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Speed update      | Direct read per frame (Option A)       | Inconsistent with event-driven architecture. Option B chosen (20hz throttle via Event Bus) — playtesting can escalate to A if needed. |
| Grid layout       | `ParameterType.Star` for center zone   | Does not exist in Babylon.js API. Use proportional fractions summing to 1.0.                                                          |
| ADT scaling       | `idealWidth = 1920`                    | Standard Babylon.js HUD pattern is `idealHeight = 1080`. Both equivalent on 16:9.                                                     |
| Control lifecycle | Create/destroy on activation           | GC pressure, layout recompute. Create-once + toggle visibility is cheaper.                                                            |
| Animation         | Per-block inline                       | Changing style requires code edit per block. HudAnimator with configurable enum is one-line change.                                   |
| Pit overlay       | Separate ADT                           | 2× render targets, compositing overhead. Single ADT with visibility groups is sufficient.                                             |
| Minimap           | DynamicTexture (Canvas2D) from day one | Premature — pure GUI handles Phase 1. Document migration path if needed.                                                              |
| Subscriptions     | Per-block lifecycle                    | Works fine (12 subscriptions). HUD-level subscription routing is alternative if per-block lifecycle proves bug-prone.                 |

## Consequences

### Positive

- Consistent event-driven architecture — no special-case direct reads
- Modular blocks are independently testable, rearrangeable, and addable without system changes
- Animation style is a config value, not a code change — playtesting feedback is cheap
- Single ADT avoids GPU compositing overhead
- Controls created once means zero runtime allocation for HUD elements
- Grid with proportional fractions is simple, validated, and Babylon.js-compatible
- `idealHeight = 1080` follows the documented Babylon.js HUD pattern

### Negative

- Speed at 20hz throttle may appear slightly less smooth than 60fps — acceptable for a numeric display
- All controls always exist in memory (~40 controls, < 100KB) — negligible
- Grid columns are fixed proportions, not dynamic "fill remaining" — fine for 3-zone layout that never changes during a race

### Risks

- **Risk**: SpeedBlock at 20hz appears jittery during rapid acceleration/deceleration
  **Mitigation**: Increase throttle to every tick (60hz) → if still unsatisfactory, switch to direct read via HudContext.playerCar (Option A fallback)
- **Risk**: Minimap with complex track polyline (100+ segments) impacts frame rate
  **Mitigation**: Profile Phase 1. If >1ms, minimize Line control count or migrate to DynamicTexture
- **Risk**: Pit overlay toggle causes visible flash
  **Mitigation**: Pre-set all controls to correct state before making any visible — no frame between "hide A" and "show B"

## GDD Requirements Addressed

| GDD Requirement              | How This ADR Addresses It                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------- |
| Modular blocks               | HudBlock interface + HudConfig zone/block assignment                                              |
| Event-driven (no polling)    | All blocks react to Event Bus events. SpeedBlock at 20hz throttle (exception eliminated)          |
| Consumer-only                | HUD never emits events, never writes gameplay state                                               |
| Zone-based responsive layout | Grid with proportional fractions, `idealHeight = 1080`, auto-scaling                              |
| Mechanical transitions       | HudAnimator with configurable HudAnimStyle. Default: MECHANICAL. Playtesting can change per-block |
| Pit overlay replaces HUD     | Single ADT, toggle visibility groups — race blocks hidden, pit blocks shown                       |
| Resource bars throttled      | `resourcesUpdateInterval` config (default: 10 ticks = ~6hz)                                       |
| Minimap                      | Pure GUI controls in Phase 1. DynamicTexture migration path documented                            |

## Performance Implications

- **GPU**: Single ADT render target (~0.1–0.3ms per frame for 8 blocks + overlays). Less than 2% of frame budget at 60fps.
- **CPU**: SpeedBlock text set ~20 times/sec (< 0.001ms). HudAnimator.update() ~0.01ms with 0–2 active tweens.
- **Memory**: ~40 GUI controls at ~2KB each = ~80KB total. Pit overlay controls add ~10 more = ~20KB. Well within budget.
- **Layout**: Grid compute on init only (once per race). Visibility toggles are O(1) per control.

## Validation Criteria

- [ ] HudManager creates all controls at init — zero addControl calls during race
- [ ] Zone widths match config fractions: left=20%, center=58%, right=22% (±1%)
- [ ] idealHeight = 1080 — controls scale correctly on 16:9, 21:9, and 4:3 viewports
- [ ] SpeedBlock updates at 20hz (every 3 ticks) from Event Bus — no direct CarEntity read
- [ ] LapBlock, PositionBlock, ResourcesBlock react to their respective events
- [ ] ResourcesBlock pulses when fuel ≤ 15% or tire ≤ 20%
- [ ] PitOverlayBlock toggles visibility groups — race blocks hidden, pit blocks shown, no frame flash
- [ ] DNFOverlay shows on player DNF
- [ ] CheckeredOverlay shows on race.checkered with top 3 + player position
- [ ] HUD deactivates on GSM → PostRace (all blocks invisible)
- [ ] HudAnimator plays MECHANICAL animations (0.1s tick) — no smooth transitions
- [ ] `animStyle: "smooth"` on a block changes animation to ease-out (future)
- [ ] Invalid HudConfig (unknown block id) logs and skips — other blocks load normally
- [ ] Zero active blocks → HUD runs silently, no errors

## Related Decisions

- ADR-0001 (Event Bus — all HUD input events defined)
- ADR-0006 (Input — confirm action for pit exit prompt)
- ADR-0015 (Race Management — race state events)
- ADR-0004 (Module Boundary — HUD is consumer-only, never emits)

## Open Questions

1. **Speed fallback path**: If 20hz throttle proves jittery, the escalation is: 60hz (every tick) → direct read via HudContext.playerCar. The GDD and ADR both support the event-driven model as primary.
2. **Minimap DynamicTexture**: Implement in Phase 2 when rotation/zoom features are added. The pure-GUI Phase 1 is not a throwaway — the DynamicTexture can display the same data with more rendering flexibility.
