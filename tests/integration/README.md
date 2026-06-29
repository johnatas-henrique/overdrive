# Integration Tests

Tests that wire two or more components together. Uses Vitest + happy-dom for
DOM-based panels, or real Babylon.js mocks for engine-dependent systems.

```bash
npx vitest run tests/integration/
```

## Structure

Test directories **mirror `src/`**:

```
tests/integration/
├── core/                         # src/core/
│   └── dev-tools/                #   panel integration tests
│       ├── config-tree.test.ts
│       ├── event-bus-inspector.test.ts
│       ├── gsm-visualizer.test.ts
│       ├── sim-snapshot-panel.test.ts
│       └── ai-telemetry-panel.test.ts
└── dev-infra/                    # src/dev-infra/
    └── telemetry-lifecycle.test.ts
```

## Rules

1. **Mirror `src/`** — when adding a panel under `src/core/dev-tools/`, create its integration test under `tests/integration/core/dev-tools/`.
2. **Two+ components** — an integration test wires at least two real components (e.g., `EventBus` + `EventBusInspector`, `ConfigManager` + `ConfigTreePanel`).
3. **Unit test for single component** — if testing one component in isolation, put it in `tests/unit/`, not here.
4. **`// @vitest-environment happy-dom`** — DOM-based panel tests need this directive for `document.createElement` etc.
5. **Mock engine dependencies** — Babylon.js `SceneInstrumentation`, `Observable`, etc. are mocked at the top of the file with `vi.mock()`.
