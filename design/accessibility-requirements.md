# Accessibility Requirements: Overdrive

> **Status**: Committed
> **Author**: producer
> **Last Updated**: 2026-06-22
> **Accessibility Tier Target**: Standard (MVP) → Comprehensive (1.0)
> **Platform(s)**: PC (web — Electron/Tauri)
> **External Standards Targeted**:
>
> - WCAG 2.1 Level AA
> - AbleGamers CVAA Guidelines
> - Xbox Accessibility Guidelines (XAG) — Partial
>   **Accessibility Consultant**: None engaged
>   **Linked Documents**: `design/gdd/systems-index.md`, `docs/architecture/adr-0006-input-abstraction.md`, `docs/architecture/adr-0018-hud-layout-blocks.md`

---

## Tier Definitions

| Tier              | Scope                | Target                                                                              |
| ----------------- | -------------------- | ----------------------------------------------------------------------------------- |
| **Basic**         | MVP launch           | Text scaling, subtitles, contrast, volume sliders                                   |
| **Standard**      | MVP launch (current) | Basic + colorblind modes, input remapping, simplified HUD, flashing lights warning  |
| **Comprehensive** | 1.0 release          | Standard + screen reader, assist mode, per-axis difficulty, full certification prep |
| **Exemplary**     | Post-1.0             | Comprehensive + external audit, community feedback loops, certified compliance      |

**Current commitment**: **Standard** at MVP. **Comprehensive** targeted for 1.0.

---

## Visual Accessibility

| Feature              | Standard (MVP)                                                                                                                                                | Comprehensive (1.0)                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Colorblind modes** | 3 presets: protanopia, deuteranopia, tritanopia. Swap team palette hex values for affected hues. Applied before race start, persisted to localStorage.        | Same + simulated preview overlay in settings             |
| **Text scaling**     | UI text scales to min 16px equivalent. `AdvancedDynamicTexture idealWidth` preserves relative layout at all supported resolutions (720p–1440p).               | User-selectable scale multiplier (0.8×–1.5×)             |
| **Minimum contrast** | All UI text passes WCAG AA (4.5:1 normal, 3:1 large). HUD block backgrounds at 60% opacity minimum against track.                                             | In-game contrast validator showing pass/fail per element |
| **Flashing lights**  | Pre-race warning screen for photosensitive players. Countdown lights (5→1) at 1s intervals — no stroboscopic effect. PostRace drone cameras avoid rapid cuts. | Settings toggle to reduce all animation intensity        |
| **UI font**          | Sans-serif, monospace for numbers only (speed, lap count). No decorative fonts in HUD. Minimum 14px body text.                                                | User-selectable font family (OpenDyslexic included)      |

**Design decisions driven by visual accessibility:**

- Team identification uses **shape + position** (car silhouette, grid row), not just colour — a colourblind player can always tell which car is theirs by cockpit view alone.
- Position changes emit audio cues (ADR-0020) — "Car ahead" / "Car behind" via OS audio bus.
- Race engineer voice lines (1.0) repeat critical UI text audibly.

---

## Motor Accessibility

| Feature                  | Standard (MVP)                                                                                                           | Comprehensive (1.0)                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Input remapping**      | Full keyboard remapping via `InputState` (ADR-0006). Key bindings persisted to localStorage. Gamepad follows OS mapping. | Full gamepad remapping in settings UI. Per-axis dead zone with preview.                                    |
| **Dead zone adjustment** | Analog dead zone configurable (0.0–0.5, default 0.1). Stored in `ConfigManager` under `input.deadZone`.                  | Visual dead zone calibrator with real-time axis preview                                                    |
| **Invert look**          | Camera Y-axis invert toggle (cockpit/chase). Stored in `ConfigManager`.                                                  | Per-camera invert (cockpit separate from chase/drone)                                                      |
| **One-button modes**     | None in MVP                                                                                                              | "Auto-accelerate" (throttle always 1.0, steer + brake only). "Assist steer" (AI assists with corner line). |
| **Hold vs toggle**       | Accelerate/brake are analog hold (default). No toggle-only actions in critical race controls.                            | Toggle option for throttle/brake in settings                                                               |

---

## Cognitive Accessibility

| Feature                 | Standard (MVP)                                                                                                                                                       | Comprehensive (1.0)                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Simplified HUD**      | Toggle to reduce HUD to essential only: speed, lap counter, position, fuel bar. Hides sector times, delta, minimap. Default: full HUD.                               | Configurable per-block visibility (speed always on, fuel can be hidden, etc.)            |
| **Pacing & pressure**   | Pause always available (ESC → Paused state, GSM handles cleanly). No time-pressure mechanics in MVP. Difficulty slider (5 levels) affects AI speed only, not timing. | Per-axis difficulty: AI speed, fuel consumption, tire wear rate adjustable independently |
| **Clear feedback**      | Every player action has immediate visual+audio feedback. Confirm button always shows result before executing (pit exit, menu confirm).                               | Tutorial overlays explain each HUD element on first race                                 |
| **Information density** | HUD shows max 6 blocks simultaneously (ADR-0018 limit). No overlapping information layers.                                                                           | Player-selectable information priority (race engineer prioritises critical info)         |

---

## Auditory Accessibility

| Feature                          | Standard (MVP)                                                                                                                                   | Comprehensive (1.0)                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| **Volume sliders**               | 3 AudioBus channels (SFX/music/ambient) with independent sliders. Persisted to localStorage. UI sounds on separate bus for consistent feedback.  | + Voice channel (race engineer). Per-sound-type fine-tuning.                                   |
| **Visual cues for audio events** | Overtaking: position indicator flashes on HUD edge. Collision: screen shake + flash. DNF/Checkered: persistent on-screen banner until dismissed. | Directional arrow for rival position (relative to player). Rumble support.                     |
| **Subtitles**                    | None in MVP (no narrative dialogue).                                                                                                             | Race engineer voice lines subtitled. Audio cues labelled ("Engine RPM high", "Tire grip low"). |
| **Audio ducking**                | Not in MVP                                                                                                                                       | Critical audio (car ahead warning) ducks non-critical audio (music).                           |

---

## Implementation Notes

- **All accessibility settings persist** via `ConfigManager` → `IPersistence` (localStorage, ADR-0016). Survives session restarts.
- **No accessibility setting affects gameplay simulation** — Physics, Fuel, Tire, AI are deterministic regardless of accessibility choices. Only input processing and rendering are affected.
- **Settings screen** is part of Menu LITE (ADR-0019). Accessibility section added after Car Select, before Race Settings. MVP shows: colorblind mode, volume sliders, simplified HUD toggle, invert look. 1.0 adds: remapping, dead zone, font scale, per-axis difficulty.

## Verification

- MVP: Colorblind modes tested against every team palette. HUD contrast measured against WCAG AA on reference screenshots. Input remapping validated for all keyboard keys used in ADR-0006.
- 1.0: Playtest with at least one participant who uses accessibility features. Screen reader tested on Menu LITE critical paths. All Comprehensive features verified against acceptance criteria.
