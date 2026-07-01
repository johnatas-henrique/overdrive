# Story 005: Collision Sound System

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 4h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-005` — Race event subscription: collision.impact. `TR-AUDIO-009` — maxInstances for collision sounds (default 5).

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: `CreateSoundAsync` with `maxInstances: 5` for collision sounds — no custom pooling. Subscribe to `collision.impact` Event Bus event. Player collisions play full volume, rival collisions within 30m play muffled with distance scaling.

**Engine**: Babylon.js 9.12.0 | **Risk**: LOW
**Engine Notes**: `maxInstances` parameter on `CreateSoundAsync` — oldest instance auto-stopped when limit exceeded. `collision.impact` event emitted by Collision system with impulse magnitude, distance, carId, and collision type.

**Control Manifest Rules (this layer)**:

- Required: P17 (maxInstances for collisions — default 5, no custom pooling), P13 (Audio Engine V2 ONLY)
- Forbidden: P-F1 (Never use legacy `Sound` class)

---

## Acceptance Criteria

_From GDD `design/gdd/audio.md`:_

- [ ] AC #5: Player collision plays at full volume; rival collision within 30m plays muffled (low-pass filter, -12dB)
- [ ] AC #6: Rival collision volume scales inversely with distance: `rivalVolume = baseVolume × (1 - distance/30) × 0.3`
- [ ] AC #12: Max 5 concurrent collision sounds via `maxInstances: 5` on `CreateSoundAsync` — 6th play stops oldest
- [ ] Player collision volume: `baseVolume × clamp(impulse / maxImpulse, 0, 1)` — proportional to impact force
- [ ] Barrier collisions play "thud" sample; car-car collisions play "scrape" sample — selected by `collision.impact.type`
- [ ] Rival collisions beyond 30m are not played (distance > 30 → no sound)
- [ ] Subscribe to `collision.impact` Event Bus with payload: `{ carId, impulse, distance, type: 'barrier' | 'car-car' }`

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
private _collisionThud: StaticSound | null = null;
private _collisionScrape: StaticSound | null = null;

async initCollisionSounds(): Promise<void> {
  this._collisionThud = await CreateSoundAsync("collision_thud", "audio/sfx/thud.wav", {
    outBus: this._sfxBus,
    maxInstances: ConfigManager.get<number>("audio.collisionMaxConcurrent"), // default 5
  });
  this._collisionScrape = await CreateSoundAsync("collision_scrape", "audio/sfx/scrape.wav", {
    outBus: this._sfxBus,
    maxInstances: ConfigManager.get<number>("audio.collisionMaxConcurrent"),
  });
}

// Subscribed to collision.impact event
onCollisionImpact(payload: CollisionImpactPayload): void {
  const { carId, impulse, distance, type } = payload;
  const isPlayer = carId === this._playerCarId;

  if (!isPlayer && distance > ConfigManager.get<number>("audio.collisionRadius")) {
    return; // too far — no sound
  }

  const sound = type === "barrier" ? this._collisionThud : this._collisionScrape;
  const baseVolume = clamp(impulse / ConfigManager.get<number>("collision.maxImpulse"), 0, 1);

  if (isPlayer) {
    sound.play({ volume: baseVolume });
  } else {
    // Rival: muffled + distance scaling
    const rivalFactor = ConfigManager.get<number>("audio.collisionRivalRatio"); // 0.3
    const distanceFactor = clamp(1 - distance / ConfigManager.get<number>("audio.collisionRadius"), 0, 1);
    sound.play({ volume: baseVolume * distanceFactor * rivalFactor });
  }
}
```

**Event payload contract**: `collision.impact` event emitted by Collision system must include:

- `carId: string` — the car that was hit
- `impulse: number` — collision force in Newton-seconds
- `distance: number` — distance from listener (player car) to collision point, in meters
- `type: 'barrier' | 'car-car'` — what was hit

**Muffling**: Rival collisions are NOT filtered via AudioParam (no low-pass on one-shot samples). Instead, volume is multiplied by 0.3 to create the perceptual "muffled/distant" effect. True low-pass filtering deferred to spatial audio (Alpha).

---

## Out of Scope

- Spatial audio / 3D positioning (deferred to Alpha)
- Doppler effect on collisions
- AI car engine sounds at distance

---

## QA Test Cases

- **AC-1**: Player collision at full volume proportional to impulse
  - Given: Player collides with barrier, `impulse = 50`, `maxImpulse = 100`
  - When: `onCollisionImpact({ carId: "car_0", impulse: 50, distance: 0, type: "barrier" })`
  - Then: `baseVolume = 0.5`; "thud" sample plays on sfxBus at volume 0.5
  - Edge cases: `impulse = 0` → volume = 0 (no audible sound). `impulse > maxImpulse` → clamped to 1.0

- **AC-2**: Rival collision muffled + distance-scaled
  - Given: Rival collides at `distance = 15m`, `impulse = 80`, `collisionRivalRatio = 0.3`, `collisionRadius = 30`
  - When: `onCollisionImpact({ carId: "car_3", impulse: 80, distance: 15, type: "car-car" })`
  - Then: `volume = 0.8 × (1 - 15/30) × 0.3 = 0.8 × 0.5 × 0.3 = 0.12`; "scrape" plays
  - Edge cases: Distance = 0 → volume × 1.0 × 0.3. Distance = 30 → volume × 0.0 × 0.3 = 0

- **AC-3**: maxInstances limits concurrency
  - Given: 5 collision sounds currently active
  - When: 6th collision plays
  - Then: Oldest active instance stops; 6th plays normally
  - Edge cases: 5 concurrent for different collision types (thud + scrape tracked independently per maxInstances)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/audio/collision-sounds.test.ts` OR playtest doc.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 004 (tire squeal — establishes sfxBus and event subscription patterns)
- Unlocks: Story 006
