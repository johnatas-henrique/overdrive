# Tech Debt Register

| Status | Date       | Story              | Description                                                                                           | File                                         | Severity | Resolved In |
| ------ | ---------- | ------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------- | ----------- |
| ✅     | 2026-06-29 | SP2/input/ST1      | DSM import path corrected to `InputDevices/deviceSourceManager` (Babylon.js 9.x). Story AC-4 spec path `DeviceInput/deviceSourceManager` doesn't resolve. Update story AC-4 text or engine reference docs. | src/core/input/IInput.ts                    | S        | SP2/input/ST3 |
| 🔴     | 2026-06-29 | SP2/input/ST2      | File naming conventions: deadZone.ts → dead-zone.ts (kebab-case). Test moved from tests/unit/input/ to tests/unit/core/input/ (mirror src/ structure). Update story Test Evidence paths. | src/core/input/dead-zone.ts, tests/unit/core/input/dead-zone.test.ts | S | |
| 🔴     | 2026-06-29 | SP2/input/ST3      | JSDoc completeness: add @param/@returns tags to setHidden(), setTransitionBlocking(), setDeadZoneThreshold(), getLastActiveDevice(). Non-blocking per lead-programmer review (S-1). | src/core/input/player-input.ts | S | |
