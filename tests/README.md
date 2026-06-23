# Test Infrastructure

**Engine**: Babylon.js 9.12.0
**Test Framework**: Vitest
**CI**: `.github/workflows/tests.yml`
**Setup date**: 2026-06-18

## Directory Layout

```
tests/
  unit/           # Isolated unit tests — pure logic, no engine
  integration/    # Cross-system tests, engine-dependent
  evidence/       # Screenshots and manual test sign-off records
  smoke/          # Critical path test list (15-minute manual gate)
```

## Running Tests

```bash
npm test           # vitest run — single run (CI)
npm run test:watch # vitest — watch mode (development)
```

## Test Naming

- **Files**: `[system].test.ts`
- **Functions**: `describe('[System]', ...)` / `it('should ...', ...)`
- **Example**: `tests/unit/config-manager.test.ts` → `it('returns value after registration')`

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
