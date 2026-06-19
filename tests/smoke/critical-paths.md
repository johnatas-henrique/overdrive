# Smoke Test: Critical Paths

**Purpose**: Run these checks in under 15 minutes before any QA hand-off.
**Run via**: `/smoke-check` (which reads this file)
**Update**: Add new entries when new core systems are implemented.

## Core Stability (always run)

1. Game launches to main menu without crash
2. Single Race can be started from the main menu
3. Race simulation runs at 60 fps on target hardware

## Core Mechanic (update per sprint)

4. [Primary mechanic — update when first core system is implemented]

## Data Integrity

5. Save game completes without error (once persistence is implemented)
6. Load game restores correct state

## Performance

7. No visible frame rate drops on target hardware
8. No memory growth over 5 minutes of play
