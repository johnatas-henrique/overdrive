# Overdrive

> An arcade F1 racing-RPG hybrid where every race is a battle.

Overdrive is an independent single-player Unity game project.

## Game Identity

- **Genre:** Arcade Racing-RPG Hybrid
- **Player count:** Single-player
- **Core fantasy:** Start as a rookie in a backmarker team, climb the grid,
  upgrade the car and crew, switch teams, and pursue the world championship.
- **Core loop:** Race, manage fuel and tires, earn credits, upgrade the car and
  crew, then return to the next race.
- **Development principle:** Explore Unity-native solutions and evaluate this
  technology stack on its own merits.

## Unity Implementation

- **Engine:** Unity 6.0.3.19f1
- **Language:** C#
- **Rendering:** Universal Render Pipeline 17.3.0
- **Input:** Unity Input System 1.19.0
- **Navigation:** AI Navigation 2.0.14
- **Editor integration:** Coplay Unity MCP through OpenCode

## Current State

The Unity project is at the foundation stage. The current scene contains the
objects and materials used to verify Coplay's Unity integration. Gameplay
systems have not been ported yet.

## Quick Start

1. Open the project in Unity 6.0.3.19f1.
2. Keep the Unity Editor running with Coplay available.
3. Start OpenCode from the project root:

   ```bash
   opencode
   ```

4. Use the OCGS skills and Unity MCP to inspect, implement, and verify the
   project.

## Project Structure

```text
/
├── Assets/             # Unity scenes, materials, settings, and game assets
├── ProjectSettings/    # Unity project configuration
├── Packages/           # Unity packages, including Coplay MCP
├── design/             # Local design registry and design rules
├── docs/               # Architecture, engine, workflow, and Coplay docs
├── production/         # Session state, audit logs, and production artifacts
├── .opencode/          # OpenCode agents, skills, commands, rules, and plugins
└── opencode.json       # OpenCode and Unity MCP configuration
```

## OCGS Workflow

The project uses OpenCode Game Studios for documented collaboration:

```text
Design → Architecture → Stories → Implementation → Verification
```

Agents propose changes, the user approves file writes, and Unity/Coplay
provides in-editor inspection and visual verification.

## License

MIT
