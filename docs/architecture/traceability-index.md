# Architecture Traceability Index

> **Last Updated:** 2026-08-01
> **Engine:** Unity 6000.3.19f1
> **ADRs:** 15 (0001–0015)

## Coverage Summary

- Total requirements assessed: 271
- Covered: 201 (74%)
- Partial: 20 (7%)
- Gaps: 46 (17%)

## Full Matrix

### Foundation Layer (95 TRs)

| TR-ID | GDD | Requirement | ADR | Status |
|-------|-----|-------------|-----|--------|
| TR-IN-1 | input-system.md | Two mutually exclusive action maps | ADR-0005 | ✅ |
| TR-IN-2 | input-system.md | InputContextController sole owner | ADR-0005 | ✅ |
| TR-IN-3 | input-system.md | Pause reserved across all contexts | ADR-0005 | ✅ |
| TR-IN-4 | input-system.md | Confirm/Cancel reserved in UI | ADR-0005 | ✅ |
| TR-IN-5 | input-system.md | CameraToggle presentation-only | ADR-0005 | ✅ |
| TR-IN-6 | input-system.md | ActiveControlScheme arbitration | ADR-0005 | ✅ |
| TR-IN-7 | input-system.md | Per-control dead zone profiles | ADR-0005 | ✅ |
| TR-IN-8 | input-system.md | EMA smoothing per channel | ADR-0005 | ✅ |
| TR-IN-9 | input-system.md | Brake priority | ADR-0005 | ✅ |
| TR-IN-10 | input-system.md | SimulationInput is sole gameplay-input contract | ADR-0005, ADR-0001 | ✅ |
| TR-IN-11 | input-system.md | CaptureLatestRawSample call ordering | ADR-0005, ADR-0001 | ✅ |
| TR-IN-12 | input-system.md | RawInputSample contract | ADR-0005 | ✅ |
| TR-IN-13 | input-system.md | Context handoff latching | ADR-0005 | ✅ |
| TR-IN-14 | input-system.md | Input availability | ADR-0005 | ✅ |
| TR-IN-15 | input-system.md | ProcessEventsInDynamicUpdate | ADR-0005, ADR-0001 | ✅ |
| TR-IN-16 | input-system.md | Remappable binding slots | ADR-0005 | ✅ |
| TR-IN-17 | input-system.md | SimulationInput is MVP-recordable boundary | ADR-0005 | ✅ |
| TR-IN-18 | input-system.md | Finished UI Pause (P/Start) | ADR-0005 | ✅ |
| TR-IN-19 | input-system.md | PitService Confirm routing | ADR-0005 | ✅ |
| TR-SA-1 | simulation-architecture.md | Fixed 60 Hz manual accumulator | ADR-0001 | ✅ |
| TR-SA-2 | simulation-architecture.md | Simulation driver runs in Update() | ADR-0001 | ✅ |
| TR-SA-3 | simulation-architecture.md | 13-step tick pipeline | ADR-0001 | ✅ |
| TR-SA-4 | simulation-architecture.md | CaptureLatestRawSample before accumulator | ADR-0001 | ✅ |
| TR-SA-5 | simulation-architecture.md | Render interpolation in LateUpdate() | ADR-0001 | ✅ |
| TR-SA-6 | simulation-architecture.md | Spiral-of-death clamp | ADR-0001 | ✅ |
| TR-SA-7 | simulation-architecture.md | Pause by skipping steps | ADR-0001 | ✅ |
| TR-SA-8 | simulation-architecture.md | SimulationState ownership | ADR-0001 | ✅ |
| TR-SA-9 | simulation-architecture.md | Countdown = 300 ticks | ADR-0001 | ✅ |
| TR-SA-10 | simulation-architecture.md | Qualifying enters Racing directly | ADR-0001 | ✅ |
| TR-SA-11 | simulation-architecture.md | ReplayInitialState at GO | ADR-0001 | ✅ |
| TR-SA-12 | simulation-architecture.md | PCG32 for all gameplay randomness | ADR-0001 | ✅ |
| TR-SA-13 | simulation-architecture.md | Unity.Mathematics for simulation math | ADR-0001 | ✅ |
| TR-SA-14 | simulation-architecture.md | No physics callbacks mutate gameplay state | ADR-0001 | ✅ |
| TR-SA-15 | simulation-architecture.md | Performance protection | ADR-0001 | ✅ |
| TR-SA-16 | simulation-architecture.md | Focus loss lifecycle boundary | ADR-0001 | ✅ |
| TR-SA-17 | simulation-architecture.md | Race Reconfigure | ADR-0001 | ✅ |
| TR-SA-18 | simulation-architecture.md | PostFinishSnapshot → FinishOrderResolver | ADR-0001 | ✅ |
| TR-SA-19 | simulation-architecture.md | MVP continuous record buffer always discarded | ADR-0001 | ✅ |
| TR-SA-20 | simulation-architecture.md | PhysX boundary = same executable/environment only | ADR-0001 | ✅ |
| TR-SA-21 | simulation-architecture.md | Performance gate before content expansion | ADR-0001 | ✅ |
| TR-SE-1 | settings.md | 6 setting categories | ADR-0004 | ✅ |
| TR-SE-2 | settings.md | PlayerPrefs JSON blob atomic persistence | ADR-0004 | ✅ |
| TR-SE-3 | settings.md | Schema migration v1→v3 | ADR-0004 | ✅ |
| TR-SE-4 | settings.md | DifficultyProfile immutable per race | ADR-0004 | ✅ |
| TR-SE-5 | settings.md | DifficultyProfile fields | ADR-0004 | ✅ |
| TR-SE-6 | settings.md | SettingsEditSession transactional model | ADR-0004 | ✅ |
| TR-SE-7 | settings.md | SettingsInputPreviewEvaluator | ADR-0004 | ✅ |
| TR-SE-8 | settings.md | DisplayConfirm 15s timer | ADR-0004 | ✅ |
| TR-SE-9 | settings.md | Control remapping flow | ADR-0004 | ✅ |
| TR-SE-10 | settings.md | 4 rebindable actions + stable IDs | ADR-0004 | ✅ |
| TR-SE-11 | settings.md | Override precedence | ADR-0004 | ✅ |
| TR-SE-12 | settings.md | Settings blocked during active Countdown | ADR-0004 | ✅ |
| TR-SE-13 | settings.md | Quality presets + Advanced | ADR-0004 | ✅ |
| TR-SE-14 | settings.md | Validated profile loading | ADR-0004 | ✅ |
| TR-CP-1 | content-pipeline.md | 3 Addressable group categories | ADR-0003 | ✅ |
| TR-CP-2 | content-pipeline.md | Parallel loading of track + 16 cars | ADR-0003 | ✅ |
| TR-CP-3 | content-pipeline.md | Min 0.5s loading screen | ADR-0003 | ✅ |
| TR-CP-4 | content-pipeline.md | First-launch catalog init | ADR-0003 | ✅ |
| TR-CP-5 | content-pipeline.md | CP_ state machine (7 states) | ADR-0003 | ✅ |
| TR-CP-6 | content-pipeline.md | CP_ prefix convention | ADR-0003 | ✅ |
| TR-CP-7 | content-pipeline.md | Race Reconfigure | ADR-0003 | ✅ |
| TR-CP-8 | content-pipeline.md | Memory budgets | ADR-0003 | ✅ |
| TR-CP-9 | content-pipeline.md | WebGL constraints | ADR-0003 | ✅ |
| TR-CP-10 | content-pipeline.md | Graceful degradation | ADR-0003 | ✅ |
| TR-CP-11 | content-pipeline.md | UnloadRace() before LoadRace() | ADR-0003 | ✅ |
| TR-CP-12 | content-pipeline.md | Addressables API only | ADR-0003 | ✅ |
| TR-CP-13 | content-pipeline.md | Loading blocks Cancel/Back | ADR-0003 | ✅ |
| TR-CP-14 | content-pipeline.md | Memory pressure threshold | ADR-0003 | ✅ |
| TR-GR-1 | ghost-recording.md | MVP recordable boundary only | ADR-0008 | ✅ |
| TR-GR-2 | ghost-recording.md | ReplayInitialState captured at GO | ADR-0008, ADR-0001 | ✅ |
| TR-GR-3 | ghost-recording.md | Continuous input stream | ADR-0008 | ✅ |
| TR-GR-4 | ghost-recording.md | Edge event stream | ADR-0008 | ✅ |
| TR-GR-5 | ghost-recording.md | 22,500 tick cap | ADR-0008 | ✅ |
| TR-GR-6 | ghost-recording.md | Binary format with 80-byte header | ADR-0008 | ✅ |
| TR-GR-7 | ghost-recording.md | CRC32 per 256-tick block | ADR-0008 | ✅ |
| TR-GR-8 | ghost-recording.md | LZ4 compression (Alpha) | ADR-0008 | ✅ |
| TR-GR-9 | ghost-recording.md | Alpha persistence gate | ADR-0008 | ✅ |
| TR-GR-10 | ghost-recording.md | Ghost visualization (Alpha) | ADR-0008 | ✅ |
| TR-GR-11 | ghost-recording.md | HUD ghost integration | ADR-0008 | ✅ |
| TR-GR-12 | ghost-recording.md | CloudStorage (Alpha) | ADR-0008 | ✅ |
| TR-GR-13 | ghost-recording.md | AI inputs not recorded | ADR-0008 | ✅ |
| TR-GR-14 | ghost-recording.md | Countdown Pause edges not recorded | ADR-0008 | ✅ |
| TR-MP-1 | multiplayer-architecture.md | MVP = offline only | — | ❌ Beta |
| TR-MP-2 | multiplayer-architecture.md | Alpha = async CloudStorage | — | ❌ Beta |
| TR-MP-3 | multiplayer-architecture.md | Beta = real-time multiplayer | — | ❌ Beta |
| TR-MP-4 | multiplayer-architecture.md | Build-time network phase | — | ❌ Beta |
| TR-MP-5 | multiplayer-architecture.md | Simulation loop independence | ADR-0001 | ✅ |
| TR-MP-6 | multiplayer-architecture.md | Beta NetworkInput packet format | — | ❌ Beta |
| TR-MP-7 | multiplayer-architecture.md | GGPO-style rollback | — | ❌ Beta |
| TR-MP-8 | multiplayer-architecture.md | Coherence relay model | — | ❌ Beta |
| TR-MP-9 | multiplayer-architecture.md | Disconnection handling | — | ❌ Beta |
| TR-MP-10 | multiplayer-architecture.md | No global leaderboard | — | ❌ Beta |
| TR-MP-11 | multiplayer-architecture.md | 16-player rooms | — | ❌ Beta |
| TR-MP-12 | multiplayer-architecture.md | Bandwidth estimation | — | ❌ Beta |
| TR-MP-13 | multiplayer-architecture.md | Ghost data flow input-only | — | ❌ Beta |

### Core Layer (112 TRs)

| TR-ID | GDD | Requirement | ADR | Status |
|-------|-----|-------------|-----|--------|
| TR-VP-1 | vehicle-physics.md | 60 Hz fixed physics timestep | ADR-0001, ADR-0002 | ✅ |
| TR-VP-2 | vehicle-physics.md | 6 data-driven car stats | ADR-0002 | ✅ |
| TR-VP-3 | vehicle-physics.md | Analog throttle/brake | ADR-0002, ADR-0005 | ✅ |
| TR-VP-4 | vehicle-physics.md | Grip multiplicative formula | ADR-0002 | ✅ |
| TR-VP-5 | vehicle-physics.md | Car states | ADR-0002 | ✅ |
| TR-VP-6 | vehicle-physics.md | Per-tick CarState snapshot | ADR-0002 | ✅ |
| TR-VP-7 | vehicle-physics.md | Lift-off rotation mechanic | ADR-0002 | ✅ |
| TR-VP-8 | vehicle-physics.md | High-speed steer reduction | ADR-0002 | ✅ |
| TR-VP-9 | vehicle-physics.md | Wall contact behavior | ADR-0002 | ✅ |
| TR-VP-10 | vehicle-physics.md | GridLocked + Perfect Start | ADR-0001, ADR-0002 | ✅ |
| TR-VP-11 | vehicle-physics.md | Difficulty offtrack/wall | ADR-0002, ADR-0004 | ✅ |
| TR-VP-12 | vehicle-physics.md | Fuel/tire ownership | ADR-0002, ADR-0006 | ✅ |
| TR-VP-13 | vehicle-physics.md | Pit lane speed limit | ADR-0007, ADR-0011 | ✅ |
| TR-VP-14 | vehicle-physics.md | Car-to-car collision | ADR-0002 | ✅ |
| TR-FUEL-1 | fuel-system.md | Fixed 8.0L tank | ADR-0002, ADR-0006 | ✅ |
| TR-FUEL-2 | fuel-system.md | fuel_rate formula | ADR-0006 | ✅ |
| TR-FUEL-3 | fuel-system.md | Fuel states | ADR-0006 | ✅ |
| TR-FUEL-4 | fuel-system.md | Empty fuel behavior | ADR-0002, ADR-0006 | ✅ |
| TR-FUEL-5 | fuel-system.md | Low fuel speed bonus | ADR-0002, ADR-0006 | ✅ |
| TR-FUEL-6 | fuel-system.md | Pit refuel rate | ADR-0006, ADR-0011 | ✅ |
| TR-FUEL-7 | fuel-system.md | Player early exit | ADR-0011 | ✅ |
| TR-FUEL-8 | fuel-system.md | No consumption during Countdown | ADR-0001, ADR-0006 | ✅ |
| TR-FUEL-9 | fuel-system.md | LapCompleted snapshot | ADR-0006 | ✅ |
| TR-FUEL-10 | fuel-system.md | Difficulty doesn't modify fuel | ADR-0004 | ⚠️ |
| TR-FUEL-11 | fuel-system.md | Qualifying fuel load | ADR-0006 | ✅ |
| TR-FUEL-12 | fuel-system.md | Efficiency stat corruption | ADR-0006 | ⚠️ |
| TR-TIRE-1 | tire-system.md | Continuous linear wear | ADR-0006 | ✅ |
| TR-TIRE-2 | tire-system.md | Wear drivers | ADR-0006 | ✅ |
| TR-TIRE-3 | tire-system.md | Tire wear rate formula | ADR-0006 | ✅ |
| TR-TIRE-4 | tire-system.md | Runtime grip multiplier | ADR-0002, ADR-0006 | ✅ |
| TR-TIRE-5 | tire-system.md | One MVP compound | ADR-0006 | ⚠️ |
| TR-TIRE-6 | tire-system.md | Tire swap binary, 2s | ADR-0006, ADR-0011 | ✅ |
| TR-TIRE-7 | tire-system.md | Reads from TickStartSnapshot | ADR-0006 | ✅ |
| TR-TIRE-8 | tire-system.md | Efficiency stat corruption | ADR-0006 | ⚠️ |
| TR-TIRE-9 | tire-system.md | HUD wear thresholds | — | ❌ |
| TR-TIRE-10 | tire-system.md | Difficulty doesn't modify tire | ADR-0004 | ⚠️ |
| TR-TIRE-11 | tire-system.md | No tire wear Countdown/Qualifying | ADR-0006 | ✅ |
| TR-TRACK-1 | track-system.md | Track stored as JSON | ADR-0007 | ✅ |
| TR-TRACK-2 | track-system.md | Surface types with modifiers | ADR-0006, ADR-0007 | ✅ |
| TR-TRACK-3 | track-system.md | Pit lane two-lane F1 model | ADR-0007 | ✅ |
| TR-TRACK-4 | track-system.md | Pit-entry zone trigger | ADR-0007, ADR-0011 | ✅ |
| TR-TRACK-5 | track-system.md | Grid 16 positions | ADR-0007 | ✅ |
| TR-TRACK-6 | track-system.md | Lap counting | ADR-0007 | ✅ |
| TR-TRACK-7 | track-system.md | Anti-cut 90% minimum distance | — | ❌ |
| TR-TRACK-8 | track-system.md | Track scaling 1 unit = 1 meter | ADR-0007 | ✅ |
| TR-TRACK-9 | track-system.md | Pit lane progress mapping | ADR-0007 | ✅ |
| TR-TRACK-10 | track-system.md | Track generation pipeline | ADR-0007 | ⚠️ |
| TR-TRACK-11 | track-system.md | Validation errors | ADR-0007 | ✅ |
| TR-CAR-1 | car-definition-data.md | 16 F1 teams, 6 stats | ADR-0002 | ✅ |
| TR-CAR-2 | car-definition-data.md | Weight constant 505 kg | ADR-0002 | ✅ |
| TR-CAR-3 | car-definition-data.md | Stat-to-behavior mapping | ADR-0002 | ✅ |
| TR-CAR-4 | car-definition-data.md | Per-car audio profile fields | — | ❌ |
| TR-CAR-5 | car-definition-data.md | Storage as ScriptableObject | ADR-0002, ADR-0003 | ✅ |
| TR-CAR-6 | car-definition-data.md | Tier gap ~4-point average | — | ❌ |
| TR-CAR-7 | car-definition-data.md | Fallback on corruption | ADR-0002 | ⚠️ |
| TR-CAR-8 | car-definition-data.md | Difficulty never mutates car stats | ADR-0001 | ✅ |
| TR-RSM-1 | race-session-manager.md | Race state fields | ADR-0001 | ✅ |
| TR-RSM-2 | race-session-manager.md | Position ranking formula | — | ❌ |
| TR-RSM-3 | race-session-manager.md | Lap detection | ADR-0007 | ✅ |
| TR-RSM-4 | race-session-manager.md | Finish conditions | ADR-0001 | ✅ |
| TR-RSM-5 | race-session-manager.md | PostFinishSnapshot + FinishOrderResolver | ADR-0001 | ✅ |
| TR-RSM-6 | race-session-manager.md | Forfeit handling | ADR-0001 | ⚠️ |
| TR-RSM-7 | race-session-manager.md | Race events | ADR-0001 | ⚠️ |
| TR-RSM-8 | race-session-manager.md | GridAssignment immutable | ADR-0001 | ✅ |
| TR-RSM-9 | race-session-manager.md | State machine | ADR-0001 | ✅ |
| TR-RSM-10 | race-session-manager.md | Transition rules | ADR-0001 | ✅ |
| TR-RSM-11 | race-session-manager.md | raceTime starts at GO | ADR-0001 | ✅ |
| TR-AI-1 | ai-rival.md | Per-tick decision loop | ADR-0009 | ✅ |
| TR-AI-2 | ai-rival.md | Target speed formula | ADR-0009 | ✅ |
| TR-AI-3 | ai-rival.md | Racing line following | ADR-0009 | ✅ |
| TR-AI-4 | ai-rival.md | AI states | ADR-0009 | ✅ |
| TR-AI-5 | ai-rival.md | Overtaking logic | ADR-0009 | ✅ |
| TR-AI-6 | ai-rival.md | Defending logic | ADR-0009 | ✅ |
| TR-AI-7 | ai-rival.md | Error generation | ADR-0009 | ✅ |
| TR-AI-8 | ai-rival.md | Pit strategy | ADR-0009, ADR-0011 | ✅ |
| TR-AI-9 | ai-rival.md | 4 personality archetypes | ADR-0009 | ✅ |
| TR-AI-10 | ai-rival.md | 5 Difficulty profiles | ADR-0004, ADR-0009 | ✅ |
| TR-AI-11 | ai-rival.md | No active obstacle avoidance | ADR-0009 | ✅ |
| TR-AI-12 | ai-rival.md | Difficulty through competence | ADR-0001, ADR-0009 | ✅ |
| TR-Q-1 | qualifying.md | Single flying lap | ADR-0001 | ✅ |
| TR-Q-2 | qualifying.md | Computed fuel load | ADR-0006 | ✅ |
| TR-Q-3 | qualifying.md | No tire wear | ADR-0006 | ✅ |
| TR-Q-4 | qualifying.md | Terminal presentation | ADR-0001 | ✅ |
| TR-Q-5 | qualifying.md | AI times deterministic | ADR-0009 | ✅ |
| TR-Q-6 | qualifying.md | Tier modifiers | ADR-0009 | ✅ |
| TR-Q-7 | qualifying.md | Skip → P16, failed → P16 | — | ❌ |
| TR-Q-8 | qualifying.md | Grid position ranking | ADR-0001 | ✅ |
| TR-Q-9 | qualifying.md | Pit entry blocked | ADR-0011 | ✅ |
| TR-Q-10 | qualifying.md | Terminal flow | ADR-0001 | ✅ |
| TR-PIT-1 | pit-stop.md | Pit trigger | ADR-0002, ADR-0011 | ✅ |
| TR-PIT-2 | pit-stop.md | Sequence | ADR-0011 | ✅ |
| TR-PIT-3 | pit-stop.md | Service duration formula | ADR-0011 | ✅ |
| TR-PIT-4 | pit-stop.md | Tire swap binary, 2s | ADR-0006, ADR-0011 | ✅ |
| TR-PIT-5 | pit-stop.md | AI waits for full tank | ADR-0011 | ✅ |
| TR-PIT-6 | pit-stop.md | Pit states | ADR-0011 | ✅ |
| TR-PIT-7 | pit-stop.md | Player advisory | ADR-0011 | ✅ |
| TR-PIT-8 | pit-stop.md | Warning start progress | ADR-0011 | ✅ |
| TR-PIT-9 | pit-stop.md | No driving consumption during pit | ADR-0011 | ✅ |
| TR-PIT-10 | pit-stop.md | All 16 boxes simultaneous | ADR-0007, ADR-0011 | ✅ |
| TR-PIT-11 | pit-stop.md | Pit entry blocked during qualifying | ADR-0011 | ✅ |
| TR-GS-1 | grid-start.md | 16 cars, 2-wide formation | ADR-0007 | ✅ |
| TR-GS-2 | grid-start.md | Column stagger | ADR-0007 | ✅ |
| TR-GS-3 | grid-start.md | Countdown 300 ticks | ADR-0001 | ✅ |
| TR-GS-4 | grid-start.md | Perfect Start conditions | ADR-0002, ADR-0005 | ✅ |
| TR-GS-5 | grid-start.md | Grid lock | ADR-0001, ADR-0002 | ✅ |
| TR-GS-6 | grid-start.md | AI launches | ADR-0009 | ✅ |
| TR-GS-7 | grid-start.md | Qualifying Results screen | — | ❌ |
| TR-GS-8 | grid-start.md | GridAssignment immutable | ADR-0001 | ✅ |

### Presentation Layer (64 TRs)

| TR-ID | GDD | Requirement | ADR | Status |
|-------|-----|-------------|-----|--------|
| TR-CAM-1 | camera.md | Two modes (Cockpit default, Chase) | ADR-0010 | ✅ |
| TR-CAM-2 | camera.md | Cockpit offset and rotation | ADR-0010 | ✅ |
| TR-CAM-3 | camera.md | Chase follow behavior | ADR-0010 | ✅ |
| TR-CAM-4 | camera.md | CameraToggle input | ADR-0005, ADR-0010 | ✅ |
| TR-CAM-5 | camera.md | FOV response formula | ADR-0010 | ⚠️ |
| TR-CAM-6 | camera.md | FOV ranges | ADR-0010 | ⚠️ |
| TR-CAM-7 | camera.md | Three shake layers | ADR-0010 | ⚠️ |
| TR-CAM-8 | camera.md | Look-ahead formula | — | ❌ |
| TR-CAM-9 | camera.md | Collision avoidance | — | ❌ |
| TR-CAM-10 | camera.md | Reduced Motion support | ADR-0010 | ✅ |
| TR-CAM-11 | camera.md | Transition blending | ADR-0010 | ✅ |
| TR-CAM-12 | camera.md | TerminalPresentation | ADR-0001, ADR-0010 | ✅ |
| TR-CAM-13 | camera.md | PitCamera | ADR-0010, ADR-0011 | ✅ |
| TR-CAM-14 | camera.md | Vertical follow + anti-nausea | — | ❌ |
| TR-HUD-1 | hud.md | Chase HUD 7 elements | — | ❌ |
| TR-HUD-2 | hud.md | Cockpit HUD 4 elements + overlay | — | ❌ |
| TR-HUD-3 | hud.md | Reading speed budget | — | ❌ |
| TR-HUD-4 | hud.md | Color state | — | ❌ |
| TR-HUD-5 | hud.md | Font sizes | — | ❌ |
| TR-HUD-6 | hud.md | Team cosmetic theming | — | ❌ |
| TR-HUD-7 | hud.md | HUD states | — | ❌ |
| TR-HUD-8 | hud.md | Track Map | ADR-0007 | ⚠️ |
| TR-HUD-9 | hud.md | PIT THIS LAP advisory | ADR-0011 | ✅ |
| TR-HUD-10 | hud.md | Rival gap display | — | ❌ |
| TR-HUD-11 | hud.md | Settings consumption | ADR-0004 | ✅ |
| TR-HUD-12 | hud.md | No Input Device overlay | ADR-0005 | ⚠️ |
| TR-AUDIO-1 | audio-system.md | 5 audio layers | — | ❌ |
| TR-AUDIO-2 | audio-system.md | Procedural engine | — | ❌ |
| TR-AUDIO-3 | audio-system.md | Engine + SFX share mixer | — | ❌ |
| TR-AUDIO-4 | audio-system.md | Tire squeal formula | — | ❌ |
| TR-AUDIO-5 | audio-system.md | Fuel factor curve | — | ❌ |
| TR-AUDIO-6 | audio-system.md | Engine cut at 0% fuel | — | ❌ |
| TR-AUDIO-7 | audio-system.md | Music stings | — | ❌ |
| TR-AUDIO-8 | audio-system.md | SFX categories | — | ❌ |
| TR-AUDIO-9 | audio-system.md | Off-track audio | — | ❌ |
| TR-AUDIO-10 | audio-system.md | State audio | — | ❌ |
| TR-AUDIO-11 | audio-system.md | Settings volumes | ADR-0004 | ⚠️ |
| TR-VFX-1 | vfx.md | VFX categories | ADR-0010 | ✅ |
| TR-VFX-2 | vfx.md | Speed normalized | ADR-0010 | ✅ |
| TR-VFX-3 | vfx.md | Speed streaks formula | ADR-0010 | ✅ |
| TR-VFX-4 | vfx.md | Motion blur formula | ADR-0010 | ✅ |
| TR-VFX-5 | vfx.md | Vignette formula | ADR-0010 | ⚠️ |
| TR-VFX-6 | vfx.md | Tire smoke | ADR-0010 | ✅ |
| TR-VFX-7 | vfx.md | Sparks | ADR-0010 | ✅ |
| TR-VFX-8 | vfx.md | Impact Shake Request | ADR-0010 | ✅ |
| TR-VFX-9 | vfx.md | 4 density presets | ADR-0010 | ⚠️ |
| TR-VFX-10 | vfx.md | Total VFX budget | ADR-0010 | ✅ |
| TR-VFX-11 | vfx.md | Same intensity cockpit/chase | — | ❌ |
| TR-VFX-12 | vfx.md | PerformanceReduced → Low | ADR-0010 | ✅ |
| TR-VFX-13 | vfx.md | Reduced Motion → Motion Blur off | ADR-0010 | ✅ |
| TR-VFX-14 | vfx.md | No speed VFX in pit/menu | — | ❌ |
| TR-UI-1 | ui-menu.md | Screen flow | — | ❌ |
| TR-UI-2 | ui-menu.md | Navigation | ADR-0005 | ✅ |
| TR-UI-3 | ui-menu.md | Linear stack navigation | — | ❌ |
| TR-UI-4 | ui-menu.md | Pause Menu | ADR-0001, ADR-0005 | ⚠️ |
| TR-UI-5 | ui-menu.md | Finished Presentation | ADR-0001 | ✅ |
| TR-UI-6 | ui-menu.md | Qualifying Results | ADR-0001 | ⚠️ |
| TR-UI-7 | ui-menu.md | Race Results | ADR-0001 | ⚠️ |
| TR-UI-8 | ui-menu.md | Settings integration | ADR-0004, ADR-0005 | ✅ |
| TR-UI-9 | ui-menu.md | Car Selection turntable | — | ❌ |
| TR-UI-10 | ui-menu.md | Track Selection cards | — | ❌ |
| TR-UI-11 | ui-menu.md | Difficulty disabled in Pause | ADR-0004 | ✅ |
| TR-UI-12 | ui-menu.md | Content pipeline integration | ADR-0003 | ✅ |
| TR-UI-13 | ui-menu.md | Confirm/Cancel not remappable | ADR-0005 | ✅ |

## Known Gaps

### Non-blocking (Presentation layer, resolved during story creation)

| Priority | System | Gap | Suggested ADR |
|----------|--------|-----|---------------|
| Low | Audio | 10 TRs: entire audio architecture | Audio ADR or resolved in implementation |
| Low | HUD | 8 TRs: layout, states, theming, fonts | HUD ADR or resolved in implementation |
| Low | Camera | 2 TRs: look-ahead, collision avoidance | Camera ADR or resolved in implementation |
| Low | VFX | 2 TRs: vignette formula, pit/menu gating | VFX ADR or resolved in implementation |
| Low | UI Menu | 4 TRs: screen flow, navigation, selection | UI ADR or resolved in implementation |

### Must fix before coding

| ADR | Issue | Fix |
|-----|-------|-----|
| ADR-0006 | FuelSystem.Tick missing TickStartSnapshot | Add parameter |
| ADR-0006 | Pipeline numbering 13 vs 14 | Adopt 14-step |
| ADR-0011 | Claims "13 steps unchanged" but adds 9b+14 | Correct claim |
| ADR-0011 | No performance budget | Declare ~0.05ms |
| ADR-0001 | PerformanceReduced signal undocumented | Add obligation |
| ADR-0004 | Screen.SetResolution overload | Specify FullScreenMode |

## History

| Date | Covered % | ADRs | Notes |
|------|-----------|------|-------|
| 2026-07-27 | 42% | 6 | Initial review. Foundation ADRs complete. |
| 2026-07-28 | 74% | 11 | Full review. All layers covered. 2 HIGH conflicts found. |
| 2026-08-01 | 74% | 15 | New ADRs 0013-0015 Accepted. 5 TR-IDs created (TR-qual-004..006, TR-car-003..004). 12 corrections applied (A1/A2/M1/M2/L1-L5/S2 + bonus). PASS. |
