---
name: pr-review-decisions
description: "Deduplicates AI reviewer findings, spawns programmer+QA analysis, generates review decisions document, and coordinates implementation. Run after AI reviewers have commented on a PR."
argument-hint: "[pr-number]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Write, Edit, Bash, Task, question, TodoWrite, aft_search, aft_outline
---

## Phase 1: Load Review Comments

The user provides AI reviewer comments (pasted into the conversation or from a file). Read all comments from the user's message.

Identify which reviewers commented (e.g. CodeRabbit, Greptile, opencode-bot) and count total comments and unique file:line locations.

---

## Phase 2: Deduplicate Findings

Read all comments. Consolidate findings that describe the same issue (reported by different reviewers) into single entries.

**Deduplication rules:**
1. Same file + same line + same issue → merge into one entry
2. Keep all reviewer names in the merged entry
3. Assign a sequential FR-{NNN} ID
4. Classify severity: 🔴 CRITICAL / 🟡 WARNING / 🟢 MINOR
5. Classify category: Code / Test / Documentation

---

## Phase 3: Create Review Decisions Document

Create `production/qa/PR-{pr_number}-REVIEW-DECISIONS.md`.

**Structure per finding:**

```markdown
### FR-001: {Title}

| Field | Value |
|-------|-------|
| **File** | `{path}:{line}` |
| **Severity** | {emoji} {level} |
| **Reviewers** | {names} ({count} reviews) |
| **Category** | {Code|Test|Documentation} |

**Finding**: {description}

**Recommendation**: {what to do}

**Programmer Analysis**: _pending_
**QA Analysis**: _pending_
**Orchestrator Analysis**: _pending_
**User Decision**: [ ] FIX [ ] SKIP [ ] DISCUSS
```

**Summary table at the end:**

```markdown
## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| 🔴 CRITICAL | N | FR-NNN |
| 🟡 WARNING | N | FR-NNN |
| 🟢 MINOR | N | FR-NNN |
| **Total** | **N** | |
```

---

## Phase 4: Spawn Analysis Agents

Spawn TWO agents in parallel via `Task` tool:

### Programmer Agent

**Subagent type:** `gameplay-programmer`

**Prompt:**
```
Read production/qa/PR-{pr_number}-REVIEW-DECISIONS.md.

For EACH finding:
1. Read the actual source file referenced in the finding
2. Verify the issue exists in the current code
3. Decide: FIX (real bug/gap), SKIP (not worth it now), DISCUSS (needs design decision)
4. Write your analysis with rationale

Update the document: fill in "**Programmer Analysis**: **Decision: {FIX|SKIP|DISCUSS}** — **Rationale**: {explanation}" for each finding.
```

### QA Agent

**Subagent type:** `qa-tester`

**Prompt:**
```
Read production/qa/PR-{pr_number}-REVIEW-DECISIONS.md.

For EACH finding:
1. Read the actual test file referenced (if test-related)
2. Verify the issue exists
3. Confirm or challenge the programmer's decision
4. Find NEW gaps reviewers missed (untested edge cases, missing coverage)

Update the document: fill in "**QA Analysis**: **Decision: {FIX|SKIP|DISCUSS}** — **Rationale**: {explanation}" for each finding.

Add any new findings as FR-{NNN} entries following the same format.
```

Wait for BOTH agents to complete before proceeding.

---

## Phase 5: Write Orchestrator Opinions

After both agents return, for each finding:

1. Read Programmer and QA analyses
2. Synthesize: agree with majority, flag disagreements
3. Write "**Orchestrator Analysis**: **Decision: {FIX|SKIP|DISCUSS}** — {synthesis}"

**Pre-fill user decisions** when 2 out of 3 opinions agree:
- All agree FIX → `[X] FIX [ ] SKIP [ ] DISCUSS`
- 2 agree SKIP → `[ ] FIX [X] SKIP [ ] DISCUSS`
- Split → `[ ] FIX [ ] SKIP [X] DISCUSS` (leave for user)

---

## Phase 6: Present to User

Show the summary and resolve DISCUSS items one by one.

**Format:**
```
## Resumo das Decisões

| Decisão | Qtd | IDs |
| ------- | --- | --- |
| FIX | N | FR-NNN |
| SKIP | N | FR-NNN |
| DISCUSS | N | FR-NNN |

### Itens para DISCUSS

**FR-NNN**: {Title}
- Programmer: {decision} | QA: {decision} | Orchestrator: {decision}
- {key argument for each side}
- Minha posição: {recommendation}
```

For each DISCUSS item:
1. Present analysis with concrete options
2. Wait for user decision via `question` tool
3. Update document with user's decision

**Do NOT proceed until ALL findings have a final decision.**

---

## Phase 7: Implement FIX Items

Spawn a programmer subagent to implement all FIX items.

**Subagent type:** `gameplay-programmer`

**Prompt:**
```
Read production/qa/PR-{pr_number}-REVIEW-DECISIONS.md.

Implement ALL findings marked as FIX. Work file-by-file.

For each finding:
1. Read the source file
2. Apply the recommended fix
3. Update any affected tests

After all changes:
1. Run: npx vitest run
2. Run: npx tsc --noEmit
3. Run: npx biome check src/ tests/

Report: which findings implemented, test results, any issues.
```

---

## Phase 8: Verification

After implementation completes, verify independently:

1. `npx vitest run` — all tests pass
2. `npx tsc --noEmit` — TypeScript clean
3. `npx biome check src/ tests/` — lint clean
4. `npx vitest run --coverage` — check for uncovered branches
5. If defensive branches exist without tests: write the test (per project rule)

Report all results to user.

---

## Phase 9: Atomic Commits

Run the `atomic-committer` skill to commit all changes.

---

## Phase 10: Update Regression Suite

Run `/regression-suite update` to sync assertion counts.

---

## Quality Gates

Before completing:
- [ ] All findings have a final decision
- [ ] All FIX items implemented
- [ ] Tests pass
- [ ] Lint clean
- [ ] Typecheck clean
- [ ] Coverage verified (no defensive branches without tests)
- [ ] Atomic commits landed
- [ ] Regression suite updated
