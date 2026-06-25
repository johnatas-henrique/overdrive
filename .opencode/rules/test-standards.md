---
paths:
  - "tests/**"
---

# Test Standards

## Naming Conventions

### TypeScript / Vitest (Babylon.js projects)

Use Vitest BDD-style `describe`/`it` blocks:

```typescript
describe("GameStateMachine", () => {
  describe("AC-1: init() sets Loading", () => {
    it("should set currentState to Loading after init()", () => {
      // Arrange
      const gsm = new GameStateMachine();
      // Act
      gsm.init();
      // Assert
      expect(gsm.getCurrentState()).toBe("Loading");
    });
  });
});
```

- `describe` blocks group by system or acceptance criterion
- `it` blocks describe the specific behavior in natural language
- Use `AC-N:` prefix in top-level describes to map tests to story acceptance criteria

### GDScript / Godot projects

Use `test_[system]_[scenario]_[expected_result]` pattern:

```gdscript
func test_health_system_take_damage_reduces_health() -> void:
    # Arrange
    var health := HealthComponent.new()
    health.max_health = 100
    health.current_health = 100

    # Act
    health.take_damage(25)

    # Assert
    assert_eq(health.current_health, 75)
```

## General Rules

- Every test must have a clear arrange/act/assert structure
- Unit tests must not depend on external state (filesystem, network, database)
- Integration tests must clean up after themselves
- Performance tests must specify acceptable thresholds and fail if exceeded
- Test data must be defined in the test or in dedicated fixtures, never shared mutable state
- Mock external dependencies — tests should be fast and deterministic
- Every bug fix must have a regression test that would have caught the original bug
