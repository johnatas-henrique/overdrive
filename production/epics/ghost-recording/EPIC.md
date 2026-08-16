# Epic: Ghost Recording

> **Layer**: Foundation
> **GDD**: design/gdd/ghost-recording.md
> **Architecture Module**: Ghost Recording (Foundation Layer — module ownership per docs/architecture/architecture.md:154-161)
> **Status**: Ready (enabling/traceability epic — MVP buffer is Simulation-owned)
> **Stories**: Not yet created — run `/create-stories ghost-recording`

## Overview

Ghost Recording preserves the authoritative `SimulationInput` boundary at 60 Hz for the MVP and provides the future replay layer. In MVP this is an **enabling/traceability epic, not an implementation epic**: the in-memory recordable buffer (12 bytes/tick continuous + standalone Pause edges, 22,500-tick cap, always discarded) is owned and implemented by the Simulation Kernel (ghost-recording.md:48-50, simulation-architecture.md:111-113, architecture.md:158), and its MVP requirements (TR-ghost-003/004/007) are accepted as Kernel acceptance criteria — no duplicate stories exist in both epics. This epic anchors the trace to Alpha: serialization format (80-byte header, magic `0x47485354`), per-256-tick-block CRC32 integrity, optional LZ4, the personal-best-only persistence gate, local ghost cache, and the `ghostStorage` interface (provider selected at the Alpha decision point per ADR-0016) are declared future-phase scope here and become implementation stories when Alpha is planned.

## Governing ADRs

| ADR | Decision Summary | Engine Risk |
|-----|-----------------|-------------|
| ADR-0008: Ghost Recording Data Format and MVP Buffer | 80-byte binary header; continuous input stream (12 bytes/tick × 3 × float32) + edge event stream (5 bytes/event); MVP buffer in-memory and discarded unconditionally | LOW |
| ADR-0001: Manual Simulation Authority and Determinism Boundary | GO lifecycle boundary captures `ReplayInitialState`; recordable boundary is Simulation-owned; MVP recordable stream is never serialized, compared, exposed, replayed, or uploaded | HIGH |
| ADR-0016: Multiplayer SDK Deferral and Boundary | Alpha selects an online-services provider for identity and durable ghost storage; `ghostStorage` is a generic interface — no provider API is named in MVP | HIGH |

## GDD Requirements

| TR-ID | Requirement | ADR Coverage | MVP Ownership |
|-------|-------------|--------------|---------------|
| TR-ghost-001 | Continuous 12 bytes/tick (3 x float32) plus edge event stream | ADR-0008 ✅ | Alpha — format definition; implementation deferred |
| TR-ghost-002 | 80-byte binary header with magic 0x47485354 and version field; fields total exactly 80 bytes (reserved byte[14]) | ADR-0008 ✅ | Alpha — format definition; implementation deferred |
| TR-ghost-003 | 22,500 tick cap; non-serializable only on attempted overflow beyond 22,500; never discard oldest ticks | ADR-0008 ✅ | **Simulation Kernel acceptance criterion** (MVP buffer behavior) |
| TR-ghost-004 | MVP buffer always discarded on Results/Forfeit/Idle/Load failure | ADR-0008 ✅ | **Simulation Kernel acceptance criterion** (MVP buffer behavior) |
| TR-ghost-005 | Alpha persistence gate: only new local personal best is serialized | ADR-0008, ADR-0016 ✅ | Alpha — persistence gate; implementation deferred |
| TR-ghost-006 | CRC32 is stored per 256-tick block and LZ4 is optional and version-flagged | ADR-0008 ✅ | Alpha — integrity; implementation deferred |
| TR-ghost-007 | ReplayInitialState captures race/content identity, seed, grid, cars, resources, and Perfect Start state at GO | ADR-0001, ADR-0008 ✅ | **Simulation Kernel acceptance criterion** (GO lifecycle capture) |

**Untraced requirements**: None — 7/7 covered by Accepted ADRs.

## Definition of Done

This epic is complete when:
- The Simulation Kernel's recordable buffer and `ReplayInitialState` capture satisfy TR-ghost-003/004/007, verified as Kernel acceptance criteria (no duplicate Ghost stories)
- The Alpha scope (TR-ghost-001/002/005/006: header format, CRC32 blocks, LZ4, PB persistence gate, local cache limit 5, `ghostStorage` upload/download/delete contract) is documented as declared future-phase work in this epic, with the ADR-0016 provider selection recorded as its gate
- Traceability is maintained: this epic is the anchor that Alpha planning uses to re-enter Ghost work without re-deriving the format

## Next Step

Run `/create-stories ghost-recording` to break this epic into implementable stories (MVP stories are limited to Kernel acceptance verification; Alpha stories are created when Alpha is planned).
