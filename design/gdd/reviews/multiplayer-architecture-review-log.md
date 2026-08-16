# Review Log: Multiplayer Architecture — Overdrive

## Lean Review — 2026-07-24 — Verdict: NEEDS REVISION

Scope signal: XL

Review boundary: MVP architectural constraints only. Alpha and Beta networking behavior was treated as compatibility context and was non-blocking unless it required an MVP runtime dependency.

Specialists: none — lean mode.

## Review — 2026-07-25 — Verdict: NEEDS REVISION

Scope signal: XL

Specialists: none — lean mode

Blocking items: 1 | Recommended: 0

Summary: Fresh lean re-review confirmed all prior findings were resolved. Cross-GDD consistency check found 1 BLOCKING issue: Ghost header size mismatch (MP said 64 bytes, GR says 80 bytes after review correction). The header size was corrected in MP to match GR.

Prior verdict resolved: Yes — all prior findings were resolved; this pass found a format-breaking size mismatch.

Blocking items: 1 | Recommended: 5
Prior verdict resolved: First review.

### Findings

| Finding | Severity | Resolution |
|---|---|---|
| Simulation Architecture and Ghost Recording were listed as Hard bidirectional network dependencies despite the MVP rule requiring offline single-player with no transport types or network runtime state | Blocking | Changed the links to Alpha/Beta deferred architecture constraints and stated explicitly that MVP has no Multiplayer runtime dependency. |
| The input packet was described as shared across all phases and included a Pit request bit after the MVP Pit action had been removed | Recommended | Marked the packet as a Beta candidate and reserved the bit for a future Beta design. |
| Future Alpha/Beta sections and acceptance criteria were not consistently phase-labeled | Recommended | Labeled packet, rollback, server, Ghost, lifecycle, prediction, upload, and disconnection content by phase. |
| Beta rollback text claimed cross-machine determinism without an approved canonical-state decision | Recommended | Replaced the guarantee with an explicitly unassigned future architecture decision. |
| Beta disconnection rules are internally inconsistent: a 10-tick rollback window cannot cover a 2-second disconnect, and AI takeover conflicts with reconnect backoff | Recommended | Preserved the provisional behavior as deferred and recorded the contradiction as an open Beta decision instead of redesigning Beta during the MVP review. |

### MVP Boundary Confirmed

- MVP is disconnected, offline single-player, and generates no Coherence network traffic.
- MVP gameplay systems do not import transport types or depend on network runtime state.
- Alpha CloudStorage and Beta real-time networking remain future-phase integrations.
- Global leaderboard, ranked cross-platform play, seasonal reset, and remote ghost discovery remain unassigned.

### Files Revised During This Lean Review

- `design/gdd/multiplayer-architecture.md`
- `design/gdd/systems-index.md`

## Review — 2026-07-25 — Verdict: APPROVED

Scope signal: XL (MVP scope: minimal — disconnected, offline only)

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review with exhaustive artifacts confirmed all prior findings were resolved. 8/8 sections present, 4/4 dependencies validated (all deferred), 13/13 cross-GDD consistency checks pass. Non-MVP constraint check passes — MVP is disconnected, offline single-player with no Coherence connection. Ghost header size corrected to 80 bytes. Known Beta issues (10-tick rollback window vs 2s disconnect, AI takeover vs reconnect backoff) are explicitly deferred as open Beta decisions.

Prior verdict resolved: Yes — the 2026-07-25 BLOCKING finding (Ghost header size mismatch) was corrected in this pass.

## Review — 2026-07-26 — Verdict: APPROVED

Scope signal: XL

Specialists: none — lean mode

Blocking items: 0 | Recommended: 0

Summary: Fresh lean re-review from zero confirmed Multiplayer Architecture remains a deferred Alpha/Beta boundary only. The document stays aligned with Simulation Architecture, Ghost Recording, HUD, and Settings, and no MVP runtime dependency was introduced.

Prior verdict resolved: Yes — the systems-index entry had been left pending despite the prior approved state.

## Review — 2026-07-25 — Verdict: NEEDS REVISION (corrected)

Scope signal: XL (MVP scope: minimal — disconnected, offline only)

Specialists: none — lean mode

Blocking items: 1 | Recommended: 0

Summary: Cross-GDD review flagged header pillar mismatch: header said "Implements Pillar: Speed You Can Feel" but Player Fantasy text describes Pillar 4 (Rivals Make the Grid Personal) and Pillar 2 (Every Short Race Matters). Corrected header to match.

Prior verdict resolved: Yes — all prior findings resolved; this pass found a pillar labeling error.

### Files Revised During This Review

- `design/gdd/multiplayer-architecture.md`
## Review — 2026-08-06 — Verdict: APPROVED (NEEDS REVISION → revised → approved)

Scope signal: XL

Specialists: network-programmer, game-designer, systems-designer, creative-director (full review)

Blocking items: 7 (all resolved) | Recommended: 0 (formula corrections, ghost-presentation contract, design-test measurability, and WebGL transport deep-dive deferred to later passes)

Summary: First full-mode review of the 2026-08-05 SDK-agnostic edit. The creative-director verdict was NEEDS REVISION: the SDK-agnostic edit was half-applied — the intro declared "SDK-agnostic" while integration sections still named Coherence as the integration shape. The MVP boundary is intact; the blockers affected the GDD's readiness as input for ADR-0016. All 7 blockers resolved and verified: (1) completed the SDK-agnostic edit (MVP table now "no network SDK linked"; CoherenceInputSimulation<TState> replaced by a network simulation driver interface contract); (2) added SDK Selection Criteria (7 dimensions) for ADR-0016; (3) refreshed stale header; (4) synced systems-index Coherence drift; (5) synced game-concept, ghost-recording, settings (zero Coherence in commitment contexts — reference-SDK mentions remain only in labeled examples); (6) consolidated the disconnect model into jitter (10-tick rollback, no AI takeover) vs disconnection (RECONNECTING + backoff, AI after ~10s/5 retries) and corrected AC-DC1; (7) fixed section numbering.

Prior verdict resolved: Yes — the 2026-07-26 APPROVED did not cover the 2026-08-05 SDK-agnostic edit; this review covered it and re-approved.

### Blockers → Fixes

| # | Blocker | Fix |
|---|---|---|
| 1 | SDK-agnostic edit incomplete (MVP "SDK present", CoherenceInputSimulation named) | No network SDK linked in MVP; network simulation driver interface contract |
| 2 | No SDK selection criteria declared | Added SDK Selection Criteria (7 dimensions) for ADR-0016 |
| 3 | Stale header (Approved / 2026-07-26) | Status + Last Updated refreshed |
| 4 | systems-index Coherence drift (lines 18, 110) | Synced to SDK-agnostic |
| 5 | Coherence in downstream GDDs (game-concept, ghost-recording, settings) | Synced to SDK-agnostic |
| 6 | Disconnect contradictions (AC-DC1 2s vs 10-tick window; 3 AI thresholds) | Jitter vs disconnection model; AC-DC1 corrected; duplicate edge case removed |
| 7 | Section numbering skipped 8 → 10 | Renumbered 9 (Network Degradation), 10 (Data Flow) |
