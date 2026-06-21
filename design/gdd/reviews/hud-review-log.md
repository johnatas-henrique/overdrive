# Review Log: HUD

## Review — 2026-06-20 — Verdict: APPROVED (after 2 revisions)

**Scope signal**: S
**Specialists**: None (`--depth lean`)
**Blocking items**: 0 | **Recommended revisions**: 2
**Prior verdict resolved**: First review

### Summary

Mature document — 17 ACs, 7 edge cases, 10 knobs, zone-based layout (HudConfig). 8 blocks (Minimap, Speed, Lap, Position, Resources, PitOverlay, DNF, Checkered). Event subscription table verified against all emitters. Two corrections applied:

1. **`hud.resources.update_interval` → `updateInterval`**: Única chave snake_case na tabela de knobs, alinhada ao camelCase das demais.

2. **States table wording**: "GSM transitions to Racing sub-state Racing" corrigido para descrever o fluxo real: HUD inicializa no GSM→Racing, CountdownBlock mostra durante Countdown, blocos completos ativam em `race.green.flag`.

### Verdict

**APPROVED** — document is complete, consistent, and implementation-ready.
