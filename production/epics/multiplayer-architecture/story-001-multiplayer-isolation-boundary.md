# Story 001: Multiplayer Isolation Boundary

> **Epic**: Multiplayer Architecture
> **Status**: Ready
> **Layer**: Foundation
> **Type**: Logic
> **Manifest Version**: 2026-08-05
> **Estimate**: 2-4h (M)

## Context

**GDD**: `design/gdd/multiplayer-architecture.md`
**Requirement**: `TR-multiplayer-001` — "MVP links no online-services or real-time SDK and creates no network traffic"
*(Requirement text lives in `docs/architecture/tr-registry.yaml` — read fresh at review time)*

**ADR Governing Implementation**:
- ADR-0016: Multiplayer SDK Deferral and Boundary — MVP selects no provider, no SDK linked, no transport imports.
- ADR-0017: Network Simulation Driver Interface and Beta Canonical State Model — publishes `INetworkSimulationDriver` (D2) as the project-owned seam.
- ADR-0001: Manual Simulation Authority and Determinism Boundary — the future network driver may replace the local driver without changing `SimulationInput`, `CarState`, tick, or state contracts.

**ADR Decision Summary**: MVP links no online-services or real-time SDK and creates no network traffic; gameplay systems import no transport/provider types; the ADR-0017 `INetworkSimulationDriver` seam is published as a project-owned interface in an isolated assembly with no provider implementation.

**Engine**: Unity 6000.3.19f1 (Unity 6.3 LTS) | **Risk**: HIGH (ADR knowledge risk — no provider selected)

**Engine Notes**: No online-services or real-time networking package is approved or installed (ADR-0016 post-cutoff APIs: None). Provider evaluation must be re-run at Alpha/Beta selection; not in this story.

**Control Manifest Rules (Foundation layer)**:
- Required: Simulation assembly boundary — `Overdrive.Simulation` is engine-free (`noEngineReferences: true`), one-way Input → Simulation.
- Forbidden: no gameplay assembly imports transport/provider types (ADR-0016 validation criteria).
- Guardrail: no network SDK package linked in MVP builds (ADR-0016).

---

## Acceptance Criteria

*From GDD `design/gdd/multiplayer-architecture.md` (AC-NP1) + ADR-0016/0017, scoped to this story — validated by QL-STORY-READY gate (6 rounds, ADEQUATE 2026-08-12):*

- [ ] **AC-1 (seam published)**: `INetworkSimulationDriver` exists in assembly `Overdrive.Multiplayer` (Assets/source/Multiplayer/Overdrive.Multiplayer.asmdef) with exactly the ADR-0017 D2 signatures: `void SubmitInputs(ReadOnlySpan<SimulationInput> localInputs, uint simulationFrame)`, `int SerializeSnapshot(in PublishedSimulationSnapshot snapshot, Span<byte> destination)`, `void Rollback(uint toFrame, in SimulationRollbackState state)`, `NetworkInput GetPredictedInput(int carId, uint frame)`, `event RemoteInputsReceivedHandler RemoteInputsReceived`. Delegate: `public delegate void RemoteInputsReceivedHandler(uint simulationFrame, ReadOnlySpan<NetworkInput> inputs)`. NO provider implementation in MVP.
- [ ] **AC-2 (isolated engine-free)**: `Overdrive.Multiplayer.asmdef` references ONLY `Overdrive.Simulation` + `Unity.Mathematics` (direct — Unity asmdef references are not transitive), has `noEngineReferences: true`, and contains no MonoBehaviour, UnityEngine, transport, or provider types.
- [ ] **AC-3 (contract types)**: `SimulationRollbackState` (public readonly struct: `Positions`, `Rotations`, `LinearVelocities`, `AngularVelocities` — 16-element zero-allocation wrappers `Vector3Array16`/`QuaternionArray16`, per architecture.md:620-626) and `NetworkInput` (public struct, minimal placeholder `SimulationFrame` field; Beta 14-byte layout NOT committed per GDD:88-102) exist in namespace `Overdrive.Multiplayer`. Wrapper factories fail closed (ArgumentException on null/wrong length, never NRE).
- [ ] **AC-4 (isolation guardrail, static, fail-closed, editor-aware)**: A static assembly-graph scan proves the gameplay assembly manifest (`Overdrive.Input`, `Overdrive.Simulation`, `Overdrive.Multiplayer`) references NO forbidden namespace (denylist, exact boundary match: `Unity.Services`, `Unity.Netcode`, `Mirror`, `Photon`, `Coherence`, `Fusion`, `Unity.Transport`; `UnityEngine.Networking`/`UnityWebRequest` explicitly allowed). Editor-only assemblies (`includePlatforms` has "Editor") are excluded. Any non-editor asmdef under `Assets/source/` not in the manifest → test FAILS.
- [ ] **AC-5 (manifest denylist, deterministic)**: A test parses `Packages/manifest.json` + `packages-lock.json` and asserts none of the denylisted package IDs (`com.unity.netcode.gameobjects`, `com.unity.transport`, `io.fusion`, `com.coherence`, `com.mirrorng`, `org.photonengine`) appear as dependency keys; `com.unity.multiplayer.center` allowed (built-in editor); `com.unity.multiplayer.playmode` fails if present in manifest OR as runtime dependency in lock.
- [ ] **AC-6 (no provider implementation)**: A reflection scan over all loaded assemblies asserts the set of concrete types implementing `INetworkSimulationDriver` is EMPTY in MVP.
- [ ] **AC-7 (deferral)**: Alpha/Beta ACs (AC-NP2/3, AC-CP1-3, AC-GF1-3, AC-DC1-3) are declared future-phase criteria, verified by absence in this story.

---

## Implementation Notes

*Derived from ADR-0016/0017 Implementation Guidelines:*

- **Seam signatures**: Copy the interface EXACTLY from ADR-0017:70-80 — parameter order, `in` modifiers, return types, and the event are contract. Wrong spelling (`INetworkSimulatorDriver`) or wrong signature fails the QA gate.
- **Namespace/usings**: Contracts live in `namespace Overdrive.Multiplayer`. Files require `using System;` (ReadOnlySpan/Span), `using Overdrive.Input;` (`SimulationInput` — its namespace is `Overdrive.Input` despite compiling in the Simulation assembly), `using Overdrive.Simulation;` (`PublishedSimulationSnapshot`), `using Unity.Mathematics;`.
- **Assembly dependency**: `Overdrive.Multiplayer.asmdef` references `Overdrive.Simulation` + `Unity.Mathematics` (direct). Unity asmdef references are NOT transitive for direct source use — direct `Unity.Mathematics` is required (precedent: InterpolationTests.asmdef).
- **Cycle prevention (Beta)**: Simulation NEVER references `INetworkSimulationDriver` — ADR-0017 D6 defines the driver as a guest of the manual accumulator; the composition root owns wiring. No future asmdef cycle.
- **Zero-allocation wrappers**: `Vector3Array16`/`QuaternionArray16` per architecture.md:620 "zero-allocation wrapper template" — fixed-length 16, no array/list backing storage. If they don't exist yet, this story creates them in `Overdrive.Multiplayer`.
- **Detection mechanism**: The isolation test uses recursive `Assembly.GetReferencedAssemblies()` graph scan + asmdef reference parsing — NOT runtime type reflection (misses method-body-only usage). This catches assembly-level transport imports.
- **Package rule**: parse both manifest.json and packages-lock.json as JSON; match dependency keys exactly (unrelated text occurrences don't count).

---

## Out of Scope

*Handled by neighbouring stories, epics, or future phases — do not implement here:*

- Runtime no-traffic smoke (AC-NP1 runtime half) → assembly gate (TD-022 registered)
- Beta 14-byte `NetworkInput` layout → Beta phase (GDD:88-102 marks it Beta candidate)
- Provider implementation → never in MVP
- Alpha/Beta ACs (AC-NP2/3, AC-CP1-3, AC-GF1-3, AC-DC1-3) → declared future-phase criteria, stories created when those phases are planned
- Rollback replay pipeline / `driver.Rollback` semantics → Beta (ADR-0017 D4)

---

## QA Test Cases

*Written by qa-lead at story creation (QL-STORY-READY gate, round 6). The developer implements against these — do not invent new test cases during implementation.*

**AC-1 — Driver seam**
- Given: `Overdrive.Multiplayer` is loaded.
- When: Reflection inspects `INetworkSimulationDriver` and `RemoteInputsReceivedHandler`.
- Then: The interface contains exactly `SubmitInputs(ReadOnlySpan<SimulationInput>, uint)`, `int SerializeSnapshot(in PublishedSimulationSnapshot, Span<byte>)`, `void Rollback(uint, in SimulationRollbackState)`, `NetworkInput GetPredictedInput(int, uint)`, `event RemoteInputsReceivedHandler RemoteInputsReceived`. The delegate is `void RemoteInputsReceivedHandler(uint, ReadOnlySpan<NetworkInput>)`.
- Edge cases: wrong legacy interface name, incorrect parameter order, missing `in`, incorrect return type, missing event, or incorrect delegate namespace fails.

**AC-2 — Engine-free isolation**
- Given: `Overdrive.Multiplayer.asmdef` and its compiled assembly.
- When: The asmdef and metadata/type references are inspected.
- Then: `noEngineReferences` is `true`, and no `MonoBehaviour`, `UnityEngine`, or transport dependency is referenced.
- Edge cases: `Unity.Mathematics` is allowed; `UnityEngine.Networking`/`UnityWebRequest` is allowed; any forbidden transport namespace fails.

**AC-3 — Contract types and rollback wrappers**
- Given: Sixteen distinct `float3` positions, rotations, linear velocities, and angular velocities.
- When: The wrapper factories construct a `SimulationRollbackState`.
- Then: Each wrapper reports `Count == 16`, preserves all sixteen values through indexed access, and contains no array/list backing storage.
- Edge cases: null, 15 elements, or 17 elements throws `ArgumentException`; source mutation after construction does not mutate the wrapper; all four rollback fields are present and readonly.

**AC-4 — Assembly isolation guardrail**
- Given: All `Assets/source/**/*.asmdef` files and loaded gameplay assemblies.
- When: The test parses asmdef references and recursively scans assembly references.
- Then: The only non-editor gameplay assemblies are `Overdrive.Input`, `Overdrive.Simulation`, `Overdrive.Multiplayer`. No forbidden namespace or assembly boundary is present.
- Edge cases: unclassified non-editor asmdef fails; editor-only asmdefs are excluded; nested references are scanned recursively; `Unity.ServicesX` is not treated as an exact `Unity.Services` match; allowed Unity networking APIs do not fail.

**AC-5 — Package manifest denylist**
- Given: `Packages/manifest.json` and `Packages/packages-lock.json`.
- When: The deterministic package predicate runs.
- Then: All denylisted package IDs fail. `com.unity.multiplayer.center` passes when marked built-in. `com.unity.multiplayer.playmode` passes only when absent from both files.
- Edge cases: playmode in manifest always fails; runtime/non-editor playmode entry in lock fails; built-in/editor-marked lock entry passes only when absent from manifest; unrelated text occurrences do not count as dependency keys.

**AC-6 — No provider implementation**
- Given: All loaded assemblies and `INetworkSimulationDriver`.
- When: Reflection finds non-abstract concrete assignable types.
- Then: The result set is empty.
- Edge cases: interfaces and abstract classes are excluded; the test assembly must not define a concrete provider fake; a provider loaded from any additional assembly fails.

**AC-7 — Alpha/Beta deferral**
- Given: The MVP source tree, asmdefs, package files, and loaded assemblies.
- When: The absence checks run.
- Then: No Alpha/Beta provider implementation, transport package, runtime networking behavior, or concrete `INetworkSimulationDriver` exists; only the project-owned seam and contract types are present.
- Edge cases: future-phase comments/documentation are allowed; provider names in documentation do not count as implementations; any compiled provider type or runtime package dependency fails.

---

## Test Evidence

**Story Type**: Logic
**Required evidence** (file names describe the system, NOT the story — no `StoryXXX`/`story-NNN` prefixes; matches `[SystemName]Tests.cs` class):
- Logic: `Assets/tests/unit/multiplayer/MultiplayerIsolationTests.cs` + `Assets/tests/unit/multiplayer/MultiplayerUnitTests.asmdef` (with `optionalUnityReferences: ["TestAssemblies"]`, references `Overdrive.Multiplayer`, `Overdrive.Simulation`, `Unity.Mathematics`) — must exist and pass

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 2-8 (Simulation Kernel — Determinism & Replay) for `SimulationInput`, `PublishedSimulationSnapshot` contract types
- Unlocks: None (constraint epic — future Alpha/Beta stories)
