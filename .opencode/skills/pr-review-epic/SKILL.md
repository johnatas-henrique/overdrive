---
name: pr-review-epic
description: "Reviews AI reviewer comments on a PR, creates per-epic review documents, and coordinates fixes. Run after PR is opened and AI reviewers have commented."
argument-hint: "[pr-number] [epic-name]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash, Task, aft_search, aft_outline
---

## Phase 1: Read All PR Comments

Read ALL comments from the PR using `gh api`. Do not skip any findings.

```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --paginate | jq -r '.[] | "\(.user.login) | \(.path):\(.line // .start_line) | \(.body[0:300])"'
```

Count total comments and unique file:line locations. Report both numbers.

---

## Phase 2: Create Per-Epic Review Documents

For each epic in the PR, create `production/epics/{epic-name}/PR-{pr_number}-REVIEW.md`.

**Structure:**
```markdown
# PR #{pr_number} Review — {Epic Name}

**PR**: [#{pr_number} {title}]({url})
**Review Date**: {date}
**Reviewers**: {list of reviewers}
**Total Comments**: {total} ({n} in this epic scope)

---

## Findings

### {ID}: {Title}

| Field | Value |
|-------|-------|
| **File** | `{path}:{line}` |
| **Severity** | {emoji} {level} |
| **Reviewer** | {reviewer} |
| **Category** | {Code|Test|Documentation|Config} |

**Finding**: {description}

**Recommendation**: {what to do}

**Status**: PENDING REVIEW

---

## Decision Table

| ID | Decision | Rationale |
|----|----------|-----------|
| {ID} | {FIX|SKIP|DISCUSS} | {rationale} |
```

**Rules:**
- ALL findings must have a decision (FIX/SKIP/DISCUSS)
- Duplicate findings are consolidated but kept in the list
- Each finding has 3 opinions: Engineer, QA, Orchestrator

---

## Phase 3: Spawn Analysis Agents

Spawn TWO agents in parallel (NEW sessions, not main agent):

1. **Programmer agent** — Analyzes code findings (FIX/SKIP/DISCUSS with rationale)
2. **QA agent** — Analyzes test findings + finds gaps reviewers missed

Each agent writes their analysis into the PR-REVIEW.md document.

**Programmer agent prompt:**
```
Read {epic}/PR-{pr_number}-REVIEW.md
For each finding:
1. Read the actual source file
2. Verify the issue exists
3. Assign: FIX (real bug), SKIP (not worth it), DISCUSS (needs decision)
4. Write rationale
Update Decision Table and Programmer Analysis Summary.
```

**QA agent prompt:**
```
Read {epic}/PR-{pr_number}-REVIEW.md
For each test finding:
1. Read the actual test file
2. Verify the issue exists
3. Confirm or challenge existing decision
4. Find NEW gaps reviewers missed
Update QA Analysis Summary.
```

---

## Phase 4: Generate Decision Markdown

Create `production/qa/PR-{pr_number}-REVIEW-DECISIONS.md` with ALL findings from ALL epics.

**Structure per finding:**
```markdown
### {ID}: {Title}

| Field | Value |
|-------|-------|
| **File** | `{path}` |
| **Severity** | {level} |
| **Engineer** | {analysis} |
| **QA** | {analysis} |
| **Orchestrator** | {synthesis} |

**Decision**: `[ ]` FIX `[ ]` SKIP `[ ]` DISCUSS
```

**Summary table at top:**
```markdown
| Category | FIX | SKIP | DISCUSS | Total |
|----------|-----|------|---------|-------|
| {epic}   |     |      |         |       |
```

---

## Phase 5: User Decisions

User marks each finding with `[X]` for their decision.

**Resolve all DISCUSS items before proceeding.**

For each DISCUSS:
1. Present analysis with options
2. Wait for user decision
3. Document decision

---

## Phase 6: Respond to PR Comments

Respond to EACH comment individually on GitHub. Format varies by decision:

**FIX:**
```
✅ FIX — {brief explanation}
{commit hash} resolves this.
```

**SKIP:**
```
⏭️ SKIP — {rationale}
```

**DISCUSS:**
```
💬 DISCUSS — {question for reviewer}
```

Use `gh api` to post replies:
```bash
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments/{comment_id}/replies -f body="..."
```

---

## Phase 7: Implement FIX Items

Spawn agents in NEW sessions to implement fixes:

1. **Programmer agent** — Code fixes
2. **QA agent** — Test fixes

Each agent receives:
- List of FIX items with file paths and descriptions
- Instruction to implement and verify tests pass

---

## Phase 8: Verification

After agents complete:
1. Run tests: `npm test`
2. Run lint: `npx biome check .`
3. Run typecheck: `npx tsc --noEmit`
4. Verify coverage: `npx vitest run --coverage`

Report results to user.

---

## Phase 9: PR Update

Update PR title and description to reflect ALL epics.

**Title format:** `{type}({scope}): {epic1} + {epic2} + ...`

**Description must include:**
- All epics covered
- Summary of changes per epic
- Links to per-epic review documents

**DO NOT PUSH** — wait for user validation.

---

## Phase 10: Tech Debt

For deferred findings, add to `docs/tech-debt-register.md`:
```
| {ID} | {description} | {file} | {reason for deferral} | {date} |
```

---

## Quality Gates

Before completing:
- [ ] All 79+ comments responded to
- [ ] All DISCUSS items resolved
- [ ] All FIX items implemented
- [ ] Tests pass
- [ ] Lint clean
- [ ] Typecheck clean
- [ ] User validates before push
