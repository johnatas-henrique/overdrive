# Super Monaco GP — Team & Car Stats Reference

> **Source:** Super Monaco GP (Sega, 1989/1990) — Mega Drive/Genesis version
> **Purpose:** Baseline reference for Overdrive team differentiation and stat distribution
> **Created:** 2026-07-21

## Overview

Super Monaco GP has 16 teams organized in 4 competitive classes (A/B/C/D), with 1 car each. The player starts in Class D and earns promotions by outperforming rivals. Each car has 5 stats on a 0-20 scale, plus max horsepower that varies by transmission choice.

## Team Grid

### Class A (Top 4)

| ID | Name | Based On | ENG | TM | SUS | TIRE | BRA | Total | HP |
|----|------|----------|-----|-----|-----|------|-----|-------|----|
| tier1-a | Madonna | McLaren | 20 | 20 | 20 | 20 | 16 | 96 | 850 |
| tier1-b | Firenze | Ferrari | 16 | 20 | 20 | 18 | 20 | 94 | 850 |
| tier1-c | Millions | Williams | 20 | 16 | 18 | 16 | 20 | 90 | 820 |
| tier1-d | Bestowal | Benetton | 20 | 12 | 20 | 20 | 20 | 92 | 820 |

### Class B (Above Average)

| ID | Name | Based On | ENG | TM | SUS | TIRE | BRA | Total | HP |
|----|------|----------|-----|-----|-----|------|-----|-------|-----|
| tier2-a | Blanche | Brabham | 16 | 16 | 16 | 16 | 16 | 80 | 820 |
| tier2-b | Tyrant | Tyrrell | 12 | 20 | 12 | 16 | 20 | 80 | 850 |
| tier2-c | Losel | Lotus | 20 | 12 | 16 | 16 | 16 | 80 | 790 |
| tier2-d | May | March | 12 | 16 | 12 | 12 | 16 | 68 | 850 |

### Class C (Below Average)

| ID | Name | Based On | ENG | TM | SUS | TIRE | BRA | Total | HP |
|----|------|----------|-----|-----|-----|------|-----|-------|-----|
| tier3-a | Bullets | Arrows | 12 | 12 | 14 | 12 | 12 | 62 | 790 |
| tier3-b | Dardan | Dallara | 16 | 10 | 10 | 12 | 8 | 56 | 820 |
| tier3-c | Linden | Ligier | 16 | 8 | 16 | 16 | 16 | 72 | 760 |
| tier3-d | Minarae | Minardi | 16 | 12 | 8 | 10 | 8 | 54 | 790 |

### Class D (Bottom 4)

| ID | Name | Based On | ENG | TM | SUS | TIRE | BRA | Total | HP |
|----|------|----------|-----|-----|-----|------|-----|-------|-----|
| tier4-a | Rigel | Rial | 18 | 8 | 12 | 12 | 8 | 58 | 760 |
| tier4-b | Comet | Coloni | 16 | 8 | 12 | 8 | 8 | 52 | 730 |
| tier4-c | Orchis | Onyx | 12 | 8 | 8 | 12 | 8 | 48 | 790 |
| tier4-d | Zeroforce | Zakspeed | 16 | 8 | 12 | 12 | 4 | 52 | 730 |

## Stat Distribution Analysis

### Per-Class Averages

| Class | ENG | TM | SUS | TIRE | BRA | Total Avg |
|-------|-----|-----|-----|------|-----|-----------|
| A (Top 4) | 19.0 | 17.0 | 19.5 | 18.5 | 19.0 | 93.0 |
| B (Above Avg) | 15.0 | 15.0 | 14.0 | 14.0 | 17.0 | 76.5 |
| C (Below Avg) | 14.0 | 10.5 | 12.0 | 12.5 | 11.0 | 61.0 |
| D (Bottom 4) | 15.5 | 8.0 | 11.0 | 10.0 | 7.0 | 52.5 |

**Key observation:** Class A dominates every stat. Class D's BRA average (7.0) is less than half of Class A's (19.0) — braking is the primary differentiator between top and bottom. TM also drops sharply (17.0 → 8.0), meaning lower-class cars reach top speed much slower.

### Stat Ranges

| Stat | Min | Max | Range | Weakest Team | Strongest Team |
|------|-----|-----|-------|--------------|----------------|
| ENG | 12 | 20 | 8 | tier2-b, tier2-d, tier3-a (12) | tier1-a, tier1-c, tier1-d, tier2-c (20) |
| TM | 8 | 20 | 12 | tier3-c, tier4-a, tier4-b, tier4-c, tier4-d (8) | tier1-a, tier1-b (20) |
| SUS | 8 | 20 | 12 | tier3-d, tier4-c (8) | tier1-a, tier1-b, tier1-d (20) |
| TIRE | 8 | 20 | 12 | tier4-b, tier4-c (8) | tier1-a, tier1-d (20) |
| BRA | 4 | 20 | 16 | tier4-d (4) | tier1-b, tier1-c, tier1-d, tier2-b (20) |

**Key observation:** BRA has the widest range (16 points) — the gap between `tier4_d`'s BRA 4 and the BRA 20 teams is massive. TM, SUS, and TIRE all share a 12-point range. ENG has the narrowest range (8 points) — even the worst cars have decent engine power.

### Key Patterns

1. **Brake is the great separator.** BRA ranges from 4 to 20 (16-point spread). Every Class A team has BRA ≥ 16; every Class D team has BRA ≤ 8. Braking is the stat that most clearly signals "you are in a better car."

2. **Class A is nearly maxed.** Average total 93/100 — these cars leave almost no room for improvement. The differentiation within Class A comes from *which* stat is slightly lower (e.g., `tier1_a` trades BRA 16 for ENG 20).

3. **Class D has surprising ENG.** `tier4_a` has ENG 18 — better than some Class B teams. The weakness is everywhere else (TM 8, BRA 8). This creates the "fast in a straight line, terrible everywhere else" archetype.

4. **HP doesn't correlate with stats.** `tier2_b` has 850 HP (same as Class A leaders) but TM 12, BRA 20 — a high-power car with mediocre transmission. HP is illustrative, not a gameplay stat.

5. **Class overlap exists.** `tier3_c` (Total 72) outperforms `tier2_d` (Total 68). The tier structure is a general guide, not an absolute hierarchy — individual team profiles matter more than class labels.

6. **TM drops hardest across tiers.** Class A avg 17.0 → Class D avg 8.0 (53% drop). This is the stat that makes lower-class cars *feel* slow — they take longer to reach speed, even if their top speed is decent.

## Mapping to Overdrive Stats

| SMGP Stat | Overdrive Stat | Rationale |
|-----------|---------------|-----------|
| ENG (Engine) | Top Speed | Engine power → straight-line speed |
| TM (Transmission) | Acceleration | Transmission efficiency → how fast you reach top speed |
| BRA (Brakes) | Brake Power | Braking power → deceleration |
| TIRE (Tires) | Grip Level | Tire adhesion → cornering grip |
| SUS (Suspension) | Stability | Suspension → bump handling, planted feel, resistance to loss of control |
| — | Efficiency | New stat — not in SMGP; add for strategic depth (fuel + tire consumption) |
| — | Weight | Constant 505 kg for all cars — physics parameter, not a differentiating stat |

## Tier Gap Scaling (for Settings GDD)

Using SMGP totals as base:

| Difficulty | Multiplier | Effective Gap (Class D → Class A) |
|------------|-----------|-----------------------------------|
| Very Easy | 0.2 | ~8 points (52 → 60) |
| Easy | 0.6 | ~24 points (52 → 76) |
| Normal | 1.0 | ~40 points (52 → 92) |
| Hard | 1.6 | ~64 points (52 → 116 — capped at max) |
| Very Hard | 2.4 | ~96 points (full range) |

## Usage Notes

- This data is a **baseline reference**, not a direct copy. Overdrive's stats will be tuned for arcade feel.
- The tier structure (4 classes × 4 teams) maps directly to Overdrive's 16-team grid.
- HP values are illustrative — Overdrive doesn't use HP as a stat, but the relative power curve is useful.
- The player starts at tier4-d (Zeroforce) — worst BRA, competitive ENG/TM. Clear growth path.
