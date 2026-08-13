# Unity 6.3 LTS — Breaking Changes

**Editor version:** 6000.3.22f1
**Last verified:** 2026-08-13

This document covers changes that can affect code written for earlier Unity releases.
It does not imply that an uninstalled package is part of this project.

## High Risk — Physics API Renames

The active editor marks these `Rigidbody` properties obsolete:

| Obsolete API | Replacement |
|--------------|-------------|
| `Rigidbody.velocity` | `Rigidbody.linearVelocity` |
| `Rigidbody.drag` | `Rigidbody.linearDamping` |
| `Rigidbody.angularDrag` | `Rigidbody.angularDamping` |

`Physics.defaultSolverIterations` remains available with a default value of 6. Do not assume a Unity 6 default change without measuring the target scene.

## High Risk — URP Custom Renderer Features

For custom URP passes, use the RenderGraph path through `RecordRenderGraph`. The older `ScriptableRenderPass.Execute` path is retained for compatibility mode and is obsolete for the modern path.

## Project Standards, Not API Deprecations

- The project uses the Input System 1.20.0. The legacy `Input` APIs remain functional; do not label them obsolete solely because the Input System is preferred.
- The project uses URP 17.3.0. Do not introduce Built-in Render Pipeline-only rendering assumptions.
- Runtime UI should default to uGUI. UI Toolkit is a valid runtime alternative and the preferred system for editor tooling.
- `ParticleSystem`, UGUI, `Resources.Load`, and `Physics.RaycastAll` remain available APIs. Apply performance or architectural guidance to them without calling them deprecated.

## Optional Package Boundaries

Entities/DOTS, Netcode for GameObjects, and VFX Graph are not installed. Their migration requirements apply only after the corresponding package is deliberately introduced.

## Web

WebGL2 is the default web graphics API. WebGPU is experimental and must not be a production dependency for this project.

## Sources

- https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody.html
- https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Physics-defaultSolverIterations.html
- https://docs.unity3d.com/6000.3/Documentation/Manual/UI-system-compare.html
- https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU.html
