# Engine Data — Exact Values (16 teams, 1989 F1)

Reference table for the real-engine acceleration model (Option A, 2026-08-02).
Source of the physics: power-to-mass ratio of each real 1989 engine, fixed car
mass 505 kg (GDD), traction limit 13.5 m/s², quadratic aero drag calibrated so
the equilibrium speed equals the car's theoretical top speed.

## Model

```
a(v) = min(13.5, P/m / v) − K·v²        [m/s²]
K    = (P/m) / (vmax_th / 3.6)³         [1/m]
vmax_pr = vmax_th − 2                   [km/h]  (practical top speed, asymptote)
```

- Below ~90 km/h the traction limit (13.5 m/s²) dominates — **all cars do
  0-100 in 2.11 s**.
- The P/m term takes over mid-speed; K·v² dominates near vmax (the asymptote).
- Times below were obtained by numerical integration (dt = 2 ms) of the model.

## Table

| Team | Car | Engine | P/m (m²/s³) | vmax_th (km/h) | vmax_pr (km/h) | K (1/m) | t100 (s) | t200 (s) | t250 (s) | **t280 (s)** | t310 (s) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| tier1_a | McLaren MP4/5 | Honda RA109E V10 | 1012 | 340 | 338 | 0.001201 | 2.11 | 4.57 | 6.16 | **7.37** | 9.40 |
| tier1_b | Ferrari 640 | Ferrari 035/5 V12 | 974 | 340 | 338 | 0.001156 | 2.11 | 4.55 | 6.11 | **7.33** | 9.43 |
| tier1_c | Williams FW12C | Renault RS1 V10 | 960 | 335 | 333 | 0.001191 | 2.11 | 4.57 | 6.15 | **7.44** | 9.79 |
| tier1_d | Benetton B189 | Ford HB V8 | 931 | 330 | 328 | 0.001209 | 2.11 | 4.57 | 6.17 | **7.56** | 10.30 |
| tier2_a | March CG891 | Judd CV V8 | 915 | 322 | 320 | 0.001279 | 2.11 | 4.61 | 6.26 | **7.81** | 11.45 |
| tier2_b | Lotus 101 | Judd CV V8 | 915 | 322 | 320 | 0.001279 | 2.11 | 4.61 | 6.26 | **7.81** | 11.45 |
| tier2_c | Tyrrell 018 | Ford DFR V8 | 915 | 316 | 314 | 0.001353 | 2.11 | 4.64 | 6.35 | **8.04** | 13.06 |
| tier2_d | Brabham BT58 | Judd CV V8 | 915 | 322 | 320 | 0.001279 | 2.11 | 4.61 | 6.26 | **7.81** | 11.45 |
| tier3_a | Minardi M189 | Ford DFR V8 | 915 | 316 | 314 | 0.001353 | 2.11 | 4.64 | 6.35 | **8.04** | 13.06 |
| tier3_b | Ligier JS33 | Ford DFR V8 | 915 | 316 | 314 | 0.001353 | 2.11 | 4.64 | 6.35 | **8.04** | 13.06 |
| tier3_c | Dallara F189 | Ford DFR V8 | 915 | 316 | 314 | 0.001353 | 2.11 | 4.64 | 6.35 | **8.04** | 13.06 |
| tier3_d | Arrows A11 | Ford DFR V8 | 915 | 316 | 314 | 0.001353 | 2.11 | 4.64 | 6.35 | **8.04** | 13.06 |
| tier4_a | Rial ARC2 | Ford DFR V8 | 915 | 316 | 314 | 0.001353 | 2.11 | 4.64 | 6.35 | **8.04** | 13.06 |
| tier4_b | Coloni FC188B | Ford DFR V8 | 915 | 316 | 314 | 0.001353 | 2.11 | 4.64 | 6.35 | **8.04** | 13.06 |
| tier4_c | Onyx ORE-1 | Ford DFR V8 | 915 | 316 | 314 | 0.001353 | 2.11 | 4.64 | 6.35 | **8.04** | 13.06 |
| tier4_d | Zakspeed ZR891 | Yamaha OX88 V8 | 832 | 312 | 310 | 0.001278 | 2.11 | 4.61 | 6.37 | **8.34** | 16.68 |

## Notes

- **t280 is the Acceleration-stat metric** (0-280 km/h): the band where engine
  power actually differentiates cars (0-100 is identical for all; 0-310 blends
  into top speed).
- Engines with the same P/m and vmax produce identical times (Judd ×3, DFR ×9).
  Their gameplay differentiation comes from Brake/Grip/Stability/Efficiency
  stats, not engine data.
- vmax_th values are estimates [I] of real 1989 top speeds (engine + chassis
  aero); P/m values are from real engine power figures [C]. K = P/m / vmax^3
  is computed from the same vmax_th column (DFR: 915 / 87.78^3 = 0.001353).
- Practical top speed (vmax_pr) = theoretical − 2 km/h, the asymptote
  definition accepted by the user (2026-08-02). No car ever reaches vmax_th.
