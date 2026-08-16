# Quick Design Spec: Track Suzuka Validation Reference

**Type**: Addition
**System**: Track System
**GDD Reference**: `design/gdd/track-system.md` — Detailed Design → Core Rules
**Date**: 2026-08-05

## Change Summary

Add a "9. Validation Reference Track" sub-section documenting Suzuka as the
canonical reference track for validating cornering feel, drift, and braking —
it covers every corner-radius type of the era's F1 calendar.

## Motivation

The race-feel prototype needs a test track with the widest corner-radius
variety. Suzuka (1989-91 F1 calendar) is the only circuit of the era that
spans every radius type: S Curves (200-260 km/h esses), Degner 1/2, Hairpin
(<70 km/h, ~10-15 m radius), Spoon (double-apex 180°), 130R (130 m flat-out),
and Casio Chicane.

## Design Delta

Insert after sub-section 8 (Track Scaling), before "### States and
Transitions" in `design/gdd/track-system.md`:

> **9. Validation Reference Track**
>
> Suzuka (1989-91 F1 calendar) is the canonical reference track for validating
> cornering feel, drift, and braking — it covers every corner-radius type:
> S Curves (200-260 km/h esses), Degner 1/2, Hairpin (<70 km/h, ~10-15 m
> radius), Spoon (double-apex 180°), 130R (130 m flat-out), and Casio Chicane.
> No other circuit of the era spans that radius range. When a track with the
> widest corner-radius variety is needed for feel validation, use Suzuka
> (race-feel prototype reference, 2026-08-03).

## New Rules / Values

Sub-section 9 above — a validation note. Does not change the MVP track set
(Monaco, Silverstone, Spa, Monza) or the track data format (sub-section 1).

## Affected Systems

| System | Impact | Action Required |
|--------|--------|-----------------|
| Track System | New validation-reference sub-section | Update GDD (track-system.md) |

## Acceptance Criteria

- [ ] Suzuka documented as the validation reference track
- [ ] No change to the MVP track set or track data format
- [ ] No conflict with the track data format sub-section

## GDD Update Required?

Yes — `design/gdd/track-system.md`, Core Rules → sub-section 9 (exact text in
Design Delta above).
