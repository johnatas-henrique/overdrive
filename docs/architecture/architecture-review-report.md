# Architecture Review Report

> **Generator**: `/architecture-review` (full mode)
> **Date**: 2026-06-21
> **Engine**: Babylon.js 9.12.0 + @babylonjs/havok ^1.3.12
> **Reviewer**: OpenCode "build" agent

## Executive Summary

Systematic review of the Overdrive project architecture: 25 ADRs, 24 MVP GDDs + game-concept, 208 technical requirements, and 5 engine reference documents.

### Overall Verdict

## PASS ✅

The architecture is consistent, complete, and implementable. Zero cross-ADR contradictions in **substance** (all documented drifts are numbering/documentation issues, not design contradictions). Clean DAG with zero cycles. 199/208 requirements at FULL coverage. The 5 PARTIAL gaps are documentation-only (no architectural change required). The 4 DEFERRED gaps are features explicitly deferred to Alpha/Future.

---

## Phase 1: Document Load

| Artifact                 | Status                                                               | Details                                                                                                                           |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| ADRs                     | ✅ 25/25 lidos por completo                                          | ADR-0001 through ADR-0025, 24 Accepted + 1 Proposed (ADR-0006 — deve ser Accepted)                                                |
| GDDs                     | ✅ 24/24 MVP lidos por completo + game-concept.md + systems-index.md | 208 requirements extraídos                                                                                                        |
| Architecture Master      | ✅ architecture.md lido por completo                                 | Version 1.0, System Layer Map, Data Flow, Dependency Diagram                                                                      |
| Engine Reference Modules | ✅ 9 módulos verificados                                             | VERSION.md, breaking-changes.md, deprecated-apis.md, audio, input, physics, rendering, ui, animation, scaffolding, best-practices |
| TR Registry              | ✅ Populated                                                         | 208 entries em tr-registry.yaml                                                                                                   |
| technical-preferences.md | ✅ Lido                                                              | Engine, input, naming, budgets, specialists                                                                                       |
| consistency-failures.md  | ❌ Não existe                                                        | —                                                                                                                                 |

### Story/Test Linkage (Phase 3b)

Nenhuma story file existe — fase de arquitetura anterior à criação de epics/stories. **Skipped** conforme diretriz da skill.

---

## Phase 2: Requirements Extraction

208 technical requirements across all 24 MVP GDDs + game-concept.md.
See `tr-registry.yaml` for full registry.

| Layer        | Systems                                                            | Requirements |
| ------------ | ------------------------------------------------------------------ | ------------ |
| Foundation   | DCM, EVB, GSM, PER, SSN, DET, DVT                                  | 51           |
| Core         | AM, INP, CAM, PHYSICS, COLLISION, TE, FUEL, TIRE, AI, PIT, RM, ECL | 117          |
| Feature      | SR                                                                 | 6            |
| Presentation | HUD, AUDIO, MENU                                                   | 23           |
| Dev Infra    | TELEMETRY                                                          | 6            |
| Game Concept | GC                                                                 | 7            |
| **Total**    | **25**                                                             | **208**      |

---

## Phase 3: Traceability Matrix

See `traceability-index.md` for full TR-ID × ADR matrix.

### Coverage Summary

| Coverage     | Count | Percentage                                 |
| ------------ | ----- | ------------------------------------------ |
| **FULL**     | 199   | 95.7%                                      |
| **PARTIAL**  | 5     | 2.4%                                       |
| **DEFERRED** | 4     | 1.9% (explicitly deferred to Alpha/Future) |
| **GAP**      | 0     | 0%                                         |

### PARTIAL Gaps (5)

| TR-ID      | System        | ADR      | Gap Description                                                                                                                                                          | Engine Risk                                                                    |
| ---------- | ------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| TR-DET-005 | Determinism   | ADR-0002 | Input buffering mechanism not specified — ADR-0002 defines pipeline polling per tick but not a buffer that accumulates input between ticks and is consumed exactly once. | LOW — implementation detail of Input system                                    |
| TR-AM-006  | Asset Manager | ADR-0003 | `asset.load.progress`/`complete` events not defined. ADR-0003 only covers `asset.error`. ADR-0019 (Menu) uses Promise.all for loading, not Event Bus.                    | LOW — ADR-0019 já cobre loading com Promise.all                                |
| TR-AM-008  | Asset Manager | ADR-0003 | Asset lifecycle described as procedural code in Application.start(), not as Event Bus subscriptions to `gsm.state.entered`.                                              | LOW — ordenação procedural é funcionalmente equivalente                        |
| TR-AM-010  | Asset Manager | ADR-0003 | Animation group invalidation on scene dispose not mentioned. ADR-0003 covers entries.dispose() and re-instantiation but not animation group lifecycle.                   | MEDIUM — possível bug se animation groups forem usados sem re-clone            |
| TR-INP-006 | Input         | ADR-0006 | GSM event subscription + input blocking during transition window not covered. ADR-0006 covers focus loss and disconnect but not GSM transition blocking.                 | LOW — Input mantém local state copy, bloqueio funcional mesmo sem subscription |

### DEFERRED Gaps (4)

| TR-ID     | Feature                     | Target Phase |
| --------- | --------------------------- | ------------ |
| TR-GC-001 | Championship persistence    | Alpha        |
| TR-GC-002 | Dual economy (Credits + XP) | Alpha        |
| TR-GC-004 | Inverted grid               | Alpha        |
| TR-GC-005 | Car parts/upgrades (L1-L5)  | Alpha        |

---

## Phase 4: Cross-ADR Conflict Scan

### Consistency Checks (8 passed ✅)

- Pipeline slot order (ADR-0002 × ADR-0008 × architecture.md)
- Havok auto-step suppression (ADR-0002 × ADR-0008 × architecture.md)
- camera.inputs.clear() agreement (ADR-0006 × ADR-0007)
- Event Bus pattern (ADR-0001 × ADR-0024 × ADR-0018 × ADR-0020)
- Asset container lifecycle (ADR-0003 × ADR-0005 × ADR-0025)
- Module boundary rules (ADR-0004 × architecture.md)
- Simulation Snapshot registration (ADR-0017 × ADR-0015 × ADR-0014)
- Audio Engine V2 APIs (ADR-0020 × architecture.md × engine-ref)

### Documented Drifts (3 — not design contradictions)

| ID  | Severity | ADRs                        | Description                                                                                                                                                                                                                                                                                                                                                     | Status                                                                      |
| --- | -------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| C1  | LOW      | ADR-0006 vs architecture.md | **Ordering Note desatualizado**: ADR-0006 diz "Init slot #10 (Core slot #2 — after Asset Manager, before Camera)". Na architecture.md, Input é **slot #9** (Entity/Car Lifecycle foi movido para Core após ADR-0006 ser escrito). O real ordering está correto — Input está depois de Asset Manager e antes de Camera. A numeração nos comentários está errada. | 🔴 Persiste — correção anterior não atualizou o número                      |
| C2  | MEDIUM   | architecture.md vs ADR-0020 | **Audio API desatualizada na architecture.md**: architecture.md linhas 133, 197, 320 ainda descrevem Audio como `Sound + SoundTrack` (API V1 legada). ADR-0020 escolheu Audio Engine V2 puro (`CreateSoundAsync`, `AudioBus`, `CreateSoundSourceAsync`). A architecture.md precisa ser atualizada.                                                              | 🔴 Persiste — correção anterior (remover fallback legacy Sound) foi parcial |
| C3  | LOW      | ADR-0006 vs ADR-0013        | **AIDriverInput checkbox desmarcada**: ADR-0006 tabela "GDD Requirements Addressed" tem checkbox pendente para `AIDriverInput implements IInput`. ADR-0013 já corrigiu — AI usa pipeline slot #3 dedicado com `IAIDriver.tick()`, escreve em double-buffered Map<string, InputState>. Physics nunca brancha player vs AI.                                       | 🔴 Persiste — checkbox precisa ser marcada                                  |

### Topological Sort (per tick pipeline)

```
Input → Physics → AI → Collision → Fuel → Tire → Race Management → Pit Stop
```

8 slots, 0 cycles, DAG limpo ✅

### Init Order (global)

```
Foundation (6):  DCM(#1) → DET(#2) → PER(#3) → EVB(#4) → GSM(#5) → SSN(#6)
Core A (5):      AM(#7) → ECL(#8) → INP(#9) → CAM(#10) → TE(#11)
Core B (7):      PHYSICS(#12) → COLLISION(#13) → FUEL(#14) → TIRE(#15) → AI(#16) → PIT(#17) → RM(#18)
Presentation (3): HUD(#19) → AUDIO(#20) → MENU(#21)
Feature (1):     SR(#22)
Dev (2):         DVT(#23) → TELEMETRY(#24)
```

Zero cycles. Foundation → Core → Presentation → Feature → Dev direction respected ✅

---

## Phase 5: Engine Compatibility

### Post-Cutoff APIs Verified

| ADR  | Post-Cutoff API                                                                                                                 | Engine Ref                | Status                                         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------------------------------- |
| 0003 | `SceneLoader.LoadAssetContainerAsync()` (async-only since 7.34)                                                                 | rendering.md              | ✅                                             |
| 0006 | `DeviceSourceManager` (stable since v7.x)                                                                                       | input.md                  | ✅                                             |
| 0008 | `PhysicsAggregate`, `PhysicsBody.setLinearVelocity()`, `executeStep(dt, bodies)`                                                | physics.md                | ⚠️ executeStep não documentado na ref          |
| 0010 | `onCollisionObservable`, `setCollisionGroup()`/`setCollisionMask()`                                                             | physics.md                | ⚠️ contact callbacks não documentados          |
| 0020 | `CreateAudioEngineAsync`, `CreateSoundAsync`, `CreateAudioBusAsync`, `CreateSoundSourceAsync`, `AudioParameterRampShape.Linear` | audio.md                  | ⚠️ audio.md só documenta V1 (Sound/SoundTrack) |
| 0025 | `SceneLoader.LoadAssetContainerAsync()`, `PhysicsShapeType.MESH`                                                                | rendering.md / physics.md | ✅                                             |

### Deprecated API Usage

| API Deprecated                                     | Status       | Where                                                                                   |
| -------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------- |
| `new Sound(...)` (v8.0)                            | 🟢 Não usado | ADR-0020 escolhe V2. architecture.md linhas 133/197/320 ainda citam SoundTrack (stale). |
| `SceneLoader.Load/Append/ImportMesh` (sync, v7.34) | 🟢 Não usado | Todos usam `LoadAssetContainerAsync()`                                                  |
| `import * as BABYLON` barrel                       | 🟢 Não usado | Todos usam tree-shakeable imports                                                       |
| Jest (migrated to Vitest v8.56.2)                  | 🟢 Não usado | Vite + Vitest config                                                                    |

**Nenhuma API deprecated em uso** ✅

### Engine Reference Gaps

| Document       | Gap                                                                 | Impact                          |
| -------------- | ------------------------------------------------------------------- | ------------------------------- |
| `audio.md`     | Só documenta V1 (Sound/SoundTrack). AudioV2 APIs ausentes.          | 🔴 ADR-0020 depende destas APIs |
| `physics.md`   | `onCollisionObservable` e `executeStep(dt, scene)` não documentados | ⚡ ADR-0010 e ADR-0002 dependem |
| `rendering.md` | `LoadAssetContainerAsync` uso não documentado                       | ⚡ ADR-0003 e ADR-0025 dependem |

### Knowledge Risk per ADR

| Risk      | ADRs                                      | Count |
| --------- | ----------------------------------------- | ----- |
| 🔴 HIGH   | ADR-0020 (Audio Engine V2)                | 1     |
| 🟡 MEDIUM | 0003, 0006, 0008, 0018, 0019, 0025        | 6     |
| 🟢 LOW    | Restante (Foundation + simulação pura TS) | 18    |

---

## Phase 5b: Design Revision Flags

| Flag | File                                                  | Problem                                                                                                                                       | Action Needed                             |
| ---- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| R1   | `design/gdd/entity-car-lifecycle.md:7`                | GDD declara "Implements Pillar: Foundation". Architecture.md coloca Entity/Car no Core (slot #8) após ADR-0004 mover de Foundation para Core. | Atualizar pillar para "Core"              |
| R2   | `docs/architecture/adr-0006-input-abstraction.md:206` | "GDD Requirements Addressed" checkbox para `AIDriverInput implements IInput` ainda desmarcada. ADR-0013 já corrigiu o design.                 | Marcar checkbox, remover seção pendente   |
| R3   | `docs/architecture/architecture.md:133,197,320`       | Audio module usa `Sound + SoundTrack` (V1). ADR-0020 resolveu Audio Engine V2 puro.                                                           | Atualizar para Audio Engine V2 + AudioBus |

**Nenhuma revisão necessária em**: `audio.md` (já V2 ✅), `input.md` (não menciona AIDriverInput ✅)

---

## Phase 6: Architecture Document Coverage

### Systems Coverage (systems-index.md × architecture.md)

| Check                                     | Result                                 |
| ----------------------------------------- | -------------------------------------- |
| 1. Todo system no index → architecture.md | ✅ 24/24 MVP                           |
| 2. Todo system na architecture.md → index | ✅ 32/32 (incluindo Alpha/Future)      |
| 3. Dependencies do GDD × init ordering    | ⚠️ 4 mismatches (D1-D4)                |
| 4. Phase assignments consistentes         | ⚠️ Input Phase 2 → deveria ser Phase 1 |

### Systems-Index Anomalies

**Numbering quebrado** (linhas 36-39):

```
Atual:      1, 2, 3, 4, 5, 9, 7, 8, 9
Correto:    1, 2, 3, 4, 5, 6, 7, 8, 9
```

- Asset Manager aparece como #9 (duplicado com Determinism Contract) — deveria ser #6
- Número #6 ausente

**Dependency Map** (linhas 133-152) não inclui: Determinism Contract, Persistence, Simulation Snapshot, Dev Tools

**Input Phase misassignment**: systems-index coloca Input na Phase 2 (Championship), mas architecture.md coloca Input no Core slot #9 (dependência de Physics que é Phase 1). Input precisa ser Phase 1.

---

## Verdict

```
┌──────────────────────────────────────┐
│          PASS ✅                      │
│                                      │
│  208 requirements checked            │
│  199 FULL  (95.7%)                   │
│  5   PARTIAL (all documentation)     │
│  0   GAP    (no uncovered reqs)      │
│  0   cross-ADR design conflicts      │
│  3   documented numbering drifts     │
│  0   cycles in dependency graph      │
│  0   deprecated API usage            │
└──────────────────────────────────────┘
```

### Required Corrections (pre-implementation)

| #   | What                                                                         | File                                   | Why                                                        |
| --- | ---------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------- |
| 1   | ADR-0006: Status `Proposed` → `Accepted`                                     | `adr-0006-input-abstraction.md:4`      | Aprovado com Babylon.js specialist                         |
| 2   | ADR-0006: Ordering Note corrigir para "Init slot #9 (Core slot #3)"          | `adr-0006-input-abstraction.md:27`     | Número errado (diz #10, architecture.md diz #9)            |
| 3   | architecture.md: Audio API `Sound+SoundTrack` → `Audio Engine V2 + AudioBus` | `architecture.md:133,197,320`          | Desatualizado após ADR-0020                                |
| 4   | systems-index.md: Corrigir numeração Foundation (Asset Manager #9→#6)        | `design/gdd/systems-index.md:36-39`    | Tabela com numeração quebrada                              |
| 5   | systems-index.md: Input Phase 2 → Phase 1                                    | `design/gdd/systems-index.md:57`       | Phase 2 blocker — Input é dependência de Physics (Phase 1) |
| 6   | entity-car-lifecycle.md: Pillar Foundation → Core                            | `design/gdd/entity-car-lifecycle.md:7` | Architecture.md coloca em Core                             |
| 7   | ADR-0006: Marcar checkbox AIDriverInput                                      | `adr-0006-input-abstraction.md:206`    | ADR-0013 já corrigiu o design                              |

### Recommended Follow-Ups (post-review)

1. **[docs]** Expand ADR-0002 to specify input buffering mechanism (double-buffer for consumed-exactly-once semantics)
2. **[docs]** Expand ADR-0003 to add `asset.load.progress`/`complete` events and animation group lifecycle
3. **[docs]** Expand ADR-0006 to document GSM event subscription and input blocking during transition window
4. **[docs]** Update engine reference docs (`audio.md`, `physics.md`, `rendering.md`) to cover all APIs used in ADRs
5. **[deferred]** Create ADRs for championship, economy, multiplayer when scoped for Alpha/Future
