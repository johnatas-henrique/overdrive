# MVP Performance Baseline — PC Hardware Recommendation

**Date:** 2026-07-24
**Author:** Research (sub-agent)
**Status:** Draft for review
**Scope:** PC MVP 16-car Unity 6.3 manual-PhysX simulation performance gate
**Gate targets (ADR-0001):** p95 ≤ 6 ms, max ≤ 8 ms per tick on the empirically selected MVP PC baseline

---

## 1. Project Constraints

| Constraint | Source | Detail |
|---|---|---|
| Engine | `docs/engine-reference/unity/VERSION.md` [C] | Unity 6000.3.19f1 (Unity 6.3 LTS) |
| Pipeline | `docs/engine-reference/unity/VERSION.md` [C] | URP 17.3.0 |
| Physics mode | `docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md` [C] | `SimulationMode.Script`, one `Physics.Simulate(FIXED_DT)` per tick |
| Tick rate | `design/gdd/simulation-architecture.md` [C] | Fixed 60 Hz (`FIXED_DT = 1/60 s ≈ 16.667 ms`) |
| Car count | `design/gdd/game-concept.md` [C] | 16 cars on track (player + 15 AI) |
| Performance gate | `docs/architecture/adr-0001.md` [C] | p95 ≤ 6 ms, absolute max ≤ 8 ms per tick |
| Performance protection | `design/gdd/simulation-architecture.md` [C] | <30 FPS 3 s → quality reduce; <15 FPS 3 s → pause |
| Collider strategy | `docs/architecture/adr-0001.md` [C] | Simplified colliders + layer-based filtering mandatory |
| Benchmark data sets | `design/gdd/simulation-architecture.md` [C] | 16-car with AI, Fuel, Tire, RSM, Ghost capture active |
| Platforms | `design/gdd/game-concept.md` [C] | PC MVP (Steam/Epic); Web Alpha (reduced 60 FPS profile) |
| Web Alpha constraints | `design/gdd/content-pipeline.md` [C] | 768 MB heap min, ASTC 6×6, 3 LODs, ≤3 MB per car bundle |
| PC per-race memory | `design/gdd/content-pipeline.md` [C] | ~730–1320 MB (total, all systems) |
| Web per-race memory | `design/gdd/content-pipeline.md` [C] | ~415–670 MB (total, all systems) |
| Unity 6.3 Player (Windows) | `docs.unity3d.com/6000.3/Documentation/Manual/system-requirements.html` [C] | Win 10 21H1+, x86/x64 SSE2, DX10/11/12/Vulkan GPU |
| Unity 6.3 Player (Linux) | `docs.unity3d.com/6000.3/Documentation/Manual/system-requirements.html` [C] | Ubuntu 22.04/24.04, x64 SSE2, OpenGL 3.2+/Vulkan |
| Unity 6.3 Player (Web) | `docs.unity3d.com/6000.3/Documentation/Manual/system-requirements.html` [C] | WebGL 2.0, 64-bit WebAssembly, modern browsers |
| Unity Editor RAM | `docs.unity3d.com/6000.3/Documentation/Manual/system-requirements.html` [C] | 8 GB recommended (Editor); no min spec published for Player |

[C] = Confirmed from primary source. [I] = Inferred from evidence. [S] = Assumption (requires validation).

---

## 2. Physics Simulation Workload Characterisation

### 2.1 What the tick does (from ADR-0001 and simulation-architecture GDD)

```
TickStartSnapshot
→ player SimulationInput + cached AIInput
→ Tire/Fuel pre-step state
→ force application by ascending carId
→ one whole-scene Physics.Simulate(1/60f)      ← PhysX kernel
→ CarState readout by ascending carId
→ RSM events and requests
→ AIInput for next tick
→ Ghost input + tick index
→ PublishedSimulationSnapshot
```

The PhysX call dominates tick cost. The surrounding C# logic (input marshalling, state readout, AI, ghost) is lightweight by comparison.

### 2.2 PhysX performance characteristics

- **PhysX solver is primarily single-threaded** for a single `PhysicsScene` at 60 Hz — the broad phase is multi-threaded internally, but the narrow phase and constraint solving run on limited threads [I]. Single-core IPC and frequency are the dominant CPU factor.
- **Unity 6.0 had confirmed physics regressions** vs 2022.3 LTS (3–7× slower `SyncColliders` reported in Issue Tracker, ~8× regression in forum reports). Fixed in 6000.1.4f1 per Unity staff.
  Source: `forum.unity.com/t/unity-6000-x-physics-performance-regression/1604000` [C]
- **Unity 6.3 (6000.3.19f1)** is the current LTS and should include all fixes. The project must profile before assuming parity with 2022.3. [I]
- **PhysX scales super-linearly with contact count** — 16 cars with simplified box-sphere colliders generate far fewer contacts than meshes with detailed collision geometry. Simplified colliders are mandatory per ADR-0001. [I]
- **At 60 Hz**, each tick simulates exactly `1/60 s`. No catch-up multi-step occurs unless the accumulator detects frame drops (clamped at 2× FIXED_DT per design). [C]

### 2.3 Key risk: spiral-of-doom

Unity docs warn: if the main thread is overloaded, the physics system may need multiple `Simulate` calls per frame, escalating CPU use. The project's accumulator clamp (`2 × FIXED_DT`) mitigates this by discarding excess time, but a sustained overload will still degrade the tick. The performance gate must be validated on the *lowest* target to avoid spiral edge cases. [I]

Source: `docs.unity3d.com/6000.3/Documentation/Manual/physics-performance-issues.html` [C]

---

## 3. Candidate Hardware Baselines

**Warning:** The CPU benchmarks below (PassMark STR) are generic synthetic benchmarks covering a mix of integer, floating-point, encryption, and compression workloads. They do **not** measure PhysX tick performance. PassMark STR provides a rough relative CPU ranking for general single-threaded work but is not evidence that any specific CPU can meet the project's p95 ≤ 6 ms gate. All hardware selections in this section are [S] (assumption) pending empirical validation. See Section 6, limitation 8.

### 3.1 CPU comparison (single-thread performance)

| Tier | CPU | Cores/Threads | Base/Turbo | PassMark STR | STR vs Entry | Price (2026) |
|---|---|---|---|---|---|---|
| Entry | Intel Core i5-10400 | 6/12 | 2.9/4.3 GHz | **2,557** | — | ~$120 |
| Entry | AMD Ryzen 3 3300X | 4/8 | 3.8/4.3 GHz | ~2,600* | — | ~$100 |
| Mid | Intel Core i5-12400 | 6/12 | 2.5/4.4 GHz | **3,463** | +35% | ~$192 |
| Mid | AMD Ryzen 5 5600 | 6/12 | 3.5/4.4 GHz | **3,257** | +27% | ~$130 |
| Rec | Intel Core i7-12700 | 8+4/20 | 2.1/4.9 GHz | **3,845** | +50% | ~$399 |
| Rec | AMD Ryzen 7 5700X | 8/16 | 3.4/4.6 GHz | **3,387** | +32% | ~$180 |

STR = PassMark Single Thread Rating (July 2026). PassMark STR is a general-purpose synthetic benchmark; it does not measure PhysX or Unity physics simulation performance. [S]
Source: `cpubenchmark.net/singleThread.html` [C]
*Ryzen 3 3300X STR is interpolated from adjacent models; no direct page found. [S]

**Note:** The i5-12400 (Alder Lake) uses hybrid architecture with 6 P-cores and 4 E-cores. Its P-core single-thread is ~3,463 STR. The i7-12700 adds 2 more P-cores + 4 E-cores but same P-core microarchitecture. However, STR ranking is a general metric and does not guarantee proportional physics tick improvement. [S]

### 3.2 GPU comparison (for the rendering side of the frame)

| Tier | GPU | PassMark G3D | VRAM | Steam share (Jun 2026) |
|---|---|---|---|---|
| Entry | GTX 1650 | 7,870 | 4 GB | 2.50% |
| Entry | GTX 1050 Ti | 6,362 | 4 GB | 1.16% |
| Mid | RTX 2060 | 14,094 | 6 GB | 1.65% |
| Mid | RTX 3060 (12 GB) | 16,952 | 12 GB | 3.73% |
| Mid | RTX 4060 | 19,511 | 8 GB | 3.46% |
| Rec | RTX 3060 Ti | 20,263 | 8 GB | 2.12% |
| Rec | RTX 4060 Ti | est. 21,500+ | 8/16 GB | 2.29% |

Source: `videocardbenchmark.net` [C], `store.steampowered.com/hwsurvey` (June 2026) [C]

**GPU note:** PassMark G3D is a general-purpose DirectX benchmark. The GPU is largely decoupled from the physics tick (which is the performance gate's primary constraint). GPU selection here addresses rendering capability only. [S]

### 3.3 Steam Hardware Survey — demographic reference (June 2026)

**Note:** The Steam Hardware Survey reports what hardware Steam users *own*, not how it performs for PhysX workloads. It is a demographic reference for target audience sizing, not performance evidence. [S]

| Metric | Value | Source |
|---|---|---|
| Most common GPU | RTX 4060 Laptop (3.81%), RTX 3060 (3.73%) | [C] |
| VRAM | 8 GB (25.64%), 16 GB (24.50%), 12 GB (13.01%) | [C] |
| Primary resolution | 1920×1080 (51.12%), 2560×1440 (21.44%) | [C] |
| RAM (Nov 2025) | 16 GB (40.94%), 32 GB (36.96%) | [C] |
| CPU cores (Sep 2025) | 6-core ~30%, 8-core ~25% | [C] |
| OS | Windows 10 + 11 dominate (no separate % given but >95%) | [C] |

---

## 4. Baseline Recommendations

**Warning:** The recommendations below are desk-research candidates only, assembled from generic benchmark ranking (PassMark) and demographic data (Steam survey). No candidate has been validated against the project's specific PhysX workload. All are [S] (assumption) until empirically confirmed. See Section 7 for the required validation protocol.

### 4.1 Recommendation A: Lowest MVP target (performance gate baseline — CANDIDATE, [S])

This is the **proposed reference machine for the performance gate** — the lowest-spec config where p95 ≤ 6 ms and max ≤ 8 ms must hold. **Its selection is not yet supported by physics-performance evidence.**

| Component | Specification | Rationale |
|---|---|---|
| **CPU** | **Intel Core i5-10400**[S] or **AMD Ryzen 5 3600**[S] | 6-core/12-thread, ~2,557–2,800 STR. Represents ~30th percentile of Steam CPUs (entry 6-core tier).[S] Below this, Unity 6.3 can still run, but physics tick budget is at risk.[I] Neither CPU has been profiled with the project's 16-car PhysX workload. |
| **GPU** | **NVIDIA GTX 1650** (4 GB) or equivalent | Rendering is decoupled from physics; 4 GB VRAM sufficient for 1080p Low. G3D 7,870 is well below mid-range. |
| **RAM** | **16 GB** | 8 GB is Unity Editor minimum but PC MVP per-race budget is ~730–1,320 MB; OS + browser + background eats the rest. 16 GB is the Steam majority (40.94%). |
| **OS** | Windows 10 21H1+ or Ubuntu 22.04 | Per Unity 6.3 Player requirements. |
| **Resolution** | **1920×1080** | Covers 51% of Steam. |
| **Quality** | **Low** | Reduced textures, no post-processing, simplified shadows. |
| **Storage** | SSD (any) | Addressables streaming benefits from random-read IO. |

**Validation requirement (see also Section 7 protocol):** Build must run on this config with the profiler capturing 60+ seconds of 16-car race, tick timing recorded. Gate pass = p95 ≤ 6 ms, max observed ≤ 8 ms across all ticks. Until this measurement exists, the baseline is unsubstantiated.

### 4.2 Recommendation B: Representative mid-range (realistic target — CANDIDATE, [S])

The config that covers a wide Steam demographic for the *rendering* quality target. Its selection for the physics gate is unsupported by physics-performance data. [S]

| Component | Specification | Rationale |
|---|---|---|
| **CPU** | **Intel Core i5-12400** or **AMD Ryzen 5 5600** | ~3,257–3,463 STR. ~35% headroom over entry tier. Matches mainstream 6-core user. |
| **GPU** | **NVIDIA RTX 3060** (12 GB) or **RTX 4060** (8 GB) | 12 GB VRAM covers PC memory budget comfortably; G3D 16,952–19,511 handles 1080p Medium. |
| **RAM** | **16 GB** | Majority share. |
| **Resolution** | **1920×1080** | Majority share. |
| **Quality** | **Medium** | Standard settings, moderate post-processing. |

### 4.3 Recommendation C: Developer machine (recommended for team — CANDIDATE, [S])

| Component | Specification |
|---|---|
| **CPU** | **Intel Core i7-12700** or **AMD Ryzen 7 5700X** |
| **GPU** | **NVIDIA RTX 3060 Ti** or **RTX 4060 Ti** |
| **RAM** | **32 GB** |
| **Resolution** | **1920×1080** or **2560×1440** |
| **Quality** | **High** |

---

## 5. Source Confidence Table

| Claim | Confidence | Source type | Specific source |
|---|---|---|---|
| Unity 6.3 sys reqs | Confirmed | First-party docs | `docs.unity3d.com/6000.3/Documentation/Manual/system-requirements.html` |
| ADR-0001 gate target | Confirmed | Project ADR | `docs/architecture/adr-0001.md` lines 52–53 |
| Simulation architecture | Confirmed | Project GDD | `design/gdd/simulation-architecture.md` |
| Memory budgets | Confirmed | Project GDD | `design/gdd/content-pipeline.md` lines 79–98 |
| WebGL constraints | Confirmed | Project GDD | `design/gdd/content-pipeline.md` lines 107–114 |
| CPU STR i5-10400: 2,557 | Confirmed (numeric value only) | Benchmark aggregator | `cpubenchmark.net/compare/3737vs3733vs4814vs6423` (Jul 2026) — STR is a generic benchmark, not a PhysX proxy [S] |
| CPU STR i5-12400: 3,463 | Confirmed (numeric value only) | Benchmark aggregator | `cpubenchmark.net/cpu.php?cpu=Intel+Core+i5-12400&id=4677` (Jul 2026) — same caveat |
| CPU STR i7-12700: 3,845 | Confirmed (numeric value only) | Benchmark aggregator | `cpubenchmark.net/singleThread.html` (Jul 2026) — same caveat |
| CPU STR Ryzen 5 5600: 3,257 | Confirmed (numeric value only) | Benchmark aggregator | `cpubenchmark.net/compare/3737vs4811` (Feb 2026) — same caveat |
| CPU STR Ryzen 7 5700X: 3,387 | Confirmed (numeric value only) | Benchmark aggregator | `cpubenchmark.net/compare/3737vs3733vs4814vs6423` (Jun 2026) — same caveat |
| GPU G3D RTX 3060: 16,952 | Confirmed (numeric value only) | Benchmark aggregator | `videocardbenchmark.net/gpu.php?gpu=GeForce+RTX+3060&id=6498` (Apr 2026) — G3D is a synthetic DirectX benchmark, not a physics proxy [S] |
| Steam survey GPU/RAM/res | Confirmed (demographic data only) | First-party (Valve) | `store.steampowered.com/hwsurvey` (Jun 2026) — demographic only, not performance data [S] |
| Unity 6 physics regression | Confirmed | Forum + Issue Tracker | `forum.unity.com/t/unity-6000-x-physics-performance-regression/1604000` (Feb 2025) |
| PhysX manual simulation docs | Confirmed | First-party docs | `docs.unity3d.com/6000.3/Documentation/Manual/physics-optimization-cpu-manual-simulation.html` |
| PhysX single-thread dominance | Inferred | General knowledge | PhysX solver architecture; no first-party perf breakdown published |
| Mid-tier covers Steam majority | Inferred | Cross-reference | 6-core ~30% + 8-core ~25% survey vs. recommendation tiers |

**Sources used by type:**
- **First-party Unity docs** (7 URLs) — system requirements, manual simulation, PhysX performance, WebGL constraints
- **Project GDDs/ADRs** (5 files) — simulation architecture, ADR-0001, content-pipeline, game-concept, VERSION.md
- **Benchmark aggregators** (PassMark, 5 URLs) — CPU single-thread, GPU G3D
- **First-party Valve** (1 URL) — Steam Hardware Survey
- **Community** (1 URL) — Unity forum physics regression report

---

## 6. Limitations and Open Questions

1. **No first-party Unity data on PhysX tick cost scaling with rigidbody count.** Unity does not publish benchmark data for `Physics.Simulate(t)` at various body counts. The single-thread emphasis is inferred from PhysX architecture knowledge and community profiling — it must be validated on the project's specific collider setup.

2. **Unity 6.3 physics performance vs 2022.3 is not independently measured.** The regression was reportedly fixed in 6000.1.4f1, but this project uses 6000.3.19f1. No public benchmark confirms full parity. **The project should run its own comparative microbenchmark** (empty scene, N rigidbodies, `Physics.Simulate` loop) before committing to the baseline.

3. **The "lowest MVP target" is not explicitly named in any GDD.** ADR-0001 says "on the lowest supported MVP target" but doesn't specify what hardware that is. Recommendation A (i5-10400 / GTX 1650) is an informed proposal; the team must formally decide and document the chosen target spec in an ADR or design document.

4. **Web Alpha is excluded from this baseline.** WebGL tick cost will differ due to:
   - WebAssembly translation overhead (CPU-side operations are slower per cycle)
   - No Burst-compiled physics jobs on Web (only native C/C++ multithreading if enabled)
   - Fixed 768 MB heap limit constraining texture/LOD quality

   A separate WebGL benchmark prototype is needed. The GDD correctly marks Web as a "reduced 60 FPS profile."

5. **Memory budget estimates are pre-implementation.** The ~730–1320 MB per-race range in `content-pipeline.md` is a planning estimate, not profiler output. Actual RAM usage will only be confirmed after the first integrated 16-car build.

6. **Laptop vs. desktop variance.** PassMark STR data mixes desktop and laptop SKUs. Laptop i5-12400 or Ryzen 5 5600H may score 10–20% lower due to thermal/power constraints. If the lowest MVP target includes gaming laptops (Steam Deck, mainstream gaming laptops), adjust the baseline downward by ~15%.

7. **No Linux GPU benchmark data gathered.** The GPU recommendations assume DX11/12 (Windows). Linux OpenGL/Vulkan performance may differ. Vulkan is recommended for Linux builds per Unity 6.3 docs.

8. **PassMark STR and G3D are not PhysX proxies.** The entire hardware baseline in Section 4 is built on generic synthetic benchmarks (PassMark STR/G3D) and demographic data (Steam survey). No primary source — from Unity, AMD, Intel, or NVIDIA — publishes PhysX tick performance benchmarks for any of the CPUs or GPUs listed. The selection of i5-10400 / GTX 1650 as the "lowest MVP target" is therefore an assumption [S], not a finding supported by primary evidence. **A desk-research hardware baseline without project-specific empirical measurement is not defensible as a performance gate target.** The only way to produce a defensible baseline is to profile the actual 16-car physics tick on candidate hardware; see Section 7.

---

## 7. Verdict and Required Protocol

### 7.1 Verdict: Desk-research baseline is NOT defensible

No primary source measures Unity 6.3 PhysX tick performance for any of the candidate CPUs. PassMark STR is a general synthetic benchmark — it ranks CPUs for generic single-threaded work but does not predict physics solver tick cost. The Steam Hardware Survey reports hardware ownership demographics, not performance. Therefore **a desk-research hardware baseline for the p95 ≤ 6 ms gate cannot be produced with primary-source evidence alone.** Any hardware selection made before profiling the project's actual 16-car PhysX workload rests on unvalidated assumptions.

### 7.2 Required protocol: Empirical baseline selection after a 16-car prototype

After the first integrated 16-car prototype is running, execute the following benchmark protocol to select the performance gate baseline empirically:

1. **Instrument the tick.** Wrap `Physics.Simulate(FIXED_DT)` and the full tick loop (lines 42–51) with `System.Diagnostics.Stopwatch` or `UnityEngine.Profiling.Recorder`. Record per-tick elapsed time for ≥ 60 s of simulation at 60 Hz.

2. **Profile on a spectrum of hardware.** Run the benchmark on at least three machines spanning the PassMark STR range from ~2,000 to ~4,000:
   - Low-end: a CPU scoring ~2,000–2,500 STR (e.g., i5-8400, i5-10400, or a laptop-class Ryzen 5 4500U)
   - Mid-range: a CPU scoring ~3,000–3,500 STR (e.g., i5-12400, Ryzen 5 5600)
   - High-end: a CPU scoring ~3,800+ STR (e.g., i7-12700, Ryzen 7 5700X)

3. **Measure p95 and max tick time** on each machine. Plot tick time vs. STR to determine the empirical relationship for this specific workload.

4. **Select the baseline.** The lowest-cost CPU whose p95 tick ≤ 6 ms and absolute max ≤ 8 ms (per ADR-0001) becomes the official performance gate target. The result disproves or confirms the provisional candidate (i5-10400 / GTX 1650).

5. **Document the result.** Record the empirical baseline in a new ADR, replacing this document.

6. **Steam Survey as a demographic filter (secondary).** Once the empirical tick-vs-STR curve is known, use the Steam CPU-core distribution to estimate what fraction of the Steam audience the selected baseline covers. This informs the rendering quality target but does not affect the physics gate target.

### 7.3 Candidate baselines (provisional, [S] until protocol is executed)

The desk-research candidates below are retained for reference only. They remain [S] (assumption) and must not be used as performance gate targets until validated by the protocol above.

| Tier | CPU candidate | GPU candidate | STR basis |
|---|---|---|---|
| Low (gate baseline) | Core i5-10400 / Ryzen 5 3600 | GTX 1650 (4 GB) | ~2,557–2,800 STR [S] |
| Mid (representative) | Core i5-12400 / Ryzen 5 5600 | RTX 3060 (12 GB) | ~3,257–3,463 STR [S] |
| Developer | Core i7-12700 / Ryzen 7 5700X | RTX 3060 Ti / 4060 Ti | ~3,387–3,845 STR [S] |
