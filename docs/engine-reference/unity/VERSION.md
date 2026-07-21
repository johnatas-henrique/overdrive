# Unity Engine — Version Reference

| Field | Value |
|-------|-------|
| **Engine Version** | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| **Release Date** | July 1, 2026 |
| **Project Pinned** | July 19, 2026 |
| **Last Docs Verified** | July 19, 2026 |
| **LLM Knowledge Cutoff** | May 2025 |

## Knowledge Gap Warning

The LLM's training data likely covers Unity up to ~2022 LTS (2022.3). The entire
Unity 6 release series (formerly Unity 2023 Tech Stream) introduced significant
changes that the model does NOT know about. Always cross-reference this directory
before suggesting Unity API calls.

## Project Package State

| System | Project State |
|--------|---------------|
| Universal Render Pipeline | Installed: 17.3.0 |
| Input System | Installed: 1.19.0 |
| AI Navigation | Installed: 2.0.14 |
| Addressables | Installed: 3.1.0 |
| Unity Test Framework | Installed: 1.6.0 |
| UGUI | Installed: 2.0.0 |
| Entities/DOTS, Netcode, Cinemachine, VFX Graph | Not installed |

## Verified Compatibility Notes

- **Input**: The project standard is the Input System. The legacy Input Manager remains functional and is not an obsolete API.
- **Physics**: `Rigidbody.velocity`, `Rigidbody.drag`, and `Rigidbody.angularDrag` are obsolete in this editor; use `linearVelocity`, `linearDamping`, and `angularDamping`.
- **UI**: Unity 6000.3 recommends uGUI for runtime UI. UI Toolkit is the alternative for runtime UI and the recommended system for editor tooling.
- **Web**: WebGL2 is the default web graphics API. WebGPU is experimental and must not be a project dependency.
- **Addressables**: Version 3.1.0 is installed. Start with local groups for the MVP; remote delivery remains a later content-distribution decision.
- **Optional packages**: Documentation for uninstalled packages is reference-only. Do not use their APIs until the corresponding package is approved and installed.

## Verified Sources

- Unity 6000.3.19f1 release notes: https://unity.com/releases/editor/whats-new/6000.3.19f1
- Official docs: https://docs.unity3d.com/6000.3/Documentation/Manual/index.html
- Upgrade guides: https://docs.unity3d.com/6000.3/Documentation/Manual/upgrade-guides.html
- C# API reference: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/index.html
- UI system comparison: https://docs.unity3d.com/6000.3/Documentation/Manual/UI-system-compare.html
- WebGPU status: https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU.html
