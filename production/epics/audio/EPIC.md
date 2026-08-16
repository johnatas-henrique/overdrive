# Epic: Audio

> **Layer**: Core + Presentation
> **GDD**: design/gdd/audio-system.md
> **Architecture Module**: Audio presentation (procedural engine synthesis via `IEngineSoundProvider`; Unity Audio Mixer routing; ADR-0012)
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories audio`
> **Estimate**: 3 stories (~8h active — calibrated 0.3×, sprint-3 retrospective)
> **Session**: S2 · Phase 3 (2-orchestrator plan 2026-08-16)
> **Depends on**: vehicle-physics-feel (RPM telemetry — TR-audio-001); car-definition-data (CarAudioProfile per team — CW4); Settings (audio levels through the mixer — settings epic done); ADR-0012. S2 Phase-3 consumer — the single biggest remaining feel gap per prototype findings.

## Overview

The audio system: procedural two-oscillator engine sound deriving base frequency from RPM × EngineCylinders / 120 (with the derivative-pitch and volume curves); 4 music stings (Race Start, Final Lap, Finish, Pit Entry — duck background 6dB); tire squeal (volume/pitch rise with wear, constant 1200 Hz base); Master/Music/SFX/UI level routing through the Unity Audio Mixer following the settings blob (audio schema from the settings epic — 3-7 values contract); `IEngineSoundProvider` seam permitting procedural/sample replacement with safe parameter passing. Engine sound is the prototype's flagged biggest feel gap — engine-sound playtest evidence is a milestone criterion (CD-PLAYTEST).

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0012: Audio System Architecture | Procedural engine synthesis + provider seam; mixer routing; music sting/ducking policy | MEDIUM |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage |
|-------|-------------|--------------|
| TR-audio-001 | Procedural two-oscillator engine: base frequency from RPM × EngineCylinders / 120; derivative pitch/volume curves | ADR-0012 ✅ |
| TR-audio-002 | 4 music stings: Race Start, Final Lap, Finish, Pit Entry; duck background 6dB | ADR-0012 ✅ |
| TR-audio-003 | Tire squeal: volume rises with wear, pitch constant 1200 Hz, frequency rises with wear | ADR-0012 ✅ |
| TR-audio-004 | Master/Music/SFX/UI route through the Unity Audio Mixer; follow Simulation/settings levels | ADR-0012 ✅ |
| TR-audio-005 | IEngineSoundProvider permits procedural/sample replacement; safe parameter passing to Unity Audio | ADR-0012 ✅ |

**Untraced requirements**: None — 5/5 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria of `design/gdd/audio-system.md` are verified
- Engine sound verified in the dev rig (RPM-coupled synthesis) with audio evidence — milestone CD-PLAYTEST criterion
- CarAudioProfile per team verified against car-definition-data contract
- Settings audio levels verified through the mixer (settings 3-2..3-7 blob)
- All Visual/Feel stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories audio` to break this epic into implementable stories.