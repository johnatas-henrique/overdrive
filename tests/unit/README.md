# Unit Tests

Pure logic tests using Vitest. No engine dependencies.

```bash
npx vitest run tests/unit/
```

## Structure

Test directories **mirror `src/`**:

```
tests/unit/
├── foundation/                   # src/foundation/
│   ├── config/                   #   config-manager.test.ts, hmr.test.ts
│   ├── determinism/              #   determinism.test.ts
│   ├── event-bus/                #   event-bus.test.ts
│   ├── gsm/                      #   gsm.test.ts
│   ├── persistence/              #   persistence.test.ts
│   └── simulation-snapshot/      #   snapshot.test.ts
├── core/                         # src/core/
│   └── dev-tools/                #   dev-tools.test.ts, keybinds.test.ts, etc.
└── dev-infra/                    # src/dev-infra/
    └── telemetry-*.test.ts
```

## Rules

1. **One file per source module** — named `[module].test.ts`, matching the source file. Complex systems with multiple modules (e.g., telemetry with data model, sampling, console summary, JSON export, noop) may use one test file per module under the system directory.
2. **Mirror `src/`** — when adding a system under `src/foundation/[system]/`, create `tests/unit/foundation/[system]/[system].test.ts`.
3. **No catch-all files** — do not create `tech-debt-cleanup.test.ts` or `coverage-gap.test.ts`. Distribute tests into the correct per-system file.
4. **No engine imports** — if a test needs `@babylonjs/*`, it belongs in `tests/integration/`.
5. **Coverage target** — 100% across all 4 metrics (stmts, branches, funcs, lines). Gaps from v8 runtime limitations are documented, not suppressed.
