# Epic: Audio

> **Layer**: Presentation (slot #16 — final MVP system, depends on Physics + Collision + Asset Manager)
> **GDD**: design/gdd/audio.md
> **Architecture Module**: Presentation — Audio
> **Status**: Ready
> **Stories**: 11 stories (Ready) — run `/story-readiness` to begin implementation

## Overview

Audio Engine V2 exclusively — `CreateSoundAsync`, `CreateAudioBusAsync`, `CreateSoundSourceAsync`, `CreateStreamingSoundAsync`. NO legacy `Sound` class (deprecated since v8.0). 4 AudioBuses: music (0.5), sfx (0.7), ui (0.6), ambient (0.4). Hybrid engine sound: WAV loop (2-4s `StaticSound` for `playbackRate` pitch shift) + OscillatorNode overlay via `CreateSoundSourceAsync` on same `sfxBus`. Engine sound from 60Hz direct Physics reads (rpm, speed, throttle, lateralG, gear). 500ms linear crossfade via `setVolume` on GSM state changes. `maxInstances: 5` for collisions (pooled natively). Context unlock via `resumeOnInteraction`/`unlockAsync`.

> ⚠️ **Spike story required**: Before implementing the 10 TRs below, run a 1-day timeboxed spike to verify the 5 Audio Engine V2 APIs work as expected in Babylon.js 9.12.0. See spike story details in `/create-stories audio`.

## Governing ADRs

| ADR                    | Decision Summary                                                                         | Engine Risk |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| ADR-0020: Audio Engine | Audio Engine V2 only, 4 AudioBuses, hybrid WAV+Oscillator, 500ms crossfade, maxInstances | HIGH        |

## GDD Requirements

| TR-ID        | Requirement                                                                                                 | ADR Coverage |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ------------ |
| TR-AUDIO-001 | Audio Engine V2 — CreateAudioEngineAsync() initialises the engine; try/catch on failure silences gracefully | ADR-0020 ✅  |
| TR-AUDIO-002 | Audio Asset Manager — CreateSoundAsync() for sample-based SFX (engine loops, collisions); cached in Map     | ADR-0020 ✅  |
| TR-AUDIO-003 | Four AudioBus instances: music (0.5), sfx (0.7), ui (0.6), ambient (0.4) via CreateAudioBusAsync            | ADR-0020 ✅  |
| TR-AUDIO-004 | GSM event subscription — play music on Menu/PostRace; stop race playlist on pause; resume on unpause        | ADR-0020 ✅  |
| TR-AUDIO-005 | Race event subscription — collision.impact, gear.up/down, lap.complete, checkered fanfare                   | ADR-0020 ✅  |
| TR-AUDIO-006 | Car engine oscillator per active car — OscillatorNode synthesised from rpm, gear, throttle                  | ADR-0020 ✅  |
| TR-AUDIO-007 | Volumes persisted per category (user preference) — 0..1 range, independent per AudioBus                     | ADR-0020 ✅  |
| TR-AUDIO-008 | Race Again: stopAll(), dispose and re-create engine oscillator nodes; SoundSource samples disposed          | ADR-0020 ✅  |
| TR-AUDIO-009 | maxInstances for collision sounds — default 5; oldest instance auto-stopped; no custom pooling              | ADR-0020 ✅  |
| TR-AUDIO-010 | Audio context unlock on first user interaction — resumeOnInteraction: true; unlockAsync() for programmatic  | ADR-0020 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/audio.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`
- Audio Engine V2 spike story completed and all APIs verified in target engine version

## Stories

| #    | Story                                 | Type        | Status | ADR      |
| ---- | ------------------------------------- | ----------- | ------ | -------- |
| 000  | Audio Engine V2 API Spike             | Integration | Ready  | ADR-0020 |
| 001  | Engine Init & Context Unlock          | Integration | Ready  | ADR-0020 |
| 009  | Audio Config & Bus Creation           | Config/Data | Ready  | ADR-0020 |
| 003a | Engine Sound — WAV & Oscillator Setup | Logic       | Ready  | ADR-0020 |
| 003b | Engine Sound — 60Hz Runtime           | Integration | Ready  | ADR-0020 |
| 004  | Tire Squeal with Wear Modifier        | Logic       | Ready  | ADR-0020 |
| 005  | Collision Sound System                | Integration | Ready  | ADR-0020 |
| 006  | Pit Lane & Wind Ambient               | Logic       | Ready  | ADR-0020 |
| 007  | GSM Audio State Machine & Crossfade   | Integration | Ready  | ADR-0020 |
| 008  | Menu Music & Race Event Sounds        | Integration | Ready  | ADR-0020 |
| 010  | Race Again Cleanup                    | Integration | Ready  | ADR-0020 |

## Next Step

Run `/story-readiness production/epics/audio/story-000-audio-v2-spike.md` → `/dev-story` to begin implementation.
