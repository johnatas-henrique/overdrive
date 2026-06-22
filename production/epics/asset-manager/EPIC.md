# Epic: Asset Manager

> **Layer**: Core (slot #3 — loads track/car assets for Physics to simulate)
> **GDD**: design/gdd/asset-manager.md
> **Architecture Module**: Core — Asset Management
> **Status**: Ready
> **Stories**: Not yet created — run `/create-stories asset-manager`

## Overview

AssetContainers cache (`Map<string, AssetContainer>`) — load once via `SceneLoader.LoadAssetContainerAsync`, instantiate per scene, zero I/O on cache hit. Two persistent scenes (`menuScene` + `raceScene`) coexisting in `engine.scenes[]`; `setActiveScene()` controls rendering per frame. Asset container loaded against target scene, `removeAllFromScene()` after load for caching. Error events via Event Bus with fallback material. Progress events for loading screen.

## Governing ADRs

| ADR                              | Decision Summary                                                             | Engine Risk |
| -------------------------------- | ---------------------------------------------------------------------------- | ----------- |
| ADR-0003: Two-Scene Architecture | AssetContainers cache, LoadAssetContainerAsync, two scenes, setActiveScene() | MEDIUM      |

## GDD Requirements

| TR-ID     | Requirement                                                                   | ADR Coverage |
| --------- | ----------------------------------------------------------------------------- | ------------ |
| TR-AM-001 | AssetContainers cache — load once, instantiate per scene, zero I/O on hit     | ADR-0003 ✅  |
| TR-AM-002 | Two-scene references via LoadAssetContainerAsync(url, null, null, scene)      | ADR-0003 ✅  |
| TR-AM-003 | setActiveScene() controls rendering, runs after pipeline each frame           | ADR-0003 ✅  |
| TR-AM-004 | Both scenes coexist in engine.scenes[]; only one renders per frame            | ADR-0003 ✅  |
| TR-AM-005 | Load error via Event Bus ('asset.error') with fallback material               | ADR-0003 ✅  |
| TR-AM-006 | Emit 'asset.load.progress' and 'asset.load.complete' events                   | ADR-0003 ✅  |
| TR-AM-007 | disposeContainer(id) removes cache entry, disposes mesh tree                  | ADR-0003 ✅  |
| TR-AM-008 | Subscribe to gsm.state.entered for preloading during state transitions        | ADR-0003 ✅  |
| TR-AM-009 | preload(ids: string[]) handles concurrency — multiple simultaneous loads      | ADR-0003 ✅  |
| TR-AM-010 | On disposeAll(), clear entire cache; re-clone from cached container each race | ADR-0003 ✅  |

## Definition of Done

This epic is complete when:

- All stories are implemented, reviewed, and closed via `/story-done`
- All acceptance criteria from `design/gdd/asset-manager.md` are verified
- All Logic and Integration stories have passing test files in `tests/`
- All Visual/Feel and UI stories have evidence docs with sign-off in `production/qa/evidence/`

## Next Step

Run `/create-stories asset-manager` to break this epic into implementable stories.
