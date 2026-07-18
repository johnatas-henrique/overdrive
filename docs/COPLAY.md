# Coplay MCP for Unity

## Purpose

This document records how this project connects OpenCode to the Unity Editor through Coplay MCP. It is the operational reference for future sessions and must be updated when the transport, package version, project path, or validation procedure changes.

Last verified: 2026-07-17.

## Current topology

```text
Unity Editor: Windows
Unity project: D:\projects\overdrive
WSL project path: /mnt/d/projects/overdrive
OpenCode: Ubuntu on WSL
WSL networking: mirrored
Coplay transport: HTTP
Coplay endpoint: http://127.0.0.1:8080/mcp
Unity version: 6000.3.19f1
```

The Coplay server runs with the Windows Unity Editor. OpenCode connects from WSL through the mirrored-networking loopback address. Use `127.0.0.1`, not `::1`.

## Project configuration

The Unity package is declared in `Packages/manifest.json`:

```json
"com.coplaydev.unity-mcp": "https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main"
```

At the last verification, Unity resolved the embedded package as version `10.1.0` in `Packages/packages-lock.json` and materialized it under `Packages/com.coplaydev.unity-mcp/`.

The project-level OpenCode configuration is `opencode.jsonc`:

```jsonc
{
  "mcp": {
    "unityMCP": {
      "type": "remote",
      "url": "http://127.0.0.1:8080/mcp",
      "enabled": true
    }
  }
}
```

Merge this entry into the existing configuration. Do not replace the whole file because it also contains the project's plugins, commands, permissions, and other MCPs.

## Official references

- Coplay installation: <https://coplaydev.github.io/unity-mcp/getting-started/install>
- Coplay first prompt: <https://coplaydev.github.io/unity-mcp/getting-started/first-prompt>
- Coplay releases: <https://coplaydev.github.io/unity-mcp/releases>
- Coplay tool catalog: <https://coplaydev.github.io/unity-mcp/>
- OpenCode MCP servers: <https://opencode.ai/docs/pt-br/mcp-servers/>
- WSL networking: <https://learn.microsoft.com/en-us/windows/wsl/networking>

## Installation and connection procedure

1. Open the project in Unity on Windows.
2. Install the Coplay package through Unity Package Manager using a reviewed Git URL or release tag.
3. Open the Coplay setup window in Unity.
4. Verify Python and `uv` on the machine that runs the Coplay server.
5. Select HTTP transport and start the server.
6. Confirm that port `8080` is reachable from WSL:

   ```bash
   curl -4 -i http://127.0.0.1:8080/mcp
   ```

   A protocol response such as `406 Not Acceptable` still proves that the TCP endpoint is reachable; the MCP client must send the `text/event-stream` Accept header for a valid MCP request.

7. Ensure `opencode.jsonc` contains the `unityMCP` remote entry.
8. Restart OpenCode or reload its MCP configuration.
9. Verify that the MCP server completes `initialize` and that `tools/list` returns Unity tools.

## Safe operating procedure

Use the following order for stories that change Unity:

```text
inspect current scene and project
→ define the allowed scope
→ make the smallest change
→ read hierarchy and serialized state
→ capture Scene View or Game View evidence
→ run Play Mode or targeted tests
→ read the Unity Console
→ report changed files and objects
```

Do not mark a visual story complete only because a script compiled. Combine:

- numeric evidence: position, rotation, scale, bounds;
- structural evidence: hierarchy and components;
- visual evidence: Scene View or Game View screenshot;
- behavioral evidence: Play Mode or test result.

## Tool groups

The `core` group is sufficient for the initial workflow. Enable other groups only when a story requires them:

- animation;
- UI Toolkit;
- VFX;
- ProBuilder;
- asset generation;
- advanced scripting.

Keep unnecessary groups disabled to reduce the tool surface and mutation risk.

Important tools include:

- read-only: `find_gameobjects`, `read_console`, resource reads;
- scene and object changes: `manage_scene`, `manage_gameobject`, `manage_components`;
- assets and visuals: `manage_asset`, `manage_material`, `manage_camera`;
- validation: `validate_script`, `run_tests`;
- high-risk operations: `execute_code`, menu execution, deletion, and build operations.

## Functional test record

The first functional test was executed through the Coplay HTTP endpoint on 2026-07-17.

### Created object

- Name: `CoplayTestCube`
- Scene: `Assets/Scenes/SampleScene.unity`
- Position: `(0, 0, 0)`
- Scale: `(1, 1, 1)`
- Components: `Transform`, `MeshFilter`, `BoxCollider`, `MeshRenderer`, `Rigidbody`

### Created material

- Asset: `Assets/Materials/CoplayTestRed.mat`
- Shader: `Universal Render Pipeline/Lit`
- Color: red through `_BaseColor`
- Applied to: `CoplayTestCube`

### Visual evidence

- Screenshot: `Assets/Screenshots/CoplayTestCube_GameView_Red.png`
- Captured resolution: `542 × 640`
- Result: the red cube was visible and centered in the Game View.

### Console result

The first material creation attempt failed because `Assets/Materials` did not exist. The folder was then created through Coplay, the material was created and assigned successfully, the Console was cleared, and the final read returned zero errors and zero warnings.

## Diagnostics

Unity logs:

```text
C:\Users\Johnatas\AppData\Local\Unity\Editor\Editor.log
```

Project logs:

```text
Logs/Packages-Update.log
Logs/AssetImportWorker*.log
```

Useful checks from WSL:

```bash
curl -4 -i http://127.0.0.1:8080/mcp
ss -ltnp '( sport = :8080 )'
```

### Failure interpretation

- `Connection refused` or timeout: Unity/Coplay server is not listening or the Windows/WSL network route is unavailable.
- `406 Not Acceptable`: the endpoint is reachable, but the request does not include the MCP streaming Accept header.
- OpenCode sees no tools: check the project-level `opencode.jsonc`, restart OpenCode, and verify the remote URL.
- Asset creation reports that the parent directory is missing: create the directory first with `manage_asset` using `action: "create_folder"`.
- Unity compile errors: stop feature work and inspect the Unity Console and `Editor.log` before making further changes.

## Project hygiene

- Do not use `#main` for a release build without reviewing the resolved package version.
- Prefer a reviewed release tag for reproducible project state.
- Do not modify production scenes during infrastructure tests unless the test explicitly targets that scene.
- Keep screenshots and generated test assets identifiable by name.
- Report every scene, asset, script, and project-setting change after a Coplay operation.
