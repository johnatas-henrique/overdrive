# Test Infrastructure

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS)
**Test Framework**: Unity Test Framework 1.6.0
**CI**: `.github/workflows/tests.yml`
**Setup date**: 2026-07-28

## Directory Layout

```
tests/
  unit/           # Isolated unit tests (formulas, state machines, logic)
  integration/    # Cross-system and save/load tests
  smoke/          # Critical path test list for /smoke-check gate
  evidence/       # Screenshot logs and manual test sign-off records
  EditMode/       # Unity EditMode test assembly (placeholder)
  PlayMode/       # Unity PlayMode test assembly (placeholder)
```

## Running Tests

In Unity Editor: Window → General → Test Runner → EditMode or PlayMode.

## Test Naming

- **Files**: `[System]_[Feature]Tests.cs`
- **Methods**: `[Feature]_[Scenario]_[ExpectedBehavior]()`
- **Example**: `FuelSystem_Consumption_ConsumesAtBaseRateWhenThrottleFull()`

## Story Type → Test Evidence

| Story Type | Required Evidence | Location |
|---|---|---|
| Logic | Automated unit test — must pass | `tests/unit/[system]/` |
| Integration | Integration test OR playtest doc | `tests/integration/[system]/` |
| Visual/Feel | Screenshot + lead sign-off | `tests/evidence/` |
| UI | Manual walkthrough OR interaction test | `tests/evidence/` |
| Config/Data | Smoke check pass | `production/qa/smoke-*.md` |

## CI

Tests run automatically on every push to `main` and on every pull request.
A failed test suite blocks merging.
