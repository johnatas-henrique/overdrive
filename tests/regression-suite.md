# Regression Suite Manifest

> Last Updated: 2026-06-30
> Total registered tests: 39
> Total assertions: 4020
> Coverage: 100% of implemented systems (12/24 MVP systems)

## How to run

```bash
npx vitest run
```

## Registered Regression Tests

### Foundation — Data & Config Manager

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/foundation/config/config-manager.test.ts`   | 169        | Namespace isolation, env overrides, get/set | 2026-06-26 |
| `tests/unit/foundation/config/hmr.test.ts`              | 10         | Hot module replacement wiring   | 2026-06-26 |

### Foundation — Event Bus

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/foundation/event-bus/event-bus.test.ts`    | 194        | Typed pub-sub, error isolation, wildcard, leak detection | 2026-06-26 |

### Foundation — Game State Machine

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/foundation/gsm/game-state-machine.test.ts` | 320        | Transition table, lifecycle hooks, history, queue | 2026-06-26 |

### Foundation — Persistence

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/foundation/persistence/persistence.test.ts` | 298        | Save/load, versioned payloads, degraded mode, migrations | 2026-06-26 |

### Foundation — Simulation Snapshot

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/foundation/simulation-snapshot/simulation-snapshot.test.ts` | 305 | ISnapshotable, fnv1a/sha256, register/restore | 2026-06-26 |

### Foundation — Determinism Contract

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/foundation/determinism/determinism.test.ts` | 359        | Accumulator, dev-guard, pipeline, seeded-random | 2026-06-26 |

### Core — Asset Manager

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/asset-manager/asset-manager.test.ts`       | 148        | State machine, manifest registry, cache, load | 2026-06-29 |
| `tests/integration/asset-manager/asset-manager-lifecycle.test.ts` | 46 | Full lifecycle, init/dispose | 2026-06-29 |
| `tests/integration/asset-manager/gsm-orchestration.test.ts` | 20 | GSM-driven scene switching | 2026-06-29 |
| `tests/integration/asset-manager/preload-concurrency.test.ts` | 39 | Concurrent preload deduplication | 2026-06-29 |

### Core — Dev Tools

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/core/dev-tools/dev-tools.test.ts`         | 180        | Overlay toggle, metrics, DOM creation | 2026-06-27 |
| `tests/unit/core/dev-tools/dev-tools-singleton.test.ts` | 11       | Singleton proxy, reset         | 2026-06-27 |
| `tests/unit/core/dev-tools/dev-compile-guard.test.ts`  | 14         | DEV guard, production noop     | 2026-06-27 |
| `tests/unit/core/dev-tools/keybinds.test.ts`           | 33         | Keyboard keybind registration  | 2026-06-27 |
| `tests/integration/core/dev-tools/event-bus-inspector.test.ts` | 87 | Wildcard capture, ring buffer, filter | 2026-06-27 |
| `tests/integration/core/dev-tools/config-tree.test.ts` | 93         | Config namespace tree, in-place edit | 2026-06-27 |
| `tests/integration/core/dev-tools/gsm-visualizer.test.ts` | 106    | State transitions, manual buttons | 2026-06-27 |
| `tests/integration/core/dev-tools/sim-snapshot-panel.test.ts` | 96 | Systems list, hashes, Take/Restore | 2026-06-27 |
| `tests/integration/core/dev-tools/ai-telemetry-panel.test.ts` | 94 | Per-car telemetry, sample-rate throttle | 2026-06-28 |

### Core — Input

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/core/input/i-input.test.ts`               | 56         | Interface types, InputState.ZERO | 2026-06-29 |
| `tests/unit/core/input/dead-zone.test.ts`              | 51         | Dead zone formula, threshold clamping | 2026-06-29 |
| `tests/unit/core/input/player-input.test.ts`           | 39         | Debounce, pulse edge, benchmark | 2026-06-29 |
| `tests/integration/input/player-input-polling.test.ts` | 162        | Keyboard/gamepad polling, merge | 2026-06-29 |
| `tests/integration/input/focus-disconnect-safety.test.ts` | 60     | Tab blur, gamepad disconnect   | 2026-06-29 |
| `tests/integration/input/gsm-state-integration.test.ts` | 64        | Transition blocking, state reactions | 2026-06-29 |
| `tests/integration/input/device-detection.test.ts`     | 66         | Keyboard↔gamepad switch, priority | 2026-06-29 |

### Core — Shared

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/shared/assert-defined.test.ts`            | 4          | Assertion function for non-null narrowing | 2026-06-30 |

### Core — Physics/Handling

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/physics-handling/arcade-grip-model.test.ts` | 109       | Grip model, steering, lift-off oversteer | 2026-06-30 |
| `tests/unit/physics-handling/engine-gears-drag-braking.test.ts` | 123 | Engine model, auto-shift, drag, braking | 2026-06-30 |
| `tests/unit/physics-handling/physics-service.test.ts` | 123        | 3-phase pipeline, velocity override, determinism | 2026-06-30 |
| `tests/unit/physics-handling/surface-handler.test.ts` | 91         | Off-track grip, kerb timer, surface modifiers | 2026-06-30 |
| `tests/integration/physics-handling/lock-pit-events.test.ts` | 109 | Lock, pit limiter, edge events, 1-tick delay | 2026-06-30 |

### Dev Infra — Telemetry Recorder

| Test File                                          | Assertions | Covers                          | Added      |
| -------------------------------------------------- | ---------- | ------------------------------- | ---------- |
| `tests/unit/dev-infra/telemetry-data-model.test.ts`   | 94         | TelemetrySample structure, accumulation | 2026-06-26 |
| `tests/unit/dev-infra/telemetry-sampling.test.ts`     | 62         | 20 Hz sampling loop, throttle   | 2026-06-26 |
| `tests/unit/dev-infra/telemetry-console-summary.test.ts` | 37      | Console summary output          | 2026-06-26 |
| `tests/unit/dev-infra/telemetry-json-export.test.ts`  | 67         | JSON export, window.__telemetry | 2026-06-26 |
| `tests/unit/dev-infra/telemetry-noop.test.ts`         | 11         | Production noop behavior        | 2026-06-26 |
| `tests/integration/dev-infra/telemetry-lifecycle.test.ts` | 37     | Event bus subscriptions, race lifecycle | 2026-06-26 |

## Known Gaps

No gaps among implemented systems. All 12 implemented systems (64 stories) have regression tests.

### Not Started (no tests expected)

| System          | Stories | Status |
| --------------- | ------- | ------ |
| AI Driver       | 0/9     | 🔴     |
| Audio           | 0/11    | 🔴     |
| Camera          | 0/10    | 🔴     |
| Collision       | 0/4     | 🔴     |
| Fuel            | 0/6     | 🔴     |
| HUD             | 0/12    | 🔴     |
| Menu LITE       | 0/8     | 🔴     |
| Pit Stop        | 0/8     | 🔴     |
| Race Management | 0/8     | 🔴     |
| Race Results    | 0/4     | 🔴     |
| Single Race     | 0/2     | 🔴     |
| Tire Wear       | 0/3     | 🔴     |
| Track + Env     | 0/6     | 🔴     |

## Quarantined Tests

| Test File | Function | Reason | Quarantined Since |
| --------- | -------- | ------ | ----------------- |
| (none)    |          |        |                   |
