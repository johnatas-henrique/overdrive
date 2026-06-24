# ADR-0024: Game State Machine

## Status

Accepted

## Date

2026-06-21

## Engine Compatibility

| Field                     | Value                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Engine**                | Babylon.js 9.12.0                                                                                                                   |
| **Domain**                | Foundation — Orchestration / State Machine                                                                                          |
| **Knowledge Risk**        | LOW — pure TypeScript. Zero Babylon.js APIs.                                                                                        |
| **References Consulted**  | game-state-machine.md GDD, architecture.md Data Flow / Initialization Order, ADR-0001 (Event Bus)                                   |
| **Post-Cutoff APIs Used** | None                                                                                                                                |
| **Verification Required** | Illegal transition throws `GameStateError`; `gsm.state.entered`/`exited` events emitted in correct order; max 1 transition per tick |

## ADR Dependencies

| Field             | Value                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Depends On**    | ADR-0001 (Event Bus — all state changes emitted as events)                                                                        |
| **Enables**       | Camera (subscribes to states), HUD (subscribes to states), Audio (subscribes to states), Menu (drives screen stack)               |
| **Blocks**        | All systems that react to game state                                                                                              |
| **Ordering Note** | Init slot #2 (after Event Bus #1, before Simulation Snapshot #3). Must exist before any system subscribes to `gsm.state.entered`. |

## Context

### Problem Statement

The game has distinct phases: loading, menus, pre-race cinematic, racing gameplay, paused, post-results. Each phase requires different behavior from every system — Camera switches modes, HUD appears/disappears, Audio changes tracks, Physics locks/unlocks cars, Input routes `confirm` differently. Without a centralized state machine, each system would implement its own state tracking, leading to inconsistencies — Camera might think we're in PreRace while Input thinks we're in Racing.

### Constraints

1. **No coupling** — Systems must not call `gsm.getCurrent()`. They react to emitted events.
2. **Deterministic transitions** — The same transition from the same state must always produce the same result.
3. **Async hooks** — State entry may trigger async work (asset loading, save flush). The GSM must await completion before marking the transition done.
4. **One transition per tick** — Multiple transitions in the same frame cause "transition storms" that skip intermediate states.

## Decision

### Decision 1: Flat FSM with `Record<State, State[]>` transition table

The GSM is a flat (non-nested, non-parallel) finite state machine. Valid transitions are declared as a TypeScript record:

```typescript
const transitions: Record<State, State[]> = {
  Loading: ["Menu"],
  Menu: ["PreRace"],
  PreRace: ["Racing"],
  Racing: ["PostRace", "Paused"],
  Paused: ["Racing", "Menu"],
  PostRace: ["Menu", "PreRace"],
};
```

Any transition not in the table throws `GameStateError('Cannot transition from X to Y')` — no silent ignores. This makes the state graph self-documenting and type-checkable.

#### Alternatives Considered

- **Stack-based FSM** — Rejected. The game does not need nested states (no "inventory open while paused" scenarios). A flat FSM is simpler and prevents invalid state combinations.
- **Hierarchical state machine** — Rejected. Over-engineered for 6 states with simple transitions. Adding a future state (e.g., Replay) is one entry in the table.

### Decision 2: Per-state onEnter/onExit hooks

Each state defines `onEnter(context?: EnterContext): void | Promise<void>` and `onExit(): void | Promise<void>`. Async hooks are awaited; if `onEnter` rejects, the transition rolls back — GSM emits `gsm.state.entered` for the _previous_ state (not the rejected target).

#### Alternatives Considered

- **Centralized switch in GSM** — Rejected. State behavior lives with the state definition, not in a central if-else. Adding a state means adding a state object, not modifying GSM internals.

### Decision 3: Event Bus emission on every transition

Every transition emits two events in order:

1. `gsm.state.exited` with `{ from: previousState }`
2. `gsm.state.entered` with `{ from: previousState, to: newState }`

Systems subscribe to these events — they never call `gsm.getCurrent()`. This decouples state consumers from the GSM implementation.

### Decision 4: One transition per tick

At most one `transition()` call succeeds per tick. Subsequent calls in the same tick are queued and execute on the next tick. This prevents transition storms (e.g., Loading → Menu → PreRace in a single frame would skip Loading cleanup).

### Decision 5: State history ring buffer (20 entries)

Each transition is recorded: `{ from, to, timestamp, durationInPreviousState }`. The ring buffer is readable by Dev Tools overlay for debugging — developers can see the last 20 state transitions with timing.

### Decision 6: No public `getCurrent()` — event subscription only

Systems never poll the GSM. They subscribe to `gsm.state.entered` and `gsm.state.exited`. The only internal state is a private `currentState` field. This enforces the reactive architecture: a system cannot accidentally query "what state are we in?" mid-tick — it already knows from the last event it received.

#### Alternatives Considered

- **`getCurrent()` available but discouraged** — Rejected. Making it available means some developer will use it, creating coupling that the architecture explicitly forbids.

## Consequences

### Positive

- **Self-documenting** — The transition table is the complete list of legal state changes, readable as data.
- **No coupling** — Systems react to events, not queries. Camera, HUD, Audio all subscribe the same way.
- **Transition safety** — Illegal transitions throw immediately during development. Production builds can log the error and stay in the current state.
- **Debug visibility** — Ring buffer shows exactly what happened and when.

### Negative

- **Bootstrapping** — The GSM itself emits events during init. Systems must handle the initial state transition (Uninitialized → Loading → Menu) appropriately.
- **No `getCurrent()`** — If a system needs to know the state but hasn't received the event yet (first frame), it must infer from context.

### Risks

- **Risk**: During async `onEnter()`, the state is "in transition" — neither fully entered nor exited.
  **Mitigation**: A transition is considered complete only after `onEnter` of the target resolves. No system sees the target state as current until then. If a system polls via an internal timestamp, it will see the previous state until the transition settles.
- **Risk**: Rollback on `onEnter` rejection could confuse consumers that already received `gsm.state.exited`.
  **Mitigation**: On rollback, GSM re-emits `gsm.state.entered` for the original state. Systems that already processed the exit will re-process the entry — this is safe because entry behavior is idempotent.

## Performance Implications

- **CPU**: Transition is `O(1)` table lookup + event emissions. Non-hot path (at most a few times per minute).
- **Memory**: ~200 bytes for the state table + ~2KB for the ring buffer (20 entries × ~100 bytes each)

## Validation Criteria

- [ ] `transition('Racing')` from `Menu` throws `GameStateError` (invalid transition)
- [ ] `transition('Racing')` from `PreRace` succeeds and emits `gsm.state.exited` then `gsm.state.entered`
- [ ] Async `onEnter` rejection rolls back to previous state; rollback event re-emitted
- [ ] Two `transition()` calls in one tick: second is queued and executes next tick
- [ ] Ring buffer shows the last 20 transitions with correct timestamps
- [ ] Paused → Racing resumes all frozen systems correctly
- [ ] Paused → Menu discards race state without `race.completed`
- [ ] PostRace → PreRace preserves RaceConfiguration for Race Again

## GDD Requirements Addressed

| GDD Requirement                              | How This ADR Addresses It                         |
| -------------------------------------------- | ------------------------------------------------- |
| Transition table as `Record<State, State[]>` | Illegal transitions throw `GameStateError`        |
| Per-state onEnter/onExit hooks               | Async-capable, rollback on rejection              |
| Event Bus emissions per transition           | `gsm.state.exited` + `gsm.state.entered` in order |
| Serialized transitions — max 1 per tick      | Subsequent calls queued for next tick             |
| State history ring buffer (20 transitions)   | Read by Dev Tools overlay                         |
| Systems never call `gsm.getCurrent()`        | Private `currentState` — no public getter         |
| Paused state with freeze/resume              | All simulation frozen; Resume restores state      |
