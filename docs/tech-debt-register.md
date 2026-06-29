# Tech Debt Register

| Status | Date       | Source                      | Description                                                             | File                           | Effort | Resolved In              |
| ------ | ---------- | --------------------------- | ----------------------------------------------------------------------- | ------------------------------ | ------ | ------------------------ |
| ✅     | 2026-06-24 | SP1/event-bus/ST3           | once() stub not tested (87.5% functions coverage)                       | event-bus.ts                   | S      | SP1/event-bus/ST3        |
| ✅     | 2026-06-25 | SP1/scan                    | Dead code — CreateSceneGUI and CreateMainScene in playground            | playground/gui.ts, main-scene.ts | S   | SP2/asset-manager/ST1    |
| ✅     | 2026-06-26 | PR#12                       | save() silent data loss on JSON.stringify failure                       | persistence.ts                 | M      | SP2/tech-debt/ST1        |
| ✅     | 2026-06-26 | PR#12                       | dispose() can throw mid-cleanup, registry.clear() never runs           | simulation-snapshot.ts         | M      | SP2/tech-debt/ST1        |
| ✅     | 2026-06-26 | PR#12                       | localStorage write failure drops serialized data                        | persistence.ts                 | S      | SP2/tech-debt/ST1        |
| ✅     | 2026-06-26 | PR#12                       | Invalid config silently registered without resolved cache               | configManager.ts               | S      | SP2/tech-debt/ST1        |
| ✅     | 2026-06-26 | PR#12                       | Stack trace parsing fragile (non-V8 engines, minified stacks)           | configManager.ts               | S      | SP2/tech-debt/ST1        |
| ✅     | 2026-06-26 | PR#12                       | Runtime process.env iteration in browser builds                         | configManager.ts               | S      | SP2/tech-debt/ST1        |
| ✅     | 2026-06-26 | PR#12                       | Empty catch {} swallows all slot exceptions                             | fixed-update-pipeline.ts       | S      | SP2/tech-debt/ST1        |
| ✅     | 2026-06-26 | PR#12                       | Constructor installs dev guard globally before attach()                 | pipeline-runtime.ts            | S      | SP2/tech-debt/ST1        |
| ✅     | 2026-06-26 | PR#12                       | JSDoc shows static call for instance method                             | pipeline-runtime.ts            | S      | SP2/tech-debt/ST1        |
| 🔴     | 2026-06-24 | SP1/event-bus/ST3           | Inaccurate test counts per AC (e.g. AC-4a: said 4, actual 3)           | event-bus story files          | S      |                          |
| 🔴     | 2026-06-24 | SP1/game-state-machine/ST1  | getCurrentState() public with @internal — should restrict when EB lands | GameStateMachine.ts            | S      |                          |
| 🔴     | 2026-06-24 | SP1/game-state-machine/ST2  | console.warn in foundation — replace with Event Bus emission            | GameStateMachine.ts            | S      |                          |
| 🔴     | 2026-06-24 | SP1/game-state-machine/ST3  | getCurrentState() still public — restrict to test-only or remove        | GameStateMachine.ts            | S      |                          |
| 🔴     | 2026-06-24 | SP1/game-state-machine/ST4  | transition/_doTransition duplicate ~40 lines of hook/emission logic     | GameStateMachine.ts            | S      |                          |
| 🔴     | 2026-06-25 | SP1/simulation-snapshot/ST2 | takeSnapshot() calls serialize() twice per system (double cost)         | simulation-snapshot.ts         | S      |                          |
| 🔴     | 2026-06-25 | SP1/determinism-contract/ST6 | DevGuard QA edge cases .call(null) and .bind(performance)() not tested | dev-guard.ts                   | S      |                          |
| 🔴     | 2026-06-25 | SP1/persistence/ST1         | Scope overshoot — save/load/delete fully in Story 001 (said "stubs")   | persistence.ts                 | —      |                          |
| 🔴     | 2026-06-25 | SP1/persistence/ST2         | Stale QA path — tests/integration/ referenced, tests live in tests/unit | story-002 persistence          | S      |                          |
| 🔴     | 2026-06-25 | SP1/persistence/ST3         | Same stale QA path in persistence story 003                             | story-003 persistence          | S      |                          |
| 🔴     | 2026-06-25 | SP1/persistence/ST4         | Hardcoded queue limit 50 — extract to named constant MAX_WRITE_QUEUE    | persistence.ts                 | S      |                          |
| 🔴     | 2026-06-25 | SP1/persistence/ST5         | load() triggers migration on any version mismatch (not only stored < current) | persistence.ts            | S      |                          |
| 🔴     | 2026-06-25 | SP1/simulation-snapshot/ST3 | computeSnapshotHash concatenates JSON without delimiters (collision risk) | simulation-snapshot.ts       | S      |                          |
| 🔴     | 2026-06-25 | SP1/scan                    | DRY violation — transition/_doTransition share ~98 lines                | GameStateMachine.ts            | S      |                          |
| 🔴     | 2026-06-25 | SP1/scan                    | Duplicate code — two 27-line blocks in retry() share probe+flush logic  | persistence.ts                 | S      |                          |
| 🔴     | 2026-06-25 | SP1/scan                    | Duplicate code — two 20-line blocks share queue filter pattern          | persistence.ts                 | S      |                          |
| 🔴     | 2026-06-25 | SP1/scan                    | Unused export — ZERO in determinism types                               | determinism/types.ts           | S      |                          |
| 🔴     | 2026-06-25 | SP1/scan                    | Files over 500 lines — persistence.ts (738), GameStateMachine.ts (553)  | persistence.ts, GameStateMachine.ts | M  |                          |
| 🔴     | 2026-06-25 | SP1/scan                    | Biome warnings — 7 non-null assertions bypass type safety              | pipeline-runtime, event-bus, GSM, persistence | S |              |
| 🔴     | 2026-06-25 | SP1/test-evidence           | Story 003b type field mismatch — says "Integration", tests are unit    | story-003b hmr                 | S      |                          |
| 🔴     | 2026-06-25 | SP1/test-evidence           | Story 003b stale QA path — tests/integration/config-manager.test.ts doesn't exist | story-003b hmr | S |                |
| 🔴     | 2026-06-25 | SP1/test-evidence           | Story 004 FIFO content not verified — queue length checked, not content | config-manager.test.ts         | S      |                          |
| 🔴     | 2026-06-25 | SP1/test-evidence           | DET Story 004 fragile constant assertion — FIXED_DT ≈ 0.0166667        | determinism.test.ts            | S      |                          |
| 🔴     | 2026-06-25 | SP1/test-evidence           | DET Story 005 stale QA path — tests/integration/ referenced             | story-005 determinism          | S      |                          |
| 🔴     | 2026-06-25 | SP1/test-evidence           | DET Story 006 vi.resetModules() sensitivity — parallel execution risk  | determinism.test.ts            | S      |                          |
| 🔴     | 2026-06-25 | SP1/test-evidence           | GSM Story 006 timing dependency — setTimeout(r, 10) workaround         | gsm.test.ts                    | S      |                          |
| 🔴     | 2026-06-26 | PR#12                       | Non-finite accumulator propagates forever (NaN/Infinity stuck)          | accumulator.ts                 | S      |                          |
| 🔴     | 2026-06-26 | PR#12                       | Depth error detection uses fragile string comparison                    | event-bus.ts                   | S      |                          |
| 🔴     | 2026-06-26 | SP2/tech-debt/ST1/LP        | `as string` cast on Error.stack hides runtime undefined                   | configManager.ts               | S      |                          |
| 🔴     | 2026-06-26 | SP2/tech-debt/ST1/LP        | Queue stores raw { key, data } — retry re-serializes (non-deterministic) | persistence.ts               | S      |                          |
| 🔴     | 2026-06-26 | SP2/tech-debt/ST1/LP        | Consider collecting slot errors for post-tick diagnostics               | fixed-update-pipeline.ts       | S      |                          |
| 🔴     | 2026-06-26 | SP2/tech-debt/ST1/LP        | persistence.ts load() 63 lines — exceeds 40-line guideline             | persistence.ts                 | S      |                          |
| 🔴     | 2026-06-26 | SP2/tech-debt/ST1/LP        | configManager.ts get() 56 lines — exceeds 40-line guideline            | configManager.ts               | S      |                          |
| 🔴     | 2026-06-26 | SP2/telemetry/ST1           | TR-TELEMETRY-001 fabricated field names — /architecture-review hallucinated speedKmh/fuelLevel/accelG/carId instead of reading GDD | tr-registry.yaml | S | |
| ✅     | 2026-06-26 | SP2/dev-tools/ST3           | Keybinds changed from F1/F2/F3 to backtick/1/2 (browser conflict) — config at dev-tools-config.ts | src/config/dev-tools-config.ts | S | SP2/dev-tools/ST6 |
| 🔴     | 2026-06-26 | SP2/dev-tools/ST3           | captureRenderTime not enabled (no AC requires it, but ADR-0009 mentions it) | dev-tools.ts | S | |
| ✅     | 2026-06-27 | SP2/dev-tools/ST2/LP        | Config defaults mismatch: DEV_TOOLS_KEYS uses `1`/`2`/`3` but story ACs reference backtick/`1`/`2` — config is runtime source of truth, story ACs are stale | src/config/dev-tools-config.ts | S | SP2/dev-tools/ST6 |
| 🔴     | 2026-06-27 | SP2/dev-tools/ST4           | `_initConfigDataSource` registers reader that's never consumed — placeholder for future stories (Event Bus Inspector, GSM History) | dev-tools.ts | S | |
| ✅     | 2026-06-27 | SP2/dev-tools/ST4           | All inline styles instead of CSS classes — refactor when Story 005+ adds more panels | config-tree.ts, dev-tools.ts | M | SP2/dev-tools/ST9 |
| 🔴     | 2026-06-27 | SP2/dev-tools/ST6/LP        | IReadOnlyEventBus duplicated in gsm-visualizer.ts and event-bus-inspector.ts — extract to shared types.ts | gsm-visualizer.ts, event-bus-inspector.ts | S | SP2/PR15-review |
| 🔴     | 2026-06-27 | SP2/dev-tools/ST6/LP        | CSS gsm-history-row uses rgba(255,255,255,0.02) instead of CSS variable — inconsistent with rest of stylesheet | dev-tools.css | S | |
| 🔴     | 2026-06-28 | SP2/dev-tools/ST8/LP        | Hardcoded player ID "player-1" in ai-telemetry-panel.ts — should be configurable for future multiplayer | ai-telemetry-panel.ts | S | |
| 🔴     | 2026-06-28 | SP2/dev-tools/ST8/LP        | No integration test for DevTools.setAiTelemetry() tab creation flow | dev-tools.ts | S | |
| 🔴     | 2026-06-28 | PR#15/X-012                 | Barrel files (index.ts) excluded from coverage — consider removing barrel files and using @/ imports directly | src/foundation/*/index.ts | M | |
| 🔴     | 2026-06-28 | PR#15/TD-002                | Playwright port 5177 vs Vite default 5173 — E2E tests fail in CI | playwright.config.ts | S | SP2/PR15-review |
| 🔴     | 2026-06-28 | PR#15/TD-004                | GSM not connected to shared EventBus — visualizer never receives events | app.ts, main-scene.ts | M | SP2/PR15-review |
| 🔴     | 2026-06-28 | PR#15/TD-006                | Duplicate `completed` key in sprint-status.yaml — story 2-14 appears incomplete | sprint-status.yaml | S | SP2/PR15-review |
| 🔴     | 2026-06-28 | PR#15/TD-021                | initDevTools() called without await — unhandled rejection | app.ts | S | SP2/PR15-review |
| 🔴     | 2026-06-28 | PR#15/DT-012                | Disposed DevTools can be re-toggled but metrics never update | dev-tools.ts | M | SP2/PR15-review |
| 🔴     | 2026-06-28 | PR#15/DT-034                | DEV env lost after first test in integration suite | sim-snapshot-panel.test.ts | S | SP2/PR15-review |
| 🔴     | 2026-06-28 | PR#15/DT-052                | _resetDevToolsForTesting doesn't dispose old instance — DOM/listeners leak | index.ts | S | SP2/PR15-review |
