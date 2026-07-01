# Story 001: Engine Init & Context Unlock

> **Epic**: Audio
> **Status**: Ready
> **Layer**: Presentation
> **Type**: Integration
> **Manifest Version**: 2026-06-21
> **Estimate**: 5h

## Context

**GDD**: `design/gdd/audio.md`
**Requirement**: `TR-AUDIO-001` — CreateAudioEngineAsync initialises the engine; try/catch on failure silences gracefully. `TR-AUDIO-010` — Context unlock on first user interaction.

**ADR Governing Implementation**: ADR-0020: Audio Engine
**ADR Decision Summary**: `CreateAudioEngineAsync({ resumeOnInteraction: true })` initialises the engine at creation time. Context unlock is automatic on first interaction — no custom prompt needed. `unlockAsync()` available for programmatic unlock.

**Engine**: Babylon.js 9.12.0 | **Risk**: HIGH
**Engine Notes**: `resumeOnInteraction` is a creation-time option on `CreateAudioEngineAsync`. Default is `true`. `unlockAsync()` method exists for later programmatic unlock. Audio Engine V2 initialisation may fail on unsupported browsers — try/catch must allow game to continue silently.

**Control Manifest Rules (this layer)**:

- Required: P13 (Audio Engine V2 ONLY)
- Forbidden: P-F1 (Never use legacy `Sound` class)

---

## Acceptance Criteria

_From GDD `design/gdd/audio.md`:_

- [ ] AC #14: Audio context unlocks on first user interaction (click/keypress) — no custom prompt
- [ ] `CreateAudioEngineAsync({ resumeOnInterestion: true })` resolves successfully — `audioEngine.audioContext` exists
- [ ] If `CreateAudioEngineAsync` rejects, `AudioManager.audioEngine` is `null`, no other system crashes, and game state progresses without audio
- [ ] Calling `AudioManager.init()` twice does not create a second AudioEngine — second call is idempotent (no-op)
- [ ] Calling `sound.play()` while AudioContext is suspended queues the play action — it executes once `unlockAsync()` resolves
- [ ] GSM subscription: `AudioManager.init()` is called during `gsm.state.entered(to: Loading)`

---

## Implementation Notes

_Derived from ADR-0020 Implementation Guidelines:_

```typescript
import { CreateAudioEngineAsync } from "@babylonjs/core/AudioV2/audioEngineV2";

export class AudioManager {
  private _audioEngine: AudioEngineV2 | null = null;
  private _initialized = false;

  async init(): Promise<void> {
    if (this._initialized) return; // idempotent
    try {
      this._audioEngine = await CreateAudioEngineAsync({
        resumeOnInteraction: true, // default, but explicit for clarity
      });
      this._initialized = true;
    } catch (e) {
      console.warn("[Audio] Engine init failed — audio disabled:", e);
      this._audioEngine = null;
      this._initialized = true; // mark as initialized (to disabled state)
    }
  }

  async unlock(): Promise<void> {
    if (this._audioEngine) {
      await this._audioEngine.unlockAsync();
    }
  }

  get isAvailable(): boolean {
    return this._audioEngine !== null;
  }

  get engine(): AudioEngineV2 | null {
    return this._audioEngine;
  }
}
```

- Subscribe to `gsm.state.entered` with payload filtering for `to: "Loading"`
- When `CreateAudioEngineAsync` fails, all downstream `AudioBus`/`CreateSoundAsync` calls must be guarded — audio is effectively disabled
- The GSM subscription pattern: `eventBus.on('gsm.state.entered', handler)` returns `Subscription` — save for cleanup
- Do NOT create AudioBuses here — that's Story 009

---

## Out of Scope

- AudioBus creation (Story 009)
- Loading actual sound samples (Story 003a)
- Custom unmute button — Audio Engine V2's built-in `#babylonUnmuteButton` handles this

---

## QA Test Cases

- **AC-1**: Audio context unlocks on user interaction
  - Given: AudioEngine is initialized with `{ resumeOnInteraction: true }`
  - When: User performs first click/tap on the page
  - Then: `audioEngine.audioContext.state` transitions from `'suspended'` to `'running'`
  - Edge cases: Unlock via keyboard (Enter/Space) also works; rapid repeated clicks don't cause errors

- **AC-2**: Graceful failure when engine init fails
  - Given: Browser is unsupported or AudioContext creation throws
  - When: `CreateAudioEngineAsync` rejects
  - Then: `AudioManager.audioEngine` is `null`, `AudioManager.isAvailable` returns `false`, game continues without crashing
  - Edge cases: Downstream `CreateSoundAsync` calls are guarded (no null reference errors)

- **AC-3**: Double init is idempotent
  - Given: `AudioManager.init()` has completed
  - When: `AudioManager.init()` is called again
  - Then: No second `CreateAudioEngineAsync` is called; engine reference unchanged
  - Edge cases: Second call during async init (while first is still resolving) — guard via in-progress flag

- **AC-4**: Sound play while suspended queues correctly
  - Given: AudioEngine is initialised but context is still `'suspended'`
  - When: `sound.play()` is called
  - Then: The play action is queued and executes once context resumes
  - Edge cases: Context never resumes → queued play never executes (no crash)

---

## Test Evidence

**Story Type**: Integration
**Required evidence**: `tests/integration/audio/audio-engine-init.test.ts` — must exist and pass.

**Status**: [ ] Not yet created

---

## Dependencies

- Depends on: Story 000 (spike must validate API first)
- Unlocks: Story 009
