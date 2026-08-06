# ADR-0016: Online Services Deferral and Alpha Selection Boundary

## Status
Accepted (2026-08-05). MVP links no online-services or real-time SDK. Alpha selects an online-services provider for identity and durable ghost storage; Beta separately selects a real-time racing SDK (ADR-0017).

## Date
2026-08-05

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Domain** | Online services and networking boundaries |
| **Knowledge Risk** | HIGH. No provider is selected. Alpha and Beta selection research must use current primary sources. |
| **References Consulted** | `docs/research/coherence-architecture-verification-2026-08-05.md`, `docs/research/multiplayer-networking-comparison-2026.md`, `docs/engine-reference/unity/modules/networking.md` |
| **Post-Cutoff APIs Used** | None. No online-services or real-time networking package is approved or installed. |
| **Verification Required** | Re-run provider evaluation immediately before Alpha selection and real-time SDK evaluation immediately before Beta selection. |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0001 (manual simulation authority), ADR-0008 (Ghost Recording lifecycle) |
| **Enables** | Alpha online-services provider selection; ADR-0017 Beta real-time driver boundary |
| **Blocks** | No MVP behavior. Alpha ghost sharing blocks until an online-services provider is selected. |
| **Ordering Note** | Alpha selects identity and durable ghost-storage services. Beta separately selects a real-time racing SDK. Neither decision implies the other provider. |

## Context

### Problem Statement

MVP is offline single-player. Alpha needs an online-services provider only when
ghost sharing requires account identity, durable storage, privacy controls,
quota handling, and retry behavior. Beta later needs a real-time racing SDK
for rooms, transport, input delivery, prediction, and reconciliation.

Those are different decisions. Selecting one provider now would couple the
project to vendor assumptions before either Alpha or Beta needs that provider.
Selecting Alpha storage/auth services must not silently select Beta's real-time
racing stack.

### Constraints

- MVP is offline single-player: no connection, transport, room, or traffic.
- MVP gameplay systems never import transport types or provider runtime state.
- Alpha ghost sharing requires durable retention, authenticated ownership, and
  access control; transient or open-by-identifier storage is insufficient.
- Beta canonical multiplayer state must not depend on local PhysX
  (ADR-0001:144).
- WebGL2 remains a target platform. Transport compatibility is evaluated only
  with the chosen Beta real-time SDK; no WebGL transport is selected here.
- `com.unity.netcode.gameobjects`, DOTS, Coherence, and other network packages
  remain uninstalled until an Accepted selection ADR approves one.

### Requirements

- Alpha and Beta provider choices must remain independent.
- Provider choices must use current primary-source evidence, not stale market
  comparisons or training-era assumptions.
- Ghost-first ordering remains: async sharing in Alpha precedes real-time
  multiplayer in Beta.
- Provider abstraction must prevent online-service and transport types from
  leaking into gameplay systems.

## Decision

1. **MVP selects no provider.** No online-services or real-time networking SDK
   is approved, linked, or imported.
2. **Alpha selects an online-services provider only.** Its scope is player
   identity, durable ghost storage, privacy/deletion/export, quota and rate
   limits, retry behavior, and platform viability.
3. **Beta separately selects a real-time racing SDK.** Its scope is rooms,
   transport, input delivery, clock alignment, prediction, reconciliation, and
   the concrete implementation of ADR-0017's driver boundary.
4. **Coherence is a candidate, not a project dependency.** Its current Cloud
   Storage documentation reports one-hour retention and open access by known
   object identifier; it cannot be assumed suitable for durable ghost sharing
   without fresh Alpha validation.
5. **All selections require a new or amended Accepted ADR at the decision
   point.** This ADR declares timing and criteria; it selects no vendor.

### Alpha Online-Services Selection Criteria

| Criterion | Requirement |
|---|---|
| Identity | Authenticated player identity independent of device-local storage |
| Durability | Retention appropriate for persistent ghosts, not transient cache storage |
| Authorization | Per-player or server-enforced access control; no public read/write by guessed identifier |
| Privacy | Deletion, export, and account-lifecycle support |
| Quotas | Documented object-size, request-rate, and storage limits |
| Platform | PC and WebGL2 viability with documented browser limitations |
| Cost | Cost model covers expected Alpha ghost volume and player growth |
| Boundary | Provider can remain behind project-owned storage/auth interfaces |

### Beta Real-Time Selection Criteria

ADR-0017 owns the SDK-agnostic real-time contract. The future Beta evaluation
must determine the concrete topology, transport, clock-alignment mechanism,
input reliability behavior, rollback support, WebGL viability, room capacity,
cost, and guest compatibility with the manual simulation accumulator.

## Alternatives Considered

### Alternative 1: Select Coherence now
- **Description**: Treat Coherence as the chosen services and real-time stack.
- **Pros**: Immediate concrete APIs and vendor documentation.
- **Cons**: Current primary-source evidence shows constraints incompatible with
  assuming durable ghost storage; real-time suitability remains a future
  evaluation rather than an accepted project fact.
- **Rejection Reason**: The project has no Alpha or Beta implementation need
  yet, and the evidence does not justify a pre-commitment.

### Alternative 2: Select one provider for Alpha and Beta
- **Description**: Require Alpha online services to also become the future
  real-time racing stack.
- **Pros**: One vendor relationship and fewer integrations.
- **Cons**: Storage/auth requirements do not determine rollback, relay,
  prediction, WebGL real-time transport, or 16-car simulation suitability.
- **Rejection Reason**: It makes Alpha select a Beta architecture prematurely.

### Alternative 3: No ADR; rely on GDD wording
- **Description**: Leave timing and provider choice solely in design documents.
- **Pros**: Less documentation.
- **Cons**: No ratified boundary, no decision owner, and no enforceable
  protection against premature package imports.
- **Rejection Reason**: The boundary is architectural and affects multiple
  systems.

## Consequences

### Positive
- MVP remains vendor-free and transport-independent.
- Alpha can select a provider fit for durable ghost sharing without prejudging
  Beta real-time racing.
- Coherence remains available for future comparison without unsupported claims.
- Beta can evaluate current SDKs against ADR-0017's actual integration needs.

### Negative
- Alpha and Beta may use different providers.
- Two future market evaluations are required.
- Ghost sharing cannot begin until Alpha selects a provider.

### Risks
- Provider markets change before either phase; fresh primary-source research is
  mandatory at each decision.
- Alpha provider abstractions may be too narrow for future product needs; keep
  project-owned interfaces small and storage/auth-focused.
- Beta rollback requirements may exceed the current performance budget; ADR-0017
  records an empirical gate before implementation.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|---|---|---|
| multiplayer-architecture.md | MVP transport independence | Ratifies no provider and no transport import in MVP |
| multiplayer-architecture.md | Alpha ghost sharing | Defers provider selection to Alpha with durable-storage criteria |
| multiplayer-architecture.md | Beta 16-player racing | Defers real-time SDK selection to Beta and ADR-0017 |
| ghost-recording.md | Alpha persistence boundary | Keeps Ghost Recording provider-agnostic until Alpha |
| simulation-architecture.md | No local-PhysX canonical state | Preserves ADR-0001 constraint for Beta |

## Performance Implications
- **MVP:** no network CPU, memory, load-time, or bandwidth cost.
- **Alpha/Beta:** establish budgets only after the selected provider and real
  network profile are measured.

## Migration Plan

None in MVP. At Alpha, create or amend an ADR selecting the online-services
provider against the Alpha criteria. At Beta, create or amend an ADR selecting
the real-time SDK against ADR-0017's integration contract and measured network
conditions.

## Validation Criteria
- MVP builds contain no selected online-services or real-time SDK package.
- No gameplay system imports provider or transport types in MVP.
- Alpha selection evaluates every Alpha criterion against current primary
  sources and a proof-of-concept.
- Beta selection evaluates ADR-0017's contract against current primary sources
  and an empirical network/performance prototype.

## Related Decisions
- ADR-0001 (manual simulation authority and determinism boundary)
- ADR-0008 (Ghost Recording data format and MVP buffer)
- ADR-0017 (network simulation driver and Beta reconciliation boundary)
