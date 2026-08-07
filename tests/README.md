# Test Infrastructure

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS)
**Test Framework**: Unity Test Framework 1.6.0
**CI**: `.github/workflows/tests.yml`
**Setup date**: 2026-07-28

## Directory Layout

Unity only compiles code that lives under `Assets/`. Compilable test code therefore
lives in `Assets/tests/` as asmdef test assemblies; the repo-root `tests/` tree holds
documentation, test lists, and evidence — it is **not** imported by Unity.

```
Assets/tests/               # Compilable Unity test code (asmdef test assemblies)
  integration/              # Cross-system and save/load tests
    input/                  # Story 001: Input System action asset + context controller

tests/                      # Documentation / evidence layout (NOT imported by Unity)
  unit/                     # Unit-test documentation and any non-Unity test scripts
  integration/              # Integration-test documentation and evidence dirs
  smoke/                    # Critical path test list for /smoke-check gate
  evidence/                 # Screenshot logs and manual test sign-off records
  EditMode/                 # EditMode test assembly notes (placeholder)
  PlayMode/                 # PlayMode test assembly notes (placeholder)
```

## Running Tests

In Unity Editor: Window → General → Test Runner → EditMode or PlayMode.
The `Assets/tests/**` asmdefs reference `UnityEngine.TestRunner` and
`UnityEditor.TestRunner` and are compiled only when tests are included.

## Test Naming

- **Files**: `[System]_[Feature]Tests.cs`
- **Methods**: `[Feature]_[Scenario]_[ExpectedBehavior]()`
- **Example**: `FuelSystem_Consumption_ConsumesAtBaseRateWhenThrottleFull()`

## Story Type → Test Evidence

| Story Type | Required Evidence | Location |
|---|---|---|
| Logic | Automated unit test — must pass | `Assets/tests/unit/[system]/` |
| Integration | Integration test OR playtest doc | `Assets/tests/integration/[system]/` |
| Visual/Feel | Screenshot + lead sign-off | `tests/evidence/` |
| UI | Manual walkthrough OR interaction test | `tests/evidence/` |
| Config/Data | Smoke check pass | `production/qa/smoke-*.md` |

`tests/README.md` (this file) is documentation only and is intentionally not part of
the Unity asset database.

## CI

Tests run automatically on every push to `main` and on every pull request.
A failed test suite blocks merging.
