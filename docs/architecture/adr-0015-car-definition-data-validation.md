# ADR-0015: Car Definition Data Validation

## Status

Accepted

## Date

2026-07-31

## Reviewed

2026-08-01 (architecture-review-2026-08-01.md — PASS)

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Core / Data |
| **Knowledge Risk** | LOW — ScriptableObjects are stable, no post-cutoff changes |
| **References Consulted** | `design/gdd/car-definition-data.md`, `design/gdd/vehicle-physics.md`, `design/gdd/fuel-system.md` |
| **Post-Cutoff APIs Used** | None |
| **Verification Required** | Validation produces valid physics values; differentiation check prevents perceptually identical cars |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (Vehicle Physics — consumes stats), ADR-0006 (Fuel/Tire — consumes efficiency_modifier), ADR-0012 (Audio — CarAudioProfile schema) |
| **Enables** | Vehicle Physics, Fuel, Tire, Audio, AI Rival (all consume car stats) |
| **Blocks** | Car Definition Data asset authoring |
| **Ordering Note** | Must be accepted before car definition assets are authored |

## Context

### Problem Statement

Car Definition Data has 2 gaps in the traceability matrix:
1. **TR-car-003:** Stats validation/clamping rules not documented
2. **TR-car-004:** Differentiation rule not documented

These rules exist only in `car-definition-data.md` — they need architectural recording.

### Constraints

- 16 teams, each with 6 stats
- Weight is constant for all cars (not a differentiating stat)
- Stats consumed by 5 downstream systems
- Data externalized in ScriptableObjects

### Requirements

- Must validate stats at load time (prevent runtime crashes from corrupt data)
- Must check differentiation at authoring time (prevent perceptually identical cars)
- Must be data-driven (values tunable during playtesting, not hardcoded in ADR)

## Decision

Car Definition Data uses **ScriptableObjects** with **load-time validation** and **authoring-time differentiation check**. All specific values (formula, valid range, thresholds) are **tuning knobs** — defined in data, adjustable during playtesting.

### ScriptableObject Schema

```csharp
[Serializable]
public class CarDefinition : ScriptableObject {
    public string teamId;                    // "team_tier1_a" through "team_tier4_d"
    public CarStats stats;                   // 6 stats, validated at load
    public float weightKg;                   // constant, not differentiating
    public CarAudioProfile audioProfile;     // engine profile (per ADR-0012)
}

[Serializable]
public struct CarStats {
    public int topSpeed;                     // validated at load
    public int acceleration;                 // validated at load
    public int brakePower;                   // validated at load
    public int gripLevel;                    // validated at load
    public int stability;                    // validated at load
    public int efficiency;                   // validated at load
}

// CarAudioProfile mirrors ADR-0012 (engineType string was removed 2026-07-28):
// engineCylinders (8, 10, or 12), engineBasePitch (0.8–1.2), exhaustNote enum {Standard, Deep, Sharp}
[Serializable]
public struct CarAudioProfile {
    public int engineCylinders;              // 8, 10, or 12 (ADR-0012)
    public float engineBasePitch;            // 0.8–1.2 (ADR-0012)
    public ExhaustNote exhaustNote;          // Standard, Deep, Sharp (ADR-0012)
}
```

### Load-Time Validation (TR-car-003)

Stats are validated when the ScriptableObject is loaded at race init:

```csharp
// Validation is data-driven — valid values and default are configurable
public struct StatValidationConfig {
    public int[] validValues;    // e.g., {4, 8, 12, 16, 20} — configurable
    public int defaultValue;     // e.g., 12 — configurable
}

public static int ClampStat(int value, StatValidationConfig config) {
    int closest = config.defaultValue;
    int minDistance = int.MaxValue;
    foreach (int valid in config.validValues) {
        int distance = Mathf.Abs(value - valid);
        if (distance < minDistance) {
            minDistance = distance;
            closest = valid;
        }
    }
    if (closest != value) {
        Debug.LogWarning($"CarDefinitionData: stat {value} clamped to {closest} (valid: {string.Join(", ", config.validValues)})");
    }
    return closest;
}
```

- Valid values are configurable (not hardcoded in ADR)
- Default value for missing fields is configurable
- Validation runs once at race init, not per tick
- Cost: negligible (N comparisons per car × 16 cars)

### Authoring-Time Differentiation Check (TR-car-004)

Differentiation is checked in Unity Editor when car assets are edited:

```csharp
// Differentiation is data-driven — threshold and scope are configurable
public struct DifferentiationConfig {
    public float maxSpreadPercentage;  // e.g., 5.0 — configurable
    public bool withinTierOnly;        // e.g., true — configurable
}

public static bool ValidateDifferentiation(CarDefinition[] allCars, DifferentiationConfig config) {
    // Group by tier if withinTierOnly
    // Check spread between all pairs in scope
    // Warn when spread > threshold (non-blocking)
    // Returns true (warning, not error)
}
```

- Threshold is configurable (not hardcoded in ADR)
- Scope is configurable (within-tier or cross-tier)
- Runs in Editor, not runtime
- Warns but does not block — designer decides

### Stat Ownership

| Stat | Owner System | Consumed By |
|------|-------------|-------------|
| Top Speed | Vehicle Physics | Vehicle Physics only |
| Acceleration | Vehicle Physics | Vehicle Physics only |
| Brake Power | Vehicle Physics | Vehicle Physics only |
| Grip Level | Vehicle Physics | Vehicle Physics only |
| Stability | Vehicle Physics | Vehicle Physics only |
| Efficiency | Fuel/Tire (shared) | Fuel System, Tire System |
| Weight | Vehicle Physics | Vehicle Physics only |

**Efficiency modifier** is defined by the Car Definition Data schema and consumed by Fuel/Tire. The formula is a tuning knob — adjusted during playtesting, not hardcoded in this ADR.

### File Organization

```
Assets/Data/Cars/
├── team_tier1_a.asset
├── team_tier1_b.asset
├── ...
└── team_tier4_d.asset
```

- One ScriptableObject per team
- Loaded via Addressables (`Cars/{teamId}`)
- ADR-0003 (Content Pipeline) manages group topology

### Configuration Storage

`StatValidationConfig` and `DifferentiationConfig` are stored in a shared ScriptableObject:

```
Assets/Data/Shared/CarValidationConfig.asset
```

- Loaded via Addressables (`Shared/CarValidationConfig`)
- Extends ADR-0003's Shared group with one entry
- Contains: valid values array, default value, differentiation threshold, within-tier flag
- Loaded once at race init, consumed by validation logic

### Efficiency Modifier Flow

```
CarDefinition.stats.efficiency (int 0–20)
    ↓ (race init: int → float conversion)
efficiency_modifier (float, configurable formula)
    ↓ (per tick: consumed by)
FuelSystem.Tick() → fuel consumption rate
TireSystem.Tick() → tire wear rate
```

- Conversion happens once at race init (not per tick)
- Formula is a tuning knob (configurable, not hardcoded in this ADR)
- Both Fuel and Tire read the same `efficiency_modifier` value per car
- Cross-reference: ADR-0006 defines Fuel/Tire consumption; this ADR defines the source data

### Schema Accessors

```csharp
// Schema provides typed accessors for downstream systems
public struct CarStatsAccessor {
    private readonly CarStats _stats;
    
    // Int-to-float conversions (tuning knobs)
    public float TopSpeedKph => _stats.topSpeed; // formula applied by Vehicle Physics
    public float AccelerationSecs => _stats.acceleration; // formula applied by Vehicle Physics
    public float BrakePowerSecs => _stats.brakePower; // formula applied by Vehicle Physics
    public float GripMultiplier => _stats.gripLevel; // formula applied by Vehicle Physics
    public float StabilityMultiplier => _stats.stability; // formula applied by Vehicle Physics
    public float EfficiencyModifier => _stats.efficiency; // formula applied here (race init)
}
```

- Accessors are read-only (no mutation after load)
- Formula application is deferred to consumer systems (Vehicle Physics owns force formulas)
- Efficiency is the exception: formula applied at race init, result stored as float

## Alternatives Considered

### Alternative 1: JSON with Schema Validation
- **Description:** External JSON files validated against a JSON Schema
- **Pros:** Version control friendly, external tooling possible
- **Cons:** Requires custom deserializer, no Unity Editor integration
- **Rejection Reason:** ScriptableObjects provide Unity Editor integration and Addressables compatibility.

### Alternative 2: Authoring-Time Only Validation
- **Description:** Validate in Unity Editor, no runtime checks
- **Pros:** Zero runtime cost
- **Cons:** Corrupt data at runtime causes undefined behavior
- **Rejection Reason:** Load-time validation is cheap and prevents runtime crashes.

## Consequences

### Positive
- **Data-driven:** All values are tuning knobs, adjustable during playtesting
- **Safe defaults:** Missing fields clamped to configurable default
- **Clear differentiation:** Configurable threshold prevents perceptually identical cars
- **Future-proof:** Stat extensions don't break existing consumers

### Negative
- **Authoring-time warnings:** Differentiation check is advisory, not blocking
- **Two validation layers:** Load-time + authoring-time adds complexity (but both are cheap)

### Risks
- **Corrupt ScriptableObject:** Validated at load time, clamped to nearest valid value
- **Mitigation:** Content Pipeline error handling (ADR-0003)

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| car-definition-data.md | 6 stats per car | §Decision: ScriptableObject Schema |
| car-definition-data.md | Stats validated at load | §Decision: Load-Time Validation |
| car-definition-data.md | Differentiation rule | §Decision: Authoring-Time Differentiation Check |
| car-definition-data.md | Weight constant | §Decision: ScriptableObject Schema |
| car-definition-data.md | Team ID format | §Decision: File Organization |
| vehicle-physics.md | Stat consumption | §Decision: Stat Ownership |
| fuel-system.md | Efficiency modifier | §Decision: Stat Ownership (Efficiency row) |
| tire-system.md | Efficiency modifier | §Decision: Stat Ownership (Efficiency row) |

## Performance Implications

- **CPU:** Negligible — validation at load time only
- **Memory:** ScriptableObject overhead only
- **Load Time:** No impact — validation during asset load

## Validation Criteria

- [ ] All 16 car assets load without errors
- [ ] Stats clamped to nearest valid value (configurable)
- [ ] Missing fields default to configurable default
- [ ] Differentiation check runs in Editor (configurable threshold)
- [ ] Efficiency modifier consumed correctly by Fuel/Tire
- [ ] Weight constant for all cars

## Related Decisions

- ADR-0002: Vehicle Physics (consumes stats)
- ADR-0003: Content Pipeline (Addressables group)
- ADR-0006: Fuel/Tire (consumes efficiency_modifier)
- ADR-0009: AI Rival (consumes stats)
