# Milestone: Alpha

## Overview

- **Target Date**: TBD
- **Type**: Alpha
- **Duration**: TBD
- **Number of Sprints**: TBD

## Milestone Goal

Add asynchronous ghost sharing on top of the completed MVP: the player shares and downloads race ghosts through an online-services provider. Ghost-first ordering — async sharing in Alpha precedes real-time multiplayer in Beta. Alpha selects an online-services provider for identity and durable ghost storage; it does not select Beta's real-time racing SDK (ADR-0016).

## Success Criteria

- [ ] An online-services provider is selected via a new/amended Accepted ADR, evaluated against the 8 Alpha criteria (Identity, Durability, Authorization, Privacy, Quotas, Platform, Cost, Boundary) using current primary sources and a proof-of-concept (ADR-0016:83-94)
- [ ] Ghost sharing works: the player can share and download ghosts with authenticated identity and durable retention (not transient cache storage)
- [ ] Player identity is authenticated independently of device-local storage
- [ ] Privacy controls work: ghost deletion, export, and account-lifecycle support (ADR-0016 Decision 2)
- [ ] Access control is enforced — no public read/write by guessed object identifier
- [ ] Quota and rate-limit behavior is documented and handled
- [ ] Provider viability confirmed on PC and WebGL2, with browser limitations documented (ADR-0016 Alpha Platform criterion)
- [ ] Provider remains behind project-owned storage/auth interfaces — no provider type leaks into gameplay systems (ADR-0016:64, Boundary criterion)
- [ ] MVP behavior remains vendor-free — no Alpha change imports real-time SDK or transport types
- [ ] Ghost Recording persistence boundary is provider-agnostic (ADR-0008, ADR-0016)

## Feature List

### Must Ship (Milestone Fails Without These)

| Feature | Design Doc | Owner | Sprint Target | Status |
|---------|-----------|-------|--------------|--------|
| Ghost recording persistent stream (Alpha scope) | design/gdd/ghost-recording.md | ghost-recording epic | TBD | Deferred — post-MVP |
| Ghost sharing (upload/download) | design/gdd/multiplayer-architecture.md | multiplayer-architecture epic | TBD | Deferred — post-MVP |
| Online-services provider selection (ADR) | ADR-0016 | technical-director | TBD | Deferred — decision open |

### Should Ship (Planned but Cuttable)

| Feature | Design Doc | Owner | Sprint Target | Cut Impact | Status |
|---------|-----------|-------|--------------|-----------|--------|
| (none defined yet) | | | | | |

### Stretch Goals (Only if Ahead of Schedule)

| Feature | Design Doc | Owner | Value Add |
|---------|-----------|-------|----------|
| (none defined yet) | | | |

## Open Decisions (must close before Alpha implementation)

| Decision | Depends On | Current State |
|---------|-----------|---------------|
| Online-services provider selection | ADR-0016 criteria + fresh primary-source research | **TBD — deferred (ADR-0016)** |
| Alpha success criteria beyond the boundaries above | provider selection | TBD |

## Quality Gates

| Gate | Threshold | Measurement Method |
|------|-----------|-------------------|
| Provider selection ADR | Accepted, evaluated against all 8 Alpha criteria | ADR + proof-of-concept (ADR-0016 Validation Criteria) |
| No gameplay system imports provider/transport types | 0 imports outside project-owned interfaces | Code review / grep |
| No MVP build links a real-time SDK | 0 links | Build inspection (ADR-0017 Validation Criteria) |

## Risk Register

| Risk | Probability | Impact | Mitigation | Owner | Status |
|------|------------|--------|-----------|-------|--------|
| Provider market changes before selection | Medium | Selection may need re-evaluation | Fresh primary-source research mandatory at decision point (ADR-0016) | technical-director | TBD |
| Provider abstraction too narrow | Medium | Reintegration cost | Keep project-owned interfaces small and storage/auth-focused (ADR-0016) | technical-director | TBD |

## Dependencies

### Internal Dependencies

| Feature | Depends On | Owner of Dependency | Status |
|---------|-----------|-------------------|--------|
| Ghost sharing | MVP complete (race loop), Ghost Recording stream | MVP milestone | Not started |

### External Dependencies

| Dependency | Provider | Status | Risk if Delayed |
|-----------|---------|--------|----------------|
| Online-services provider | **TBD — not selected (ADR-0016)** | Deferred | Ghost sharing blocked until selection |

## Review Schedule

| Date | Review Type | Attendees |
|------|-----------|-----------|
| TBD | Provider selection review | Producer, technical-director |
| TBD | Milestone review | Full team |
