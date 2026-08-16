# Unity 6.3 LTS — Current Best Practices

**Editor version:** 6000.3.22f1
**Last verified:** 2026-08-13

These practices apply to packages that are installed in this project.

---

## Active Project Stack

- **Rendering:** URP 17.3.0.
- **Input:** Input System 1.20.0 with keyboard/mouse and gamepad parity.
- **Physics:** Unity Physics 3D. The vehicle model remains a prototype decision.
- **Asset management:** Addressables 3.1.0, initially for local content groups.
- **Testing:** Unity Test Framework 1.6.0 with NUnit.
- **Not installed:** Entities/DOTS, Netcode for GameObjects, Cinemachine, and VFX Graph.

---

## Scripting

### Use C# 9+ Features (Unity 6 Supports C# 9)

```csharp
// ✅ Record types for data
public record PlayerData(string Name, int Level, float Health);

// Use a conventional setter unless the project deliberately adds IsExternalInit.
public class Config {
    public string GameMode { get; set; }
}

// ✅ Pattern matching
var result = enemy switch {
    Boss boss => boss.Enrage(),
    Minion minion => minion.Flee(),
    _ => null
};
```

### Package Boundaries

Addressables 3.1.0 is installed. Use it for approved asynchronous asset-loading and content-group decisions. Entities/DOTS is not installed; do not use `IComponentData`, `ISystem`, or `IJobEntity` until that package is approved and added.

---

## Input

### Use Input System Package (Not Legacy Input)

```csharp
// ✅ Input Actions (rebindable, cross-platform)
using UnityEngine.InputSystem;

public class PlayerInput : MonoBehaviour {
    private PlayerControls controls;

    void Awake() {
        controls = new PlayerControls();
        controls.Gameplay.Jump.performed += ctx => Jump();
    }

    void OnEnable() => controls.Enable();
    void OnDisable() => controls.Disable();
}
```

Create Input Actions asset in editor, generate C# class via inspector.

---

## UI

### Runtime UI Selection

Use uGUI by default for runtime UI. Use UI Toolkit when its UXML/USS workflow is a better fit for a specific screen.

### UI Toolkit Runtime Alternative

```csharp
// UI Toolkit is a valid runtime alternative, not a replacement for uGUI.
using UnityEngine.UIElements;

public class MainMenu : MonoBehaviour {
    void OnEnable() {
        var root = GetComponent<UIDocument>().rootVisualElement;

        var playButton = root.Q<Button>("play-button");
        playButton.clicked += StartGame;

        var scoreLabel = root.Q<Label>("score");
        scoreLabel.text = $"High Score: {PlayerPrefs.GetInt("HighScore")}";
    }
}
```

**UXML** (UI structure) + **USS** (styling) = HTML/CSS-like workflow.

---

## Asset Management

Addressables 3.1.0 is installed. Begin with local groups for the MVP; do not configure remote catalogs or content delivery until a production requirement justifies them.

---

## Rendering

### Use RenderGraph API for Custom Passes (URP/HDRP)

```csharp
// ✅ RenderGraph API (Unity 6+)
public override void RecordRenderGraph(RenderGraph renderGraph, ContextContainer frameData) {
    using (var builder = renderGraph.AddRasterRenderPass<PassData>("My Pass", out var passData)) {
        // Setup pass
        builder.SetRenderFunc((PassData data, RasterGraphContext context) => {
            // Execute commands
        });
    }
}
```

**Replaces:** Old `CommandBuffer.Execute()` pattern.

---

## Performance

### Use Burst Compiler + Jobs System

```csharp
// ✅ Burst-compiled job (massive performance gain)
[BurstCompile]
struct ParticleUpdateJob : IJobParallelFor {
    public NativeArray<float3> Positions;
    public NativeArray<float3> Velocities;
    public float DeltaTime;

    public void Execute(int index) {
        Positions[index] += Velocities[index] * DeltaTime;
    }
}

// Schedule
var job = new ParticleUpdateJob {
    Positions = positions,
    Velocities = velocities,
    DeltaTime = Time.deltaTime
};
job.Schedule(positions.Length, 64).Complete();
```

Measure the benefit in a representative prototype before adding jobs or changing an architecture around them.

---

### Use GPU Instancing for Repeated Objects

```csharp
// ✅ GPU Instancing (thousands of objects, minimal draw calls)
Graphics.RenderMeshInstanced(
    new RenderParams(material),
    mesh,
    0,
    matrices // NativeArray<Matrix4x4>
);
```

---

## Memory Management

### Use NativeContainers (Not Managed Arrays in Jobs)

```csharp
// ✅ NativeArray (no GC, Burst-compatible)
NativeArray<int> data = new NativeArray<int>(1000, Allocator.TempJob);
// ... use in job
data.Dispose(); // Manual cleanup required

// ✅ Or use using statement
using var data = new NativeArray<int>(1000, Allocator.TempJob);
// Auto-disposed
```

---

## Multiplayer

Netcode for GameObjects is not installed. Do not use `Unity.Netcode` APIs until multiplayer is designed, approved, and its package is added.

---

## Testing

### Use Unity Test Framework (NUnit-based)

```csharp
// ✅ Play Mode Test
[UnityTest]
public IEnumerator Player_TakesDamage_HealthDecreases() {
    var player = new GameObject().AddComponent<Player>();
    player.Health = 100;

    player.TakeDamage(25);
    yield return null; // Wait one frame

    Assert.AreEqual(75, player.Health);
}
```

---

## Debugging

### Use Logging Best Practices

```csharp
// ✅ Structured logging (Unity 6+)
using UnityEngine;

Debug.Log($"Player {playerName} scored {score} points");

// ✅ Conditional compilation for debug code
#if UNITY_EDITOR || DEVELOPMENT_BUILD
    Debug.DrawRay(transform.position, direction, Color.red);
#endif
```

---

## Summary: Unity 6 Tech Stack

| Feature | Current Project Standard | Scope Boundary |
|---------|--------------------------|----------------|
| **Input** | Input System package | Legacy Input remains functional but is not the project standard |
| **UI** | uGUI for runtime; UI Toolkit when appropriate | UI Toolkit is the editor UI recommendation |
| **Rendering** | URP + RenderGraph for custom passes | Do not introduce Built-in RP-only assumptions |
| **Assets** | Unity import pipeline + Addressables 3.1.0 | Begin with local groups; remote delivery is not yet in scope |
| **Physics** | Unity Physics 3D | Vehicle model remains a prototype decision |
| **Multiplayer** | No networking stack | Netcode is not installed |

---

**Sources:**
- https://docs.unity3d.com/6000.3/Documentation/Manual/UI-system-compare.html
- https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU.html
- https://docs.unity3d.com/Packages/com.unity.inputsystem@1.19/manual/index.html
- https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@17.3/manual/index.html
