# Collision

> **Status**: Design Complete
> **Author**: Overdrive Team
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Simple Strategy

## Overview

Collision is the detection layer between the physics engine's collision resolution and the game's event-driven systems. It does not simulate damage, deformation, or car durability. Its single responsibility is: something touched something else → publish what happened.

Havok Physics (via Babylon.js) resolves all contact physics — bouncing off barriers, pushing cars apart, friction. Collision listens to Havok's contact callbacks and translates raw physics contacts into named game events that Camera and Audio consume. This keeps the physics engine pure and lets game-feel systems react to contact without knowing anything about Havok internals.

In Phase 1 (MVP), Collision handles two detection types: car↔car contact and car↔barrier contact. Finish line detection moves to Race Management (spatial check — car position crosses finish plane). Pit entry/exit detection moves to Pit Stop (spatial check — car enters/exits pit bounding box). No damage, no deformation, no mechanical consequences from collision (tire blowout and fuel starvation come from Tire Wear and Fuel systems, not collision).

## Player Fantasy

The player never thinks about Collision. When they clip a rival's rear wheel at 250 km/h, the game responds immediately: their camera shakes, a thud plays — but only for their collision. When an opponent's car scrapes a barrier nearby, they hear it — a muffled impact from that direction, giving spatial awareness of the race around them. Collision makes the world feel solid and responsive — it is the least visible system and the most felt when absent.

## Detailed Design

### Core Rules

**1. Collision is event-driven only.** Havok resolves contact physics. Collision observes Havok's contact callbacks and emits events on the Event Bus. No polling, no tick-to-tick state. No `update()` method.

**2. Two detection types in Phase 1:**

| Type                | Trigger                             | Published Event    | Consumed By                    |
| ------------------- | ----------------------------------- | ------------------ | ------------------------------ |
| Car↔car contact     | Two car meshes overlap in Havok     | `collision.impact` | Camera (shake), Audio (thud)   |
| Car↔barrier contact | Car mesh touches track barrier mesh | `collision.impact` | Camera (shake), Audio (scrape) |

**3. No damage in Phase 1.** Collision emits events; no system applies durability loss, deformation, or mechanical failure from impact. Tire blowout is exclusively from Tire Wear; engine failure is exclusively from Fuel.

**4. Contact events include impulse magnitude.** The `collision.impact` payload carries `{ carId, otherId, impulse, relativeVelocity, position }` so consumers can scale their response (big hit = big shake + loud thud).

**5. Camera shakes only on player collision.** Camera filters `collision.impact` by `carId === playerCarId`. AI and other players' collisions never affect the local player's camera. The impulse magnitude is still available for audio reactions even when camera ignores the event.

**6. Audio reacts to player and nearby collisions.** Audio plays thud/scrape for the player's own collisions (`carId === playerCarId`). For non-player collisions, Audio plays a muffled/distant impact sound if `relativePosition < proximityThreshold` (default 30m). This gives the player spatial awareness of crashes happening around them without visual camera shake.

**7. FixedUpdatePipeline step 4.** Collision runs after Physics resolves the tick's contacts. Pipeline order: Input → Physics/Handling → AI Driver → Collision → Fuel → Tire Wear → Race Management.

> **Alpha expansion**: A `Damage` system (Phase 2, Alpha) will consume `collision.impact` with `impulse > damageThreshold` to trigger mechanical failure — suspension damage, gearbox degradation, aero loss. Collision already emits the event with full impulse data in Phase 1. The Damage system is a new consumer only — no changes to Collision itself.

### States

Collision has no state machine. It is either registered with Havok's contact callbacks (during Racing) or not (any other GSM state). Registration/unregistration is driven by GSM transitions:

| GSM State | Collision Status         |
| --------- | ------------------------ |
| Loading   | Not registered           |
| Menu      | Not registered           |
| PreRace   | Register callbacks       |
| Racing    | Active — emitting events |
| PostRace  | Unregister callbacks     |

Registration happens once at PreRace (before the race starts) and lasts until PostRace. No per-tick enable/disable.

### Interactions

| System        | Data Out           | Data In                                            | Direction             |
| ------------- | ------------------ | -------------------------------------------------- | --------------------- |
| Havok Physics | —                  | Contact callbacks (collision pairs)                | Havok → Collision     |
| Event Bus     | `collision.impact` | —                                                  | Collision → Event Bus |
| Camera        | —                  | `collision.impact` → screen shake (player only)    | Event Bus → Camera    |
| Audio         | —                  | `collision.impact` → thud/scrape (player + nearby) | Event Bus → Audio     |
| AI Driver     | —                  | `collision.impact` → tactical avoidance            | Event Bus → AI Driver |

### Event Payloads

```
collision.impact {
  carId: string;          // CarEntity.id
  otherId: string;        // 'barrier' | rival carId
  impulse: number;        // Havok-reported impulse magnitude (N·s)
  relativeVelocity: number; // closing speed (km/h)
  position: { x, y, z };  // world position of contact
}
```

## Edge Cases

- **Multiple contacts in one tick**: Several cars touching barriers simultaneously. Collision emits one `collision.impact` per contact pair. Consumers (Camera, Audio) may throttle their response (e.g. Camera ignores shake if another shake is already playing — determined by the consuming system, not Collision).
- **Car↔car at very low speed (< 5 km/h)**: Still emits `collision.impact` but with negligible impulse. Camera thresholds its shake to ignore sub-1 N·s impacts.
- **Car↔barrier grazing (0° incidence)**: A car scraping a wall at low angle produces continuous contact frames. Collision emits one event per frame Havok reports contact — Camera and Audio throttle independently.
- **Collision with non-car entity (kerbs, cones)**: Kerbs are excluded from Havok collision in Phase 1 (kerbs are visual only, grip loss handled by Physics). No collision events for kerbs.
- **GSM transition mid-collision**: If PostRace triggers while a collision event is being emitted, the event completes synchronously (Event Bus §Core Rules — synchronous dispatch).
- **Barrier mesh identification**: Collision must distinguish barriers from other static meshes. Track + Environment assigns barrier meshes to Havok collision filter group `BARRIER`. Collision checks the filter group on contact to set `otherId = 'barrier'`. No direct code dependency — both systems touch Havok's filter groups independently.

## Dependencies

| Dependency           | Type     | Notes                                                      |
| -------------------- | -------- | ---------------------------------------------------------- |
| Babylon.js + Havok   | Platform | Havok collision callbacks, mesh overlap detection          |
| Entity/Car Lifecycle | Upstream | CarEntity mesh references for Havok collision filter setup |
| Event Bus            | Upstream | All collision events flow through the bus                  |

## Tuning Knobs

| Knob                     | Namespace                   | Default | Range | Description                                                 |
| ------------------------ | --------------------------- | ------- | ----- | ----------------------------------------------------------- |
| Shake impulse threshold  | collision.shake_min_impulse | 1.0     | 0–10  | Minimum impulse (N·s) to emit a collision.impact event      |
| Grazing angle threshold  | collision.graze_angle_deg   | 5.0     | 1–30  | Angle (°) below which barrier contact is "grazing"          |
| Graze suppression frames | collision.graze_suppress    | 3       | 0–10  | Frames to wait before re-emitting for same car+barrier pair |

## Acceptance Criteria

1. Car↔car contact emits `collision.impact` with correct carId, otherId, impulse
2. Car↔barrier contact emits `collision.impact` with otherId = 'barrier'
3. Collision registers/unregisters with Havok on PreRace/PostRace GSM transitions
4. Multiple simultaneous contacts each produce individual events
5. Grazing barrier contact suppresses repeated events within `graze_suppress` frames
6. No damage, deformation, or mechanical consequence from any collision event in Phase 1
7. Camera shake is triggered only when `carId === playerCarId` — AI/opponent collisions never shake the player's camera
8. Audio plays thud/scrape for player collisions, and a muffled impact for non-player collisions within 30m proximity
9. Audio thud/scrape selection depends on car↔car vs car↔barrier
10. AI Driver receives `collision.impact` for its own contacts and can adapt behavior accordingly
11. Barrier meshes are distinguishable from other static meshes via Havok collision filter group

## Open Questions

- **TBD**: Car↔car contact resolution — does Havok's default push-apart feel right for arcade handling, or does it need custom response parameters?
- **TBD**: Should high-speed barrier impacts at >200 km/h trigger anything beyond shake + sound in Phase 1? (Currently no — cosmetic only)
- **TBD**: Damage threshold — what impulse value (N·s) should trigger mechanical failure in Alpha? Calibrated during playtesting with `collision.damage_threshold` knob.
