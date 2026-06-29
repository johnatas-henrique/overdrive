# Test Infrastructure

**Engine**: Babylon.js 9.12.0
**Test Framework**: Vitest
**CI**: `.github/workflows/tests.yml`
**Setup date**: 2026-06-18

## Directory Layout

```
tests/
  unit/                  # Isolated unit tests — pure logic, no engine
    foundation/          # Mirrors src/foundation/ (ConfigManager, EventBus, GSM, etc.)
    core/                # Mirrors src/core/ (Dev Tools)
    dev-infra/           # Mirrors src/dev-infra/ (TelemetryRecorder)
  integration/           # Cross-system tests, engine-dependent
    core/                # Mirrors src/core/ (Dev Tools panel integration)
    dev-infra/           # Mirrors src/dev-infra/ (Telemetry lifecycle)
  e2e/                   # Playwright browser tests
  evidence/              # Screenshots and manual test sign-off records
  smoke/                 # Critical path test list (15-minute manual gate)
```

## Directory Convention

**Test directories mirror `src/` structure.** When a new system is added under
`src/foundation/[system]/`, its test goes in `tests/unit/foundation/[system]/`.
When a new panel is added under `src/core/dev-tools/`, its integration test
goes in `tests/integration/core/dev-tools/`.

This makes it trivial to find the test for any source file: replace `src/` with
`tests/unit/` (or `tests/integration/`) and append `.test.ts`.

## Running Tests

```bash
npm test           # vitest run — single run (CI)
npm run test:watch # vitest — watch mode (development)
npm run cov:gap    # coverage report — only shows files below 100%
```

## Test Naming

- **Files**: `[system].test.ts` — one file per system, matching the source file name
- **Functions**: `describe('[System]', ...)` / `it('should ...', ...)`
- **Example**: `tests/unit/foundation/config/config-manager.test.ts` → `it('returns value after registration')`

## Test Layers

| Layer        | Location                         | Purpose                                   | Engine? |
| ------------ | -------------------------------- | ----------------------------------------- | ------- |
| Unit         | `tests/unit/`                      | Pure logic, single component, no DOM      | No      |
| Integration  | `tests/integration/`               | Two+ components wired together            | Some    |
| E2E          | `tests/e2e/`                       | Real browser, full user interaction       | Yes     |
| Manual       | `tests/evidence/`                  | Screenshots, sign-offs                    | Yes     |
| Smoke        | `tests/smoke/`                     | Critical path checklist                  | Yes     |

## Story Type → Test Evidence

| Story Type  | Required Evidence                      | Location             |
| ----------- | -------------------------------------- | -------------------- |
| Logic       | Automated unit test — must pass        | `tests/unit/`        |
| Integration | Integration test or playtest doc       | `tests/integration/` |
| Visual/Feel | Screenshot + lead sign-off             | `tests/evidence/`    |
| UI          | Manual walkthrough or interaction test | `tests/evidence/`    |
| Config/Data | Smoke check pass                       | `tests/smoke/`       |

## CI

Tests run automatically on every push to `main` and on every pull request.
A failed test blocks merging.
