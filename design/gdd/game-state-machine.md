# Game State Machine

> **Status**: Design Complete
> **Author**: build agent + johnatas-henrique
> **Last Updated**: 2026-06-20
> **Last Verified**: 2026-06-20
> **Implements Pillar**: Foundation — orchestrates the entire game flow

## Overview

The Game State Machine (GSM) is the top-level orchestrator of the entire game. It defines a finite set of states (Loading, Menu, PreRace, Racing, PostRace) and enforces valid transitions between them. Every state change is emitted as an Event Bus event — Camera, HUD, Audio, AI, and all other systems react to the current state without being coupled to the GSM. The GSM itself has zero knowledge of what other systems do in response to a state change. It is a flat FSM (no parallel or nested states in MVP).

## Developer Fantasy

The developer declares states and valid transitions in a single configuration object. Wiring a new state (e.g. Results → Podium) is one entry in the transition table and one state definition — no if-else chains across systems. Every system already responds to state changes via Event Bus subscriptions; adding a state means adding subscribers where needed, not modifying the GSM. The debug overlay shows the current state, transition history, and the time spent in each state — no guessing where the game loop is.

## Detailed Design

### Core Rules

**1. Transition table.** Valid transitions are declared as a `Record<State, State[]>` — a flat lookup table. If a transition is not in the table, it is rejected. Adding a new state means adding one entry to the table; there is no branching logic to maintain.

**2. Per-state hooks.** Each state defines optional `onEnter()` and `onExit()` callbacks. OnEnter prepares the game for that state (e.g. Loading → start asset load). OnExit tears down before leaving (e.g. Racing → pause physics). Hooks live with the state definition — the code for `Racing.onEnter()` is in `RacingState`, not in a central switch. Hook functions may return `void` or `Promise<void>`; the GSM awaits async hooks before completing the transition.

**3. Event Bus emission.** Every transition emits two events in order:

1.  `'gsm.state.exited'` with payload `{ from: previousState }`
2.  `'gsm.state.entered'` with payload `{ from: previousState, to: newState }`
    Systems react to these events via Event Bus subscriptions. They never call `gsm.getCurrent()` — that would couple them to the GSM directly.

**4. Illegal transition rejection.** `transition(to)` on a disallowed pair throws `GameStateError('Cannot transition from Loading to Racing')`. There is no silent ignore. An illegal transition is always a programming error or a cheat attempt.

**5. State history ring buffer.** The last 20 transitions are retained as an ordered list. Each entry records: from, to, timestamp, and duration in the previous state. The debug overlay reads this list directly.

### States and Transitions

```
Loading → Menu → PreRace → Racing → PostRace ──→ Menu
                                       │
                                       └──→ PreRace (Race Again — preserved config)
```

| State        | Purpose                                                         | Duration      | onEnter                                       | onExit                 |
| ------------ | --------------------------------------------------------------- | ------------- | --------------------------------------------- | ---------------------- |
| **Loading**  | Bootstrap — load core assets, config, restore save              | < 2s          | Init systems, start asset loading             | —                      |
| **Menu**     | Title screen, mode selection (Single Race, future Championship) | Indefinite    | Show Menu/Paddock UI                          | Save state if dirty    |
| **PreRace**  | Countdown / grid formation                                      | 3-10s         | Place cars on grid, lock controls until start | —                      |
| **Racing**   | Main gameplay loop                                              | Race duration | Activate physics, enable input, start AI      | Pause physics, stop AI |
| **PostRace** | Results screen (position, rewards, highlights)                  | 10-30s        | Calculate rewards, show results               | —                      |

**Valid transitions (enforced by transition table):**

| From     | To       | Trigger                                                                      |
| -------- | -------- | ---------------------------------------------------------------------------- |
| Loading  | Menu     | Assets loaded, systems initialized                                           |
| Menu     | PreRace  | Player selected Single Race (future: Championship)                           |
| PreRace  | Racing   | Countdown finished or start signal                                           |
| Racing   | PostRace | Checkered flag triggered (player finished all laps or DNF)                   |
| PostRace | Menu     | Player dismissed results (future: auto-advance to next race)                 |
| PostRace | PreRace  | Player selects 'Race Again' — RaceConfiguration preserved from previous race |

**Rejected transitions (throw GameStateError):**

- Any transition not listed in the table above (e.g. Menu → Racing, PreRace → PostRace)

### Interactions with Other Systems

The GSM interacts only with the **Event Bus** — it emits state change events and never calls any other system directly. All other interactions are reactive: systems subscribe to `'gsm.state.entered'` and `'gsm.state.exited'` to adjust their behavior.

**Known reactors:**

- **Menu/Paddock LITE** → shows/hides based on Menu state
- **Physics/Handling** → active only during Racing state
- **Camera** → cinematic mode in PreRace, chase/follow in Racing, replay in PostRace
- **HUD** → visible in Racing, hidden in Menu and Loading
- **Audio** → menu music in Menu, race sounds in Racing, results fanfare in PostRace
- **AI Driver** → active only during Racing
- **Fuel / Tire Wear** → ticking only during Racing
- **Pit Stop** → accepting input only during Racing
- **Collision** → detection only during Racing
- **Input** → routed to menu in Menu, routed to car in Racing, ignored in Loading

## Formulas

None. The GSM is a state orchestrator — it does not compute values.

## Edge Cases

1. **Double transition.** `transition('Racing')` called twice in a row. If already in Racing, the second call is a no-op (transition to the same state is silently ignored).
2. **Async onEnter failure.** If `Racing.onEnter()` is async and rejects (e.g. physics fails to initialize), the GSM catches the error, logs it, and remains in the previous state. The transition is rolled back.
3. **Transition storm.** Multiple systems call `transition()` in the same frame due to race condition. The GSM serializes transitions — only one state change per tick is allowed. Subsequent calls in the same tick are queued for the next.
4. **Dispose during transition.** If the GSM is disposed while mid-transition, the current transition is aborted. onExit of the source state runs, onEnter of the target does not.
5. **Event Bus not available.** If the Event Bus is not initialized when a transition fires, the GSM logs a warning and skips event emission — the state change still happens.

## Dependencies

- **Event Bus** (#2) — for emitting state change events to all reacting systems

## Tuning Knobs

None for gameplay. Developer-facing parameters:

- **Max transitions per tick** (default: 1) — prevents transition storm
- **History buffer size** (default: 20) — number of past transitions retained for debug

## Visual/Audio Requirements

None directly. Visual and audio changes are triggered by other systems reacting to GSM state events (e.g. Audio system plays menu music when `'gsm.state.entered'` fires with `to: Menu`).

## UI Requirements

**Debug Overlay integration** — live state viewer showing:

- Current state (large, colored indicator)
- Transition history (last 20, with timestamps and durations)
- Valid transitions from current state (quick reference)
- Async hook status (running / completed / errored)

## Acceptance Criteria

1. `GSM.init()` sets initial state to Loading.
2. `GSM.transition('Menu')` from Loading moves to Menu, emits `'gsm.state.exited'` (Loading) then `'gsm.state.entered'` (Menu → Loading) on Event Bus.
3. `GSM.transition('Racing')` from Loading throws `GameStateError` — not a valid transition.
4. `GSM.transition('Racing')` from PreRace succeeds, calls `PreRace.onExit()` then `Racing.onEnter()`.
5. `GSM.transition('Racing')` while already in Racing — no-op, no error, no event emitted.
6. Async `onEnter()` that rejects leaves GSM in the previous state.
7. After 25 transitions, history contains exactly the last 20 entries (FIFO eviction).
8. Event Bus unavailable during transition — state change still happens, warning is logged.

## Open Questions

None yet.
