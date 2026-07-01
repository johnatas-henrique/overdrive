# Story 002: HudBlock Interface & HudConfig

> **Epic**: HUD
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Logic
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/hud.md`
**Requirements**: `TR-HUD-003` (HudBlock interface: container, onActivate/onDeactivate, dispose) + `TR-HUD-006` (HudConfig via `hud.*` namespace with HMR)

**ADR Governing Implementation**: ADR-0018: HUD Layout & Blocks
**ADR Decision Summary**: HudBlock interface (id, container, onActivate(ctx), onDeactivate(ctx), dispose()). HudConfig loads from ConfigManager `hud.*` namespace. Zone widths are proportional fractions summing to 1.0 (no star sizing). HMR via ConfigManager namespace invalidation callback.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: All block containers are Babylon.js GUI Container types. No engine-specific APIs beyond Container — pure TypeScript interface + data types.

**Control Manifest Rules (this layer)**:

- Required: P1 (single ADT), P2 (Grid widthFraction), P3 (create-once toggle-visibility), P6 (event-driven for all blocks)
- Forbidden: P-F5 (never destroy/recreate controls), P-F7 (never attach blocks directly to ADT)
- Guardrail: P-G1 (HUD < 0.3ms GPU per frame)

## Acceptance Criteria

_From GDD HudConfig section, ADR-0018 Key Interfaces, and QL-STORY-READY gate:_

- [ ] AC-1: HudBlock interface enforces `id: string`, `container: Container`, `onActivate(ctx: HudContext): void`, `onDeactivate(): void`, `dispose(): void` — `onDeactivate` takes no arguments (unsubscribes are handled internally)
- [ ] AC-2: HudZoneConfig defines `id`, `widthFraction` (0.0–1.0), `blocks[]`, `padding`
- [ ] AC-3: HudBlockConfig defines `id`, `visible`, `size` (width/height as 0.0–1.0 fraction), optional `animStyle`
- [ ] AC-4: HudConfig validates zone widthFraction sum to 1.0 (±0.001 tolerance) — throws `ConfigError` on invalid sum
- [ ] AC-5: Unknown block `id` in config is logged via `console.warn` and skipped — all known blocks load normally
- [ ] AC-6: HudConfig loads from ConfigManager under `hud.*` namespace — if namespace not found, uses built-in default config
- [ ] AC-7: HMR mechanism: ConfigManager exposes `onInvalidate(namespace: string, callback: () => void)` — HudFactory subscribes to `hud.*` invalidation at init; on invalidation, re-reads config and applies zone/block changes within 1 tick
- [ ] AC-8: Zero active blocks in config → HUD runs silently, no errors, no rendering

## Implementation Notes

_Derived from ADR-0018 Implementation Guidelines:_

1. **HudBlock interface** — all blocks implement this. `onActivate(ctx)` receives the full `HudContext`. `onDeactivate()` stores unsubscribe handles internally and clears them. No `ctx` parameter on `onDeactivate`.

2. **WidthFraction validation** — sum of all zone `widthFraction` values must be 1.0 ± 0.001:

   ```typescript
   function validateZoneLayout(zones: HudZoneConfig[]): void {
     const sum = zones.reduce((s, z) => s + z.widthFraction, 0);
     if (Math.abs(sum - 1.0) > 0.001) {
       throw new ConfigError(`Zone widths sum to ${sum}, must be 1.0`);
     }
   }
   ```

3. **HMR mechanism**: ConfigManager API conforms to ADR-0023 pattern:

   ```typescript
   configManager.onInvalidate("hud.*", () => {
     const rawConfig = configManager.get<RawHudConfig>("hud.layout");
     hudManager.reapplyConfig(parseHudConfig(rawConfig));
   });
   ```

4. **Default config** — hardcoded fallback if ConfigManager `hud.*` is unavailable:
   - zones: left (0.20) → ["minimap"], center (0.58) → ["speed", "lap", "position"], right (0.22) → ["resources"]
   - animSpeed: 1.0, resourcesUpdateInterval: 10

5. **Config errors** — invalid block IDs with console.warn, unknown zone IDs logged, malformed size values clamped to [0, 1]. Partial config applies valid parts.

## Out of Scope

_Handled by neighbouring stories — do not implement here:_

- Story 003: HudManager — ADT creation, Grid setup, block lifecycle orchestration
- Story 001: HudAnimator — animation utility (referenced by HudAnimStyle type)

## QA Test Cases

_Automated test specs — written by qa-lead at story creation:_

- **AC-1**: HudBlock interface enforcement
  - Given: A TypeScript mock implementing HudBlock
  - When: The class is type-checked against the interface
  - Then: It must provide `id`, `container`, `onActivate(ctx): void`, `onDeactivate(): void`, `dispose(): void`
  - Edge cases: `onDeactivate` without ctx parameter (must compile — intentionally different from ADR interface sketch's optional ctx)

- **AC-2/3**: Config type definitions
  - Given: A valid HudConfig object constructed programmatically
  - When: Parsed by `parseHudConfig()`
  - Then: All fields match expected types and defaults
  - Edge cases: missing optional fields filled with defaults

- **AC-4**: Zone width validation
  - Given: HudConfig with `zones = [{ widthFraction: 0.3 }, { widthFraction: 0.3 }]` (sum=0.6)
  - When: `validateZoneLayout()` is called
  - Then: ConfigError thrown with message containing the sum
  - Given: zones 0.20, 0.58, 0.22 (sum=1.0)
  - When: `validateZoneLayout()` is called
  - Then: no error
  - Edge cases: sum=0.999 (passes within tolerance), sum=0.998 (throws)

- **AC-5**: Unknown block ID skipped
  - Given: HudConfig with `blocks: [{ id: "speed" }, { id: "unknown_block" }]`
  - And: console.warn is spied
  - When: HudConfig.parse() is called
  - Then: console.warn is called with message containing "unknown_block"
  - And: the speed block entry is valid
  - Edge cases: all IDs unknown (each logged), mixed known+unknown (known loaded)

- **AC-6**: HudConfig from ConfigManager
  - Given: ConfigManager has data at `hud.layout.zones` and `hud.layout.blocks`
  - When: `HudConfig.fromConfigManager(configManager)` is called
  - Then: returned HudConfig matches config data
  - Edge cases: ConfigManager returns null/undefined for `hud.*` → default config used

- **AC-7**: HMR invalidation
  - Given: HudFactory subscribed to ConfigManager `onInvalidate('hud.*', callback)`
  - When: ConfigManager triggers invalidation for `hud.*`
  - Then: callback fires within same tick
  - Edge cases: subscription not yet initialized (no crash on early invalidation)

- **AC-8**: Zero active blocks
  - Given: HudConfig with `blocks: []`
  - When: HudManager.init() is called with this config
  - Then: no error thrown, no blocks added to Grid
  - And: HUD is in active state with no visible output

## Test Evidence

**Story Type**: Logic
**Required evidence**: `tests/unit/hud/hudConfig.test.ts` — must exist and pass
**Status**: [ ] Not yet created

## Dependencies

- Depends on: None (types and interfaces only — no runtime dependencies beyond standard lib)
- Unlocks: Story 003 (HudManager), all block stories 004-012
