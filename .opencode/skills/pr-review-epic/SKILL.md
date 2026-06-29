---
name: pr-review-epic
description: "Reviews AI reviewer comments on a PR, creates per-epic review documents, and coordinates fixes. Run after PR is opened and AI reviewers have commented."
argument-hint: "[pr-number] [epic-name]"
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash, Task, aft_search, aft_outline
---

## Phase 1: Read All PR Comments

Read ALL comments from the PR using `gh api`. Do not skip any findings.

**Fetch both review comments AND conversation comments:**

```bash
# Review comments (on code)
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --paginate > /tmp/pr-comments.json

# Conversation comments (on PR description)
gh api repos/{owner}/{repo}/issues/{pr_number}/comments --paginate > /tmp/pr-conversation.json
```

Count total comments (review + conversation) and unique file:line locations. Report both numbers.

---

## Phase 2: Create Per-Epic Review Documents

For each epic in the PR, create `production/epics/{epic-name}/PR-{pr_number}-REVIEW.md`.

**Epic assignment rules:**
- Source files under `src/{epic-name}/` → that epic
- Test files under `tests/` → the epic of the source file they test
- Cross-cutting files (app.ts, playground, config, CI, docs) that don't belong to any epic → **Tech Debt epic**
- All findings must be in exactly one epic document

**ALL findings must be included.** Do NOT deduplicate by removing entries. If finding #50 is the same issue as #14:
- Include BOTH #14 and #50 as separate findings
- In #50's description, add: `**Duplicate of**: #14 — same issue reported by {reviewer}`
- Both get their own decision row in the Decision Table

**Structure:**
```markdown
# PR #{pr_number} Review — {Epic Name}

**PR**: [#{pr_number} {title}]({url})
**Review Date**: {date}
**Reviewers**: {list of reviewers}
**Total Comments in PR**: {total}
**Comments in this Epic**: {n}

---

## Findings

### {ID}: {Title}

| Field | Value |
|-------|-------|
| **File** | `{path}:{line}` |
| **Severity** | {emoji} {level} |
| **Reviewer** | {reviewer} |
| **Category** | {Code|Test|Documentation|Config} |
| **Duplicate of** | {ID or empty} |

**Finding**: {description}

**Recommendation**: {what to do}

**Status**: PENDING REVIEW

---

## Decision Table

| ID | File | Decision | Rationale |
|----|------|----------|-----------|
| {ID} | {path} | {FIX|SKIP|DISCUSS} | {rationale} |
```

**Rules:**
- ALL findings must have a decision (FIX/SKIP/DISCUSS)
- Duplicate findings are NOT consolidated — each stays as a separate entry with a cross-reference
- Each finding has 3 opinions: Engineer, QA, Orchestrator
- The "Comments in this Epic" count = number of original PR comments whose files fall within this epic's scope

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

**Ordering**: Findings MUST be in sequential order by ID (DT-001, DT-002, DT-003, ...). Do NOT sort by severity within the document.

**Duplicates**: If finding DT-012 is a duplicate of DT-007, do NOT create a separate entry for DT-012. Instead, note it in DT-007's title:
```markdown
### DT-007: Concurrent init serialization (duplicates: DT-012, DT-015, DT-037)
```
This keeps the document scannable — one entry per unique issue.

**Pre-fill decisions**: When 2 out of 3 opinions (Engineer, QA, Orchestrator) agree, pre-fill the decision checkbox with `[X]`. The user changes only the disagreements. Example:
- Engineer: FIX, QA: FIX, Orchestrator: FIX → `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS
- Engineer: SKIP, QA: FIX, Orchestrator: SKIP → `[ ]` FIX `[X]` SKIP `[ ]` DISCUSS
- Engineer: FIX, QA: SKIP, Orchestrator: DISCUSS → `[ ]` FIX `[ ]` SKIP `[X]` DISCUSS

**Structure per finding:**
```markdown
### {ID}: {Title} (duplicates: {IDs or empty})

| Field | Value |
|-------|-------|
| **File** | `{path}` |
| **Severity** | {level} |
| **Engineer** | {analysis} |
| **QA** | {analysis} |
| **Orchestrator** | {synthesis} |

**Decision**: `[X]` FIX `[ ]` SKIP `[ ]` DISCUSS
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

Respond to comments that have NOT been responded to yet. Skip comments that already have replies.

**Steps:**
1. Fetch all PR comments: `gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --paginate`
2. For each comment, check if it already has replies ( replies exist if `in_reply_to_id` matches another comment ID)
3. Only respond to comments with NO existing replies
4. Post reply using `gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/replies -f body="..."`

**Response format:**

**FIX:**
```
✅ FIX — {brief explanation}
{commit hash} resolves this.
```

**SKIP:**
```
⏭️ SKIP — {rationale}
```

**Rate limiting:** If you get 422 errors, stop and report progress. Do not retry automatically.

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
- [ ] All PR comments responded to (count from Phase 1)
- [ ] All DISCUSS items resolved
- [ ] All FIX items implemented
- [ ] Tests pass
- [ ] Lint clean
- [ ] Typecheck clean
- [ ] User validates before push
