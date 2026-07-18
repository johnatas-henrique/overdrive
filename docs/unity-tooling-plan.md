# Unity Tooling Study Plan

**Status:** Proposed. Nothing in this plan is installed or approved for implementation yet.

## Purpose

This document is a reviewable learning plan for adopting Unity/C# development tooling.
It maps familiar JavaScript/TypeScript workflow needs to the Unity, C#, Git, and CI
tools that serve the same responsibilities.

The project will review each decision before installation. Tooling must support the
game without hiding how Unity's compilation, testing, build, and versioning workflows work.

## Current Project Facts

| Area | Current state |
|---|---|
| Unity version | 6000.3.19f1 |
| Primary language | C# |
| Unity Test Framework | Installed as `com.unity.test-framework` 1.6.0 |
| Git execution environment | WSL currently performs repository commands |
| Unity Editor environment | Windows |
| CI platform | GitHub Actions workflows already exist |
| WSL .NET SDK | 10.0.302 installed locally at `~/.dotnet` |
| Conventional Commit policy | Cocogitto 7.0.0 installed locally with a `commit-msg` hook |

## Proposed Tool Map

| Need | JavaScript/TypeScript reference | Proposed Unity/C# or Git tooling | Status |
|---|---|---|---|
| Unit and integration tests | Vitest | Unity Test Framework with NUnit | Already available; test assemblies not configured |
| Runtime integration tests | Vitest integration tests | Unity PlayMode tests | Not configured |
| Coverage | Vitest coverage | Unity Code Coverage package | Evaluate before installation |
| C# formatting | Biome formatter | CSharpier as a local .NET tool | Installed: 1.3.0; no C# game files exist yet |
| C# static analysis | Biome linter | Roslyn Analyzers plus `.editorconfig` | `.editorconfig` baseline created; analyzer rule set not selected |
| Commit-message hook | Husky | Cocogitto built-in hook installer | Installed: `commit-msg` only |
| Staged-file validation | lint-staged | Husky.Net, Lefthook, or a Git script | Deferred; no tool selected |
| Conventional Commit validation | commitlint | Cocogitto `cog verify` | Installed locally; `commit-msg` hook active |
| Semantic version, changelog, tags | release-please | Cocogitto `cog bump --auto` | Evaluate before installation |
| Unity tests in CI | Vitest CI | GameCI Unity Test Runner | Evaluate before installation |
| Release build | release-please publish step | GameCI build workflow triggered by a Git tag | Evaluate before installation |

## Installation Boundaries

| Tooling area | Installation location | Why |
|---|---|---|
| Unity Test Framework | Unity Package Manager | Unity owns package resolution and compilation integration |
| Unity Code Coverage | Unity Package Manager | It is a Unity package and updates the package manifest/lockfile |
| Test assembly definitions | Unity Editor | Unity must import and validate the `.asmdef` test assemblies |
| Roslyn analyzer DLLs | Unity Asset Pipeline under `Assets/` | Unity imports analyzer binaries and scopes them to assemblies |
| CSharpier | WSL terminal as a local .NET tool | The formatter runs where Git hooks execute and its version is committed |
| Staged-file validator (undecided) | WSL terminal | Must run in the process environment that executes `git commit` |
| Cocogitto | WSL terminal and GitHub Actions | Commit validation and release versioning operate on Git history |
| GameCI | GitHub Actions | CI executes Unity tests and builds independently from a developer machine |

## Intended Validation Flow

```text
edit C# code
  -> format changed C# files
  -> run EditMode tests locally
  -> run PlayMode tests when Unity behaviour changes
  -> pre-commit validates staged C# formatting
  -> commit-msg validates Conventional Commit syntax
  -> CI reruns Unity tests on the repository state
  -> release workflow calculates SemVer, creates changelog/tag, then builds Unity
```

Passing tests establish that specified behaviour was exercised; they do not prove
visual composition, game feel, or scene usability. Those remain separate Coplay
screenshot and play-validation concerns.

## Proposed Repository Artifacts

| Artifact | Responsibility |
|---|---|
| `Assets/Tests/EditMode/` | Fast tests for deterministic C# logic |
| `Assets/Tests/PlayMode/` | Tests requiring Unity runtime, scenes, frames, or physics |
| `.editorconfig` | Shared C# style baseline and future analyzer severity policy |
| `dotnet-tools.json` | Pinned CSharpier version |
| `cog.toml` | Active Conventional Commit policy; no release configuration yet |
| `.github/workflows/unity-tests.yml` | CI test execution |
| `.github/workflows/release.yml` | SemVer release, tag, changelog, and build orchestration |
| `Assets/Editor/` build-version script | Applies the release tag to `PlayerSettings.bundleVersion` during a build |

## Decisions Still Required

1. **Analyzer policy:** choose a minimal Roslyn analyzer set and rule severity.
2. **Formatter policy:** decide whether pre-commit only checks formatting or also rewrites staged files.
3. **Coverage policy:** decide whether coverage is a release gate or report-only metric.
4. **CI strategy:** select GameCI or Unity Build Automation for test/build execution.
5. **Release authority:** decide whether releases run manually from a reviewed workflow or automatically after merge to `main`.
6. **Version source:** use Git tags as the source of truth; the Unity build script must set `PlayerSettings.bundleVersion`, not `ProjectVersion.txt`.
7. **WSL/Windows workflow:** decide whether commits may run from both environments. If yes, hooks and their binaries must be available in both.

## Official Documentation

- Unity Test Framework: https://docs.unity3d.com/kr/6000.0/Manual/com.unity.test-framework.html
- Unity Code Coverage: https://docs.unity3d.com/kr/6000.0/Manual/com.unity.testtools.codecoverage.html
- Unity Roslyn Analyzers: https://docs.unity3d.com/kr/6000.0/Manual/roslyn-analyzers.html
- CSharpier: https://csharpier.com/docs/Installation
- Lefthook: https://lefthook.dev/
- Cocogitto: https://docs.cocogitto.io/
- GameCI Unity Test Runner: https://game.ci/docs/github/test-runner/
- Unity `PlayerSettings.bundleVersion`: https://docs.unity3d.com/ScriptReference/PlayerSettings-bundleVersion.html
