# Unity 6.3 — Navigation Module Reference

**Last verified:** 2026-07-19
**Knowledge Gap:** Unity 6 NavMesh improvements

---

## Overview

Unity 6 navigation systems:
- **NavMesh**: Built-in pathfinding for AI agents
- **AI Navigation**: Installed package for runtime NavMesh building and links

---

## NavMesh Basics

### Bake Navigation Mesh

1. Mark walkable surfaces:
   - Select GameObject (floor/terrain)
   - Inspector > Navigation > Object tab
   - Check "Navigation Static"

2. Bake NavMesh:
   - `Window > AI > Navigation`
   - Bake tab
   - Click "Bake"

3. Configure settings:
   - **Agent Radius**: How wide the agent is (0.5m default)
   - **Agent Height**: How tall the agent is (2m default)
   - **Max Slope**: Maximum walkable slope (45° default)
   - **Step Height**: Maximum climbable step (0.4m default)

---

## NavMeshAgent (AI Movement)

### Basic Agent Setup

```csharp
using UnityEngine;
using UnityEngine.AI;

public class Enemy : MonoBehaviour {
    private NavMeshAgent agent;
    public Transform target;

    void Start() {
        agent = GetComponent<NavMeshAgent>();
    }

    void Update() {
        // ✅ Move to target
        agent.SetDestination(target.position);
    }
}
```

---

### NavMeshAgent Properties

```csharp
NavMeshAgent agent = GetComponent<NavMeshAgent>();

// Speed
agent.speed = 3.5f;

// Acceleration
agent.acceleration = 8f;

// Stopping distance
agent.stoppingDistance = 2f; // Stop 2m before destination

// Auto-braking (slow down at destination)
agent.autoBraking = true;

// Rotation speed
agent.angularSpeed = 120f; // Degrees per second

// Obstacle avoidance
agent.obstacleAvoidanceType = ObstacleAvoidanceType.HighQualityObstacleAvoidance;
```

---

### Check Path Status

```csharp
void Update() {
    agent.SetDestination(target.position);

    // Check if agent has a path
    if (agent.hasPath) {
        // Check if path is complete
        if (agent.pathStatus == NavMeshPathStatus.PathComplete) {
            Debug.Log("Valid path");
        } else if (agent.pathStatus == NavMeshPathStatus.PathPartial) {
            Debug.Log("Partial path (destination unreachable)");
        } else {
            Debug.Log("Invalid path");
        }
    }

    // Check if agent reached destination
    if (!agent.pathPending && agent.remainingDistance <= agent.stoppingDistance) {
        Debug.Log("Reached destination");
    }
}
```

---

### Calculate Path (Don't Move Yet)

```csharp
NavMeshPath path = new NavMeshPath();
agent.CalculatePath(targetPosition, path);

if (path.status == NavMeshPathStatus.PathComplete) {
    // Valid path exists
    agent.SetPath(path); // Apply the path
}
```

---

## NavMesh Areas (Walkable Costs)

### Define Areas
`Window > AI > Navigation > Areas tab`
- **Walkable**: Cost 1 (default)
- **Not Walkable**: Unwalkable
- **Jump**: Cost 2 (prefer other routes)
- **Custom**: Define your own

### Assign Area Costs

```csharp
// Prefer shorter paths over low-cost paths
agent.areaMask = NavMesh.AllAreas; // Walk on all areas

// Only walk on "Walkable" area (avoid "Jump")
agent.areaMask = 1 << NavMesh.GetAreaFromName("Walkable");
```

---

## NavMesh Obstacles (Dynamic Obstacles)

### NavMeshObstacle Component

```csharp
// Add: GameObject > Add Component > NavMesh Obstacle

// Carve: Create hole in NavMesh (agents avoid)
// Don't Carve: Agent pushes through (local avoidance)
```

### Dynamic Carving (Moving Obstacles)

```csharp
NavMeshObstacle obstacle = GetComponent<NavMeshObstacle>();
obstacle.carving = true; // Create dynamic hole in NavMesh
```

---

## NavMesh Links (Jumps, Teleports)

Use `Unity.AI.Navigation.NavMeshLink`. The old `UnityEngine.AI.OffMeshLink` component and its members are obsolete in the installed editor.

1. Add a `NavMeshLink` component to a GameObject.
2. Configure `startTransform` and `endTransform`.
3. Configure `bidirectional`, `area`, and `costModifier` only when the traversal design requires them.
4. Keep animation-specific traversal behavior in the gameplay system that owns the agent; do not copy examples based on obsolete `OffMeshLink` APIs.

---

## AI Navigation Package (Runtime Baking)

### Project State

`com.unity.ai.navigation` 2.0.14 is installed.

### Runtime NavMesh Baking

```csharp
using Unity.AI.Navigation;

public class NavMeshBuilder : MonoBehaviour {
    public NavMeshSurface surface;

    void Start() {
        // Bake NavMesh at runtime
        surface.BuildNavMesh();
    }

    void UpdateNavMesh() {
        // Update NavMesh after terrain changes
        surface.UpdateNavMesh(surface.navMeshData);
    }
}
```

---

## Common Patterns

### Patrol Between Waypoints

```csharp
public Transform[] waypoints;
private int currentWaypoint = 0;

void Update() {
    if (!agent.pathPending && agent.remainingDistance < 0.5f) {
        // Reached waypoint, move to next
        currentWaypoint = (currentWaypoint + 1) % waypoints.Length;
        agent.SetDestination(waypoints[currentWaypoint].position);
    }
}
```

### Chase Player

```csharp
public Transform player;
public float chaseRange = 10f;

void Update() {
    float distance = Vector3.Distance(transform.position, player.position);

    if (distance <= chaseRange) {
        agent.SetDestination(player.position);
    } else {
        agent.ResetPath(); // Stop moving
    }
}
```

### Flee from Player

```csharp
public Transform player;
public float fleeRange = 5f;

void Update() {
    float distance = Vector3.Distance(transform.position, player.position);

    if (distance <= fleeRange) {
        // Run away from player
        Vector3 fleeDirection = transform.position - player.position;
        Vector3 fleeTarget = transform.position + fleeDirection.normalized * 10f;

        agent.SetDestination(fleeTarget);
    }
}
```

---

## Debugging

### NavMesh Visualization
- `Window > AI > Navigation > Bake tab`
- Check "Show NavMesh" to visualize walkable areas

### Agent Path Gizmos

```csharp
void OnDrawGizmos() {
    if (agent != null && agent.hasPath) {
        Gizmos.color = Color.green;
        Vector3[] corners = agent.path.corners;

        for (int i = 0; i < corners.Length - 1; i++) {
            Gizmos.DrawLine(corners[i], corners[i + 1]);
        }
    }
}
```

---

## Performance Tips

- **Limit Obstacle Avoidance Quality**: Use `LowQualityObstacleAvoidance` for distant agents
- **Update Frequency**: Don't call `SetDestination()` every frame if target hasn't moved
- **Area Masks**: Limit walkable areas to reduce pathfinding search space
- **NavMesh Tiles**: Use tiled NavMesh for large worlds (AI Navigation package)

---

## Sources
- https://docs.unity3d.com/Packages/com.unity.ai.navigation@2.0/manual/index.html
