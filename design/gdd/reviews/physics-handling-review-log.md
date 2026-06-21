# Review Log: Physics/Handling

## Review — 2026-06-20 — Verdict: APPROVED (after 2 revisions)

**Scope signal**: S
**Specialists**: None (`--depth lean`)
**Blocking items**: 0 | **Recommended revisions**: 2
**Prior verdict resolved**: First review

### Summary

The most critical GDD in the project — architectural bottleneck, 15+ dependents. Strong document overall. Two concerns addressed:

1. **speedMod extrapolation (linha 120)**: `speedMod = lerp(0.5, 1.0, speed / referenceSpeed)` extrapolava além de 1.0 em velocidades > 250 km/h (speedMod ≈ 1.1 a 300 km/h, ≈ 1.2 a 350 km/h). Isso quebrava o plateau prometido pelo texto ("up to a reference point"). Corrigido com `clamp(speed / referenceSpeed, 0, 1)` — speedMod agora plateia em 1.0.

2. **collisionImpulse na tabela Audio (linha 243)**: Physics não computa collisionImpulse, apenas relay de Collision. Adicionado "(relayed from Collision)" para clareza.

3. **Alinhamento B5 confirmado**: Grid state entra por PreRace (GSM), carro locked via `setLocked()` da Race Management, Grid→Racing por `race.green.flag`. Tudo consistente.

### Verdict

**APPROVED** — documento mais importante, bem projetado. Grip envelope, lift-off oversteer, fuel/tire coupling, pipeline order — tudo consistente. 13 ACs testáveis.
