# Prototype: Race Feel

**Status:** In progress
**Core question:** Is the arcade grip (Vehicle Physics, ADR-0002) fun and responsive enough to sustain the 30-second loop (Pillar 2)?
**Date:** 2026-08-01
**Review mode:** full

## What This Tests

1. **Grip model (P1 — Speed You Can Feel):** the grip stack formula (grip_base × surface × tire × control, clamp 0.20–1.20) translated into motion. Does the car slide in a fun, recoverable way?
2. **Responsiveness:** input → EMA → force → movement. Is the perceived latency acceptable?
3. **Loop structure (P2):** countdown → GO → 2 complete laps → finish. Lap timing is measured on a clean pass at full speed (first crossing after lap 1).

## What It Does NOT Test

AI rivals, pit stop, qualifying, fuel/tire, VFX, audio, settings, 16 cars, Addressables, multiplayer, ghost.

## How to Run

1. Open `Assets/Prototype/RaceFeel/` scene in Unity 6000.3.19f1 (URP).
2. Press Play.
3. Drive with WASD (steer = A/D, throttle = W, brake = S) or gamepad.
4. Complete 2 laps; the prototype reports lap times and ends.

## File Map

| File | Purpose |
|------|---------|
| `Assets/Prototype/RaceFeel/RaceFeelController.cs` | Orchestrates countdown → 2 laps → finish |
| `Assets/Prototype/RaceFeel/ArcadeCar.cs` | Rigidbody + grip stack (ADR-0002) |
| `Assets/Prototype/RaceFeel/PrototypeTrack.cs` | Simple procedural track |
| `Assets/Prototype/RaceFeel/MinimalHud.cs` | Speed + lap + time |

## Results

See `REPORT.md`.
