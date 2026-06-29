# Story 009: Audio Config & Bus Creation

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Config/Data
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-003` — Four AudioBus instances: music (0.5), sfx (0.7), ui (0.6), ambient (0.4). `TR-AUDIO-007` — Volumes persisted per category (user preference), 0..1 range.

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: Four `AudioBus` instances created via `CreateAudioBusAsync`, each with independent volume. Bus volumes are runtime-configurable via `ConfigManager` and persisted per category.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `CreateAudioBusAsync(name, { volume })` — volume is a float 0..1. `bus.setVolume(target, { duration, shape })` for smooth volume changes. Default bus volumes from ADR: music=0.5, sfx=0.7, ui=0.6, ambient=0.4.

**Control Manifest Rules (this layer)**:

- Required: P13 (Audio Engine V2 ONLY), P14 (4 AudioBuses with specific default volumes)
- Forbidden: P-F2 (Never use `SoundTrack`)

---

## Acceptance Criteria

_From GDD `design/gdd/audio.md`:_

- [ ] AC #10: All 18 tuning knobs (`audio.*` namespace) are accessible via `ConfigManager.get('audio.*')`
- [ ] 4 `AudioBus` instances created with correct default volumes via `CreateAudioBusAsync`:
  - `"music"` → 0.5, `"sfx"` → 0.7, `"ui"` → 0.6, `"ambient"` → 0.4
- [ ] Bus volumes are **read from ConfigManager** at init (not hardcoded) — overriding defaults via config works
- [ ] Bus names are unique — calling `CreateAudioBusAsync` with a duplicate name returns existing bus (idempotent, no error)
- [ ] Per-category user volume preference persisted via Persistence interface — saved on change, restored on init
- [ ] ConfigManager values outside valid range (0..1 for volumes) are clamped to nearest boundary; invalid non-numeric values fall back to tuning knob default

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
import { ConfigManager } from "../../foundation/config/config-manager";
import type { Persistence } from "../../foundation/persistence/persistence";

const BUS_DEFAULTS = {
  music: { volume: ConfigManager.get<number>("audio.musicVolume") },
  sfx: { volume: ConfigManager.get<number>("audio.sfxVolume") },
  ui: { volume: ConfigManager.get<number>("audio.uiVolume") },
  ambient: { volume: ConfigManager.get<number>("audio.ambientVolume") },
};

// Per-bus creation:
const musicBus = await CreateAudioBusAsync("music", {
  volume: BUS_DEFAULTS.music.volume,
});
```

**ConfigManager namespace registration** — register `audio.*` namespace at init with all 18 tuning knobs from the GDD tuning table. Values are read once at init. Runtime config changes take effect on next race load (no hot-reload for MVP).

**Persistence flow**:

- On volume change: `persistence.save(`audio.${category}`, value)`
- On init: `persistence.load<number>(`audio.${category}`).then(...)` → override ConfigManager default if user preference exists
- Storage key: `overdrive_audio_{category}`

**Duplicate bus guard**: wrap `CreateAudioBusAsync` in a cache map — if bus name already exists in map, return cached reference.

---

## Out of Scope

- Runtime hot-reload of config values mid-race (deferred to Alpha)
- Per-car volume settings (all cars share same bus volumes)

---

## QA Test Cases

- **AC-1**: All 4 buses have correct default volumes
  - Given: AudioEngine is initialized
  - When: `CreateAudioBusAsync` is called for "music", "sfx", "ui", "ambient"
  - Then: All 4 buses exist with volumes 0.5, 0.7, 0.6, 0.4 respectively; no two buses share a name
  - Edge cases: Bus names are case-sensitive; empty name throws

- **AC-2**: Bus volumes come from ConfigManager
  - Given: ConfigManager has `audio.musicVolume = 0.3` (overriding default 0.5)
  - When: AudioManager.init() creates the "music" bus
  - Then: musicBus.volume equals 0.3, not 0.5
  - Edge cases: Missing config key falls back to tuning knob default

- **AC-3**: Volumes persist across sessions
  - Given: User sets sfx volume to 0.5 via settings
  - When: AudioManager.init() is called on next game start
  - Then: sfxBus.volume equals 0.5 (the saved preference)
  - Edge cases: No saved preference → uses ConfigManager default

- **AC-4**: Invalid values are clamped
  - Given: ConfigManager has `audio.masterVolume = 2.5`
  - When: AudioManager reads the value
  - Then: Value is clamped to 1.0
  - Edge cases: Negative values clamped to 0; string values fall back to default

- **AC-5**: Duplicate bus creation is idempotent
  - Given: Bus "sfx" exists
  - When: `CreateAudioBusAsync("sfx", { volume: 0.9 })` is called
  - Then: The existing bus reference is returned; no second bus is created
  - Edge cases: Volume parameter on duplicate call is ignored (first volume wins)

---

## Test Evidence

**Story Type**: Config/Data
**Required evidence**: Smoke check pass (`production/qa/smoke-audio-config.md`).

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 001 (engine must be initialized first)
- Unlocks: Stories 003a, 003b, 004, 005, 006, 007
