# Story 008: Menu Music & Race Event Sounds

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-004` — GSM event subscription (music portion). `TR-AUDIO-005` — Race event subscription: gear.up/down, collision.impact, lap.complete, checkered fanfare.

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: `CreateStreamingSoundAsync` for menu music (no `playbackRate` support — music stays at 1.0 rate). One-shot sounds (`CreateSoundAsync` without loop) for gear shifts, UI confirm/cancel, lap beep, podium fanfare. Event Bus subscriptions for trigger events.

**Engine**: Babylon.js 9.12.0 | **Risk**: MEDIUM
**Engine Notes**: `CreateStreamingSoundAsync` does NOT support `playbackRate` changes — music plays at native sample rate. Streaming is for long-duration MP3 files. WAV one-shots for gear/UI/fanfare via `CreateSoundAsync` without `loop: true`.

**Control Manifest Rules (this layer)**:

- Required: P13 (Audio Engine V2 ONLY), P14 (AudioBuses — music=0.5, ui=0.6, sfx=0.7)
- Forbidden: P-F1 (Never use legacy `Sound` class)

---

## Acceptance Criteria

- [ ] Menu music: `CreateStreamingSoundAsync("menu_music", "audio/music/menu.mp3", { loop: true, outBus: musicBus, autoplay: true })` — plays during Menu state
- [ ] Gear shift sound: one-shot sample per car class (V12=sharp click, V8=deeper thud); triggers when `physics.gear` value changes between ticks
- [ ] Gear shift plays exactly once per gear change — no overlap (new shift cancels previous)
- [ ] UI confirm sound on `uiBus` at volume 0.6 — triggered by menu navigation
- [ ] UI cancel sound on `uiBus` at volume 0.6 — triggered by menu back/cancel
- [ ] Lap beep on `uiBus` — triggered by `race.lap.completed` event
- [ ] Podium fanfare on `musicBus` — one-shot; triggered by `race.checkered` or `gsm.state.entered(to: "PostRace")`
- [ ] Fuel empty sputter on `sfxBus` — triggered by `car.fuel_empty` event
- [ ] Tire blow pop on `sfxBus` — triggered by `car.tire_blown` event
- [ ] Overtake sound cue on `sfxBus` — triggered by `position.changed` (optional, non-critical)
- [ ] Music content: CC0 synthwave/outrun, 120-140 BPM, seamless loop at 32 or 64 bars — loaded via Asset Manager

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
// Music streaming — no playbackRate support
this._menuMusic = await CreateStreamingSoundAsync(
  "menu_music",
  "audio/music/menu.mp3",
  {
    loop: true,
    outBus: this._musicBus,
    autoplay: false, // Story 007 controls playback via bus volume
  }
);

// One-shot samples
this._gearShiftSamples = new Map<string, StaticSound>([
  [
    "v12",
    await CreateSoundAsync("gear_v12", "audio/sfx/gear_v12.wav", {
      outBus: this._sfxBus,
    }),
  ],
  [
    "v10",
    await CreateSoundAsync("gear_v10", "audio/sfx/gear_v10.wav", {
      outBus: this._sfxBus,
    }),
  ],
  [
    "v8a",
    await CreateSoundAsync("gear_v8a", "audio/sfx/gear_v8a.wav", {
      outBus: this._sfxBus,
    }),
  ],
  [
    "v8b",
    await CreateSoundAsync("gear_v8b", "audio/sfx/gear_v8b.wav", {
      outBus: this._sfxBus,
    }),
  ],
]);

this._uiConfirm = await CreateSoundAsync("ui_confirm", "audio/ui/confirm.wav", {
  outBus: this._uiBus,
});
this._uiCancel = await CreateSoundAsync("ui_cancel", "audio/ui/cancel.wav", {
  outBus: this._uiBus,
});
this._lapBeep = await CreateSoundAsync("lap_beep", "audio/ui/lap_beep.wav", {
  outBus: this._uiBus,
});
this._fanfare = await CreateSoundAsync(
  "fanfare",
  "audio/music/podium_fanfare.wav",
  { outBus: this._musicBus }
);

// Event subscriptions
eventBus.on("car.gear_changed", (p) => this._playGearShift(p.carId, p.gear));
eventBus.on("ui.confirm", () => this._uiConfirm.play());
eventBus.on("ui.cancel", () => this._uiCancel.play());
eventBus.on("race.lap.completed", (p) => {
  if (p.carId === playerCarId) this._lapBeep.play();
});
eventBus.on("race.checkered", () => this._fanfare.play());
eventBus.on("car.fuel_empty", (p) => {
  /* play sputter one-shot */
});
eventBus.on("car.tire_blown", (p) => {
  /* play pop one-shot */
});
```

**Gear shift trigger**: Track `physics.gear` value per tick. When previous tick's gear !== current gear, play sample. New shift cancels previous via `.stop()` on previous instance — `maxInstances: 1` on gear shift `CreateSoundAsync` achieves this.

---

## Out of Scope

- Music start/stop by GSM state (Story 007 — this story only creates the sounds)
- Config-driven volumes (Story 009)
- Adaptive music system (dynamic intensity — deferred to Alpha)

---

## QA Test Cases

- **AC-1**: Menu music streams on musicBus
  - Given: AudioBus "music" exists
  - When: `CreateStreamingSoundAsync("menu_music", ..., { outBus: musicBus, loop: true })`
  - Then: Sound is created on musicBus; `autoplay` is false (Story 007 controls volume)
  - Manual: Verify `playbackRate` setter is unavailable or throws on StreamingSound

- **AC-2**: Gear shift triggers on gear change
  - Given: Car is in gear 3
  - When: `physics.gear` changes to 4
  - Then: Car-class-specific gear shift sample plays on sfxBus at volume 0.7
  - Edge cases: Rapid gear changes (upshift+downshift within 1 tick) — only last gear change triggers sound; new shift cancels previous

- **AC-3**: UI sounds play on uiBus
  - Given: Menu is active
  - When: User presses confirm
  - Then: `ui_confirm.wav` plays on uiBus at default volume
  - When: User presses cancel/back
  - Then: `ui_cancel.wav` plays on uiBus at default volume
  - Edge cases: Rapid confirm/cancel → each plays independently (no maxInstances limit)

- **AC-4**: Lap beep for player only
  - Given: Player and AI cars on track
  - When: Player completes a lap
  - Then: Lap beep plays on uiBus
  - When: AI car completes a lap
  - Then: No lap beep (player notification only)
  - Edge cases: Player and AI cross line in same tick → lap beep plays once

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `production/qa/evidence/menu-music-event-sounds-evidence.md` + sign-off.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 007 (GSM audio state machine controls music playback via bus volume)
- Unlocks: Story 010
