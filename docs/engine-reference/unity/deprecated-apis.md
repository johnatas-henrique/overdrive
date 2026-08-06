# Unity 6.3 LTS — API Migration Guide

**Editor version:** 6000.3.19f1
**Last verified:** 2026-07-19

This is a project-specific lookup. It distinguishes APIs that are actually obsolete in the installed editor from patterns that are merely not the project standard.

## Obsolete APIs Confirmed in the Installed Editor

| Obsolete API | Replacement | Notes |
|--------------|-------------|-------|
| `Rigidbody.velocity` | `Rigidbody.linearVelocity` | Property rename in Unity 6000.3 |
| `Rigidbody.drag` | `Rigidbody.linearDamping` | Property rename in Unity 6000.3 |
| `Rigidbody.angularDrag` | `Rigidbody.angularDamping` | Property rename in Unity 6000.3 |
| `Screen.SetResolution(int, int, FullScreenMode, int preferredRefreshRate)` | `Screen.SetResolution(int, int, FullScreenMode, RefreshRate)` | Integer-refresh overloads obsolete in Unity 6000.3 — migrate before next Unity bump |
| `AudioClip.Create(...)` `_3D` overloads | `AudioSource.spatialBlend` | `_3D` overloads obsolete in Unity 6000.3 — official guidance: use the spatialBlend property; migrate before next Unity bump |
| `OffMeshLink` | `Unity.AI.Navigation.NavMeshLink` | Obsolete in Unity 6000.3 — migrate before next Unity bump; navigation.md already points to NavMeshLink |

## Preferred Project Patterns — Not Deprecations

| Existing API or pattern | Project preference | Reason |
|-------------------------|--------------------|--------|
| `Input.*` APIs | Input System actions and controls | Rebinding and device-aware control schemes |
| `Physics.RaycastAll()` | Non-allocating queries in hot paths | Avoid per-query array allocations |
| `Resources.Load()` | Use Addressables 3.1.0 for approved asynchronous content loading | Addressables is installed; do not migrate indiscriminately |
| UGUI `Text` | TextMeshPro for new text | Text quality and established tooling |
| `ParticleSystem` | Keep for conventional effects; assess VFX Graph only if needed | VFX Graph is not installed |
| Legacy `Animation` component | Animator for new gameplay animation | Animator is the project standard |
| `Rigidbody.AddForce(mode: ForceMode.Acceleration/Impulse)` | `ForceMode.Force` or raw acceleration values | Mass-scaling trap (memory #1737): Acceleration/Impulse multiply by `Rigidbody.mass` again; observed 28 m/s² × 505 kg = 14,140 m/s² |
| `FixedUpdate()` for simulation logic | Manual accumulator in `Update()` per ADR-0001 | `Physics.simulationMode = SimulationMode.Script`; fixed-step simulation runs inside the accumulator |
| `Time.fixedDeltaTime` as simulation tick constant | `FIXED_DT` constant (1/60) owned by the simulation | `Time.fixedDeltaTime` is a global whose value can be changed externally; the simulation tick must be a named constant |
| `Screen.SetResolution` simple overload | Project-policy decision at startup; resolution management through the display path | The simple overload is not obsolete — this is project policy, not API deprecation |

## Package Boundaries

Do not use `Unity.Entities`, `Unity.Netcode`, or VFX Graph APIs. Their packages are not installed in this project.

## Web

Use WebGL2 as the web baseline. WebGPU is experimental and is not a replacement target for this project.

## Examples

```csharp
// Preferred input pattern for this project.
using UnityEngine.InputSystem;

if (Keyboard.current.spaceKey.wasPressedThisFrame)
{
    Jump();
}
```

```csharp
// Actual Unity 6000.3 property migration.
Rigidbody rigidbody = GetComponent<Rigidbody>();
rigidbody.linearVelocity = new Vector3(0f, 10f, 0f);
```

## Sources

- https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody.html
- https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU.html
- https://docs.unity3d.com/Packages/com.unity.inputsystem@1.19/manual/index.html
