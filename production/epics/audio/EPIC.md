# Epic: Audio

> **Layer**: Presentation (slot #16 — final MVP system, depends on Physics + Collision + Asset Manager)
> **GDD**: design/gdd/audio.md
> **Architecture Module**: Presentation — Audio
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories audio`

## Overview

Audio Engine V2 exclusively — `CreateSoundAsync`, `CreateAudioBusAsync`, `CreateSoundSourceAsync`, `CreateStreamingSoundAsync`. NO legacy `Sound` class (deprecated since v8.0). 4 AudioBuses: music (0.5), sfx (0.7), ui (0.6), ambient (0.4). Hybrid engine sound: WAV loop (2-4s `StaticSound` for `playbackRate` pitch shift) + OscillatorNode overlay via `CreateSoundSourceAsync` on same `sfxBus`. Engine sound from 60Hz direct Physics reads (rpm, speed, throttle, lateralG, gear). 500ms linear crossfade via `setVolume` on GSM state changes. `maxInstances: 5` for collisions (pooled natively). Context unlock via `resumeOnInteraction`/`unlockAsync`.

> ⚠️ **Spike story required**: Before implementing the 10 TRs below, run a 1-day timeboxed spike to verify the 5 Audio Engine V2 APIs work as expected in Babylon.js 9.12.0. See spike story details in `/create-stories audio`.

## Governing ADRs

| ADR                    | Decision Summary                                                                         | Engine Risk |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| ADR-0020: Audio Engine | Audio Engine V2 only, 4 AudioBuses, hybrid WAV+Oscillator, 500ms crossfade, maxInstances | HIGH        |

## GDD Requirements

| TR-ID        | Requirement                                                                                     | ADR Coverage |
| ------------ | ----------------------------------------------------------------------------------------------- | ------------ |
| TR-AUDIO-001 | Engine sound: pitch varies with RPM/throttle in real-time — WAV loop + OscillatorNode on sfxBus | ADR-0020 ✅  |
| TR-AUDIO-002 | Tire squeal on high lateralG — graze suppressed                                                 | ADR-0020 ✅  |
| TR-AUDIO-003 | Collision impacts: thud (car-car) / scrape (barrier) proportional to impulse                    | ADR-0020 ✅  |
| TR-AUDIO-004 | UI sounds: menu navigation confirm/cancel                                                       | ADR-0020 ✅  |
| TR-AUDIO-005 | Music: menu BGM, race start jingle, podium fanfare                                              | ADR-0020 ✅  |
| TR-AUDIO-006 | 4 AudioBuses with independent volume: music (0.5), sfx (0.7), ui (0.6), ambient (0.4)           | ADR-0020 ✅  |
| TR-AUDIO-007 | 500ms linear crossfade between GSM states via setVolume with duration                           | ADR-0020 ✅  |
| TR-AUDIO-008 | Engine sound mutes when car is in pit stop (pit limiter)                                        | ADR-0020 ✅  |
| TR-AUDIO-009 | maxInstances for collision sounds (default: 5)                                                  | ADR-0020 ✅  |
| TR-AUDIO-010 | Context unlock on first user interaction (resumeOnInteraction)                                  | ADR-0020 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/audio.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`
- Audio Engine V2 spike story completed and all APIs verified in target engine version

## Next Step

Run `/create-stories audio` to break this epic into implementable stories.
