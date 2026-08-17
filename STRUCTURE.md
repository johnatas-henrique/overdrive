# Codebase Structure

## Directory Layout

```text
/
├── AGENTS.md                    # Master framework configuration and reference
├── opencode.json                # OpenCode config (plugins, MCP servers, permissions)
├── overdrive.slnx               # Unity solution file
├── cog.toml                     # Cocogitto conventional commit config
├── Assembly-CSharp.csproj       # Unity C# project (auto-generated)
├── Assembly-CSharp-Editor.csproj# Unity Editor C# project (auto-generated)
├── README.md                    # Project overview and quick start guide
├── LICENSE                      # MIT license
├── CONTEXT.md                   # Domain glossary — ubiquitous language for simulation, input, vehicle, race, content
├── .agents/                     # Primary agent/skill/command/rule definitions (tracked source of truth)
│   ├── agents/                  # Agent definitions (51 agents)
│   ├── commands/                # Slash command routing (54 commands)
│   ├── rules/                   # Path-scoped coding rules (11 rules)
│   └── skills/                  # Skill workflows (158 skills)
├── .cortexkit/                  # CortexKit runtime configuration
├── .mcp.json                   # MCP server connection config (CortexKit)
├── .opencode/                   # OpenCode-specific configuration and runtime
│   ├── plugins/                 # TypeScript plugins (ccgs-hooks, drift-detector, changelog-generator)
│   │   ├── ccgs-hooks.ts        # Branch protection, design validation, source checks
│   │   ├── drift-detector.ts    # Agent/skill template drift detection
│   │   ├── changelog-generator.ts # Conventional commit → CHANGELOG.md
│   │   ├── README.md            # Plugin architecture guide
│   │   └── tests/               # Plugin unit tests (11 test suites)
│   ├── agents/                  # Junction → .agents/agents/ (not tracked)
│   ├── commands/                # Junction → .agents/commands/ (not tracked)
│   ├── rules/                   # Junction → .agents/rules/ (not tracked)
│   └── skills/                  # Junction → .agents/skills/ (not tracked)
├── .pi/                         # CortexKit PI runtime — extensions, MCP config, settings
│   ├── extensions/              # 8 OCGS extension modules (audit, changelog, core, delegation, drift-detector, path-guard, question, validate)
│   ├── mcp.json                 # MCP server connections
│   └── settings.json            # Runtime settings
├── Assets/                      # Unity project assets
│   ├── Scenes/                  # Unity scenes
│   ├── source/                  # Game C# source code — Overdrive.Input, Overdrive.Simulation, Overdrive.Content, and settings assemblies
│   │   ├── Overdrive.Input.asmdef # Input assembly definition
│   │   ├── InputContextController.cs # Action-map context controller (partial class)
│   │   ├── InputContextController.Contexts.cs # Context switching and UI pointer policy (partial)
│   │   ├── InputContextController.Latches.cs # Action latches, counters, and event handlers (partial)
│   │   ├── InputContextController.Scheme.cs # Scheme selection and routing (partial)
│   │   ├── DeadZoneNormalizer.cs # Pure dead-zone normalization
│   │   ├── EmaBrakePriority.cs   # EMA brake-priority processor
│   │   ├── ControlProfile.cs      # Control profile definition
│   │   ├── TickProcessor.cs       # Tick-based input processor
│   │   ├── InputFrameCapture.cs   # Production capture adapter (IFrameInputCapture)
│   │   ├── InputBindingCatalog.cs  # Input binding catalog
│   │   ├── EmaReinitializerBase.cs # Base class for EMA reinitializers
│   │   ├── ContextResumeEmaReinitializer.cs # Context-resume EMA reinitializer
│   │   ├── SchemeChangeEmaReinitializer.cs # Scheme-change EMA reinitializer
│   │   ├── SettingsInputPreviewEvaluator.cs # Settings input preview evaluator
│   │   ├── InputSystem_Actions.cs # Generated input action wrapper
│   │   ├── InputSystem_Actions.Extensions.cs # Generated action extensions
│   │   ├── InputSystem_Actions.inputactions # Unity Input System action maps
│   │   ├── InputSystemSettings.asset # Input system settings ScriptableObject
│   │   ├── Editor/               # Editor-only bootstrapper (Overdrive.Input.Editor assembly)
│   │   │   ├── Overdrive.Input.Editor.asmdef # Editor assembly (platform: Editor only)
│   │   │   └── InputAssetBootstrap.cs # Rebuilds input asset, wrapper, and settings singleton from GDD bindings
│   │   ├── Simulation/            # Engine-free simulation kernel (Overdrive.Simulation assembly)
│   │   │   ├── Overdrive.Simulation.asmdef # Simulation assembly (noEngineReferences: true)
│   │   │   ├── SimulationContracts.cs # Contract spine types (CarState, FuelState, TireState, GridAssignment, pipeline types)
│   │   │   ├── SimulationKernel.cs # 14-step invocation spine, state gate, pipeline steps
│   │   │   ├── SimulationStateMachine.cs # Authoritative session lifecycle (Idle→Loading→Countdown→Racing→Paused→Finished→Results)
│   │   │   ├── SimulationDriver.cs # Manual fixed-step accumulator driver with ghost recording delegated to GhostRecorderLifecycle
│   │   │   ├── SimulationInput.cs # Simulation input struct (immutable per-tick input value)
│   │   │   ├── RawInputSample.cs  # Immutable raw input capture struct
│   │   │   ├── GhostRecorderLifecycle.cs # Ghost-recorder and GO-boundary replay-capture lifecycle (ADR-0008)
│   │   │   ├── RenderInterpolator.cs # Pure render interpolation math (lerp position, slerp rotation)
│   │   │   ├── PerformanceMonitor.cs # FPS protection monitor (3-timer system: below-30, below-15, recovery)
│   │   │   ├── Pcg32.cs           # Deterministic PRNG (PCG-XSH-RR, 64-bit state)
│   │   │   ├── GhostBuffer.cs     # Ghost recording buffer and edge event flags
│   │   │   └── DeterminismHarness.cs # Determinism replay pair runner
│   │   ├── Simulation.Unity/        # Unity lifecycle adapters for simulation (Overdrive.Simulation.Unity assembly)
│   │   │   ├── Overdrive.Simulation.Unity.asmdef # Simulation Unity adapters assembly (refs: Overdrive.Simulation)
│   │   │   └── SimulationDriverAdapters.cs # UnityFrameDeltaSource, UnityPhysicsSimulator, SimulationDriverBehaviour
│   │   ├── Multiplayer/
│   │   │   ├── Overdrive.Multiplayer.asmdef # Multiplayer assembly (noEngineReferences: true)
│   │   │   ├── INetworkSimulationDriver.cs # ADR-0017 D2 seam (SubmitInputs, SerializeSnapshot, Rollback, GetPredictedInput)
│   │   │   ├── NetworkInput.cs    # MVP placeholder struct for remote player input
│   │   │   └── SimulationRollbackState.cs # Corrective kinematic state (Vector3Array16/QuaternionArray16 wrappers)
│   │   ├── Content/               # Engine-free content pipeline core (Overdrive.Content assembly)
│   │   │   ├── Overdrive.Content.asmdef # Content core assembly (noEngineReferences: true, depends: Overdrive.Simulation, Overdrive.Settings.Core)
│   │   │   ├── ContentContracts.cs # ContentPipelineState enum (CP_ prefix), RaceContentSelection, ContentResourceState
│   │   │   ├── ContentSeams.cs    # Injectable ports (IContentSelectionSource, IContentLoadSeam, IContentCleanupSeam, IContentReleaser, IReadinessForwarder, ICatalogInitializer, ISharedLoader, IFatalErrorHandler, IFocusSeam)
│   │   │   ├── ContentStateMachine.cs # Authoritative lifecycle (Idle→LoadingTrack→LoadingCars→Ready→Racing→RaceReconfigure→Unloading)
│   │   │   ├── LoadingScreenContracts.cs # ILoadingScreenPresenter — fire-and-forget loading screen presentation port
│   │   │   ├── LoadingScreenController.cs # Engine-free lifecycle controller (minimum-display, monotonic progress, first-launch "Preparing...", terminal exactly-once)
│   │   │   ├── QualityProfileContracts.cs # IQualityProfileSource, IQualityOverrideSource, ITextureMipmapApplier — quality pipeline seams bridging Settings→Content
│   │   │   ├── MipmapLimitResolver.cs # Pure preset→mipmap-limit table (Low→2, Medium→1, High/Ultra→0, Custom→Medium fallback)
│   │   │   ├── RaceLoadOrchestrator.cs # Parallel 17-handle load, byte-derived progress, memory policy enforcement
│   │   │   ├── RaceLoadContracts.cs # Engine-free load seams (IAddressableLoader, IAsyncLoadHandle, IContentInstantiator, IMemoryPressureSource, IRaceContentRuntime, IRaceContentAccumulator, IContentLoadReporter)
│   │   │   ├── RaceCleanupSeam.cs # Concrete IContentCleanupSeam — delegates release, echoes cleanup ID
│   │   │   ├── AddressableKeys.cs # Addressable key constants and builders (CarDefinition, TrackData, SharedBootstrap)
│   │   │   ├── ContentTopologyData.cs # JSON-deserializable topology manifest (groups, root addresses, allowed types/paths)
│   │   │   ├── StartupOrchestrator.cs # App-startup sequence (catalog init with retry, Shared group retention, focus-aware)
│   │   │   ├── Editor/            # Editor-only content tooling (Overdrive.Content.Editor assembly)
│   │   │   │   ├── Overdrive.Content.Editor.asmdef # Editor assembly (platform: Editor only; refs: Unity.Addressables.Editor, Overdrive.Content)
│   │   │   │   ├── ContentTopologyValidator.cs # Validates Addressable settings against topology manifest
│   │   │   │   └── AddressAssignmentTool.cs # Idempotent root-address assignment mirroring group names
│   │   │   └── Unity/             # Unity-backed content runtime (Overdrive.Content.Unity assembly)
│   │   │       ├── Overdrive.Content.Unity.asmdef # Unity runtime assembly (refs: Overdrive.Content, Overdrive.Simulation, Overdrive.Settings.Core, Unity.Addressables, Unity.ResourceManager)
│   │   │       ├── UnityContentRuntime.cs # Concrete IRaceContentRuntime + IRaceContentAccumulator
│   │   │       ├── ContentCompositionRoot.cs # Wires ContentStateMachine with late-bound seams
│   │   │       ├── AddressableLoadHandle.cs # IAddressableLoader / IAsyncLoadHandle over Addressables API
│   │   │       ├── ContentInstantiator.cs # IContentInstantiator over Object.Instantiate/Destroy
│   │   │       ├── RuntimeSources.cs # Unity-backed seams (MemoryPressureSource, DiagnosticsSink, ClockSource, QualityReductionRequest)
│   │   │       ├── StartupSources.cs # CatalogInitializer, SharedLoader, FatalErrorHandler, FocusChangeSource
│   │   │       └── UnityTextureMipmapApplier.cs # ITextureMipmapApplier — writes QualitySettings.globalTextureMipmapLimit
│   │   ├── Settings/              # Unity-facing settings adapters (Overdrive.Settings assembly)
│   │   │   ├── Overdrive.Settings.asmdef # Settings Unity adapter assembly (refs: Settings.Core, Input, Simulation, Content)
│   │   │   ├── SettingsLoader.cs  # Wires engine-free core to Unity surfaces (maps ControlsData→ControlProfile)
│   │   │   ├── SettingsLifecycleContext.cs # Maps SimulationState to settings lifecycle queries
│   │   │   ├── PlayerPrefsStore.cs # Implements IPlayerPrefsStore over UnityEngine.PlayerPrefs
│   │   │   ├── DifficultyProfileCatalog.cs # ScriptableObject-backed IDifficultyProfileCatalog (5 tier assets → DifficultyProfile structs)
│   │   │   ├── DifficultyProfileData.cs # ScriptableObject holding one immutable difficulty row (level, AI precision, AI error multiplier, pace noise, off-track grip, wall speed loss)
│   │   │   ├── SettingsDifficultyProvider.cs # Decorator: reads persisted difficulty tier, resolves profile, fills ReplayInitialStateCaptureInput for GO-boundary replay
│   │   │   ├── RebindCaptureAdapter.cs # Unity adapter implementing IRebindCapture over InputBindingCatalog (validates, applies, observes Cancel)
│   │   │   ├── SchemeProbeAdapter.cs # Read-only ISchemeProbe backed by InputContextController.ActiveScheme
│   │   │   ├── SettingsBindingMapper.cs # Applies persisted binding overrides against Input catalog at load time (unknown id, malformed path, duplicate classification)
│   │   │   ├── DisplayContracts.cs # Unity-side display types (DisplayState, IDisplayApi, IDisplayConfirmControl, IQualityPresetApplier, IFocusChangeSource)
│   │   │   ├── DisplayConfirmGate.cs # 15-second unscaled confirmation timer with baseline/restore and focus-loss rollback
│   │   │   ├── ScreenDisplayApi.cs # Real Unity display surface adapter (Screen.resolutions, SetResolution, fullScreenMode)
│   │   │   ├── DisplaySettingsOrchestrator.cs # UI-facing facade composing the display/quality flow
│   │   │   ├── DisplayStateResolver.cs # Pure deterministic nearest-supported resolution matching
│   │   │   ├── QualityPresetApplier.cs # URP render pipeline asset adapter (render scale and MSAA per preset)
│   │   │   ├── SettingsQualityProfileSource.cs # IQualityProfileSource adapter — reads applied preset from QualityPresetApplier
│   │   │   ├── SettingsQualityOverrideSource.cs # IQualityOverrideSource adapter — translates PerformanceMonitor reduced/restored signals
│   │   │   └── FocusChangeSource.cs # Unity Application.focusChanged adapter
│   │   ├── Settings.Core/         # Engine-free settings persistence core (Overdrive.Settings.Core assembly)
│   │   │   ├── Overdrive.Settings.Core.asmdef # Settings core assembly (noEngineReferences: true; referenced by Overdrive.Content, Overdrive.Content.Unity)
│   │   │   ├── SettingsData.cs    # GameSettingsData blob model (difficulty, controls, audio, display, accessibility, camera)
│   │   │   ├── SettingsEditSession.cs # Transactional preview session (Snapshot/Working, display-confirm gate)
│   │   │   ├── SettingsBlobService.cs # Load cascade (primary→backup→defaults) and backup-first save
│   │   │   ├── SettingsPersistence.cs # Core read/write over IPlayerPrefsStore seam
│   │   │   ├── SettingsMigration.cs # Sequential schema migration (v1→v2→v3)
│   │   │   ├── SettingsValidator.cs # Per-field validation (non-finite → default)
│   │   │   ├── SettingsJsonCodec.cs # JSON serialize/deserialize for settings blob
│   │   │   ├── SettingsBindings.cs # Binding override de-duplication
│   │   │   ├── ControlBindingContracts.cs # Engine-free ControlScheme enum, ControlBindingState, CaptureResult/ConflictDetail/BindingTarget types
│   │   │   ├── ControlBindingStateMachine.cs # Engine-free rebinding state machine (Open→Listening→Captured/Rejected/Conflict; transactional working override-set)
│   │   │   ├── DifficultyProfileValidation.cs # Centralized difficulty tier range guard (shared by catalog and edit session)
│   │   │   ├── IDifficultyProfileCatalog.cs # Engine-free port resolving tier identifier to DifficultyProfile row
│   │   │   ├── QualityPresets.cs  # Engine-free QualityPresetId and VfxDensityLevel enums
│   │   │   ├── ValueContracts.cs  # Typed value types (AudioSettingsUpdate, AccessibilityUpdate, VfxSettingsUpdate, PaletteCue, ColorblindMode)
│   │   │   ├── ValuePorts.cs      # Typed value ports (AudioSettingsPort, AccessibilitySettingsPort, VfxSettingsPort)
│   │   │   ├── SettingsSessionContracts.cs # Enums and seams (SettingsCategory, ApplyResult, IDisplayConfirmGate, ISettingsLifecycleContext)
│   │   │   ├── SettingsJson.cs    # JSON element types for settings codec
│   │   │   ├── IPlayerPrefsStore.cs # Persistence seam between core and platform store
│   │   │   ├── ISettingsPersistence.cs # Settings persistence interface
│   │   │   ├── SaveResult.cs      # Save outcome enum
│   │   │   └── BindingOverrideData.cs # Binding override data model
│   │   ├── unit/                # Unit tests (actual files in Assets/tests/unit/)
│   │   │   ├── input/           # Input system unit tests (InputUnitTests.asmdef)
│   │   │   │   ├── EmaBrakePriorityTests.cs
│   │   │   │   └── SchemeArbitrationTests.cs
│   │   │   ├── simulation/      # Simulation unit tests (SimulationUnitTests.asmdef)
│   │   │   │   ├── SimulationDriverTests.cs
│   │   │   │   ├── SessionStartTests.cs
│   │   │   │   ├── InterruptionTests.cs
│   │   │   │   ├── InterpolationTests.cs
│   │   │   │   ├── PerformanceMonitorTests.cs
│   │   │   │   ├── DeterminismReplayTests.cs
│   │   │   │   ├── KernelIdentityTests.cs # ICanonicalSpineStep slot identity validation
│   │   │   │   └── TestSteps.cs
│   │   │   ├── multiplayer/     # Multiplayer unit tests (MultiplayerUnitTests.asmdef)
│   │   │   │   └── MultiplayerIsolationTests.cs
│   │   │   ├── content/         # Content pipeline unit tests (ContentUnitTests.asmdef, RaceLoadUnitTests.asmdef)
│   │   │   │   ├── ContentStateMachineTests.cs
│   │   │   │   ├── RaceUnloadTests.cs
│   │   │   │   ├── StartupErrorTests.cs
│   │   │   │   ├── LoadingScreenControllerTests.cs # Loading screen lifecycle controller tests
│   │   │   │   └── raceload/    # Race load unit tests
│   │   │   │       └── RaceLoadTests.cs
│   │   │   └── settings/        # Settings unit tests (SettingsUnitTests.asmdef)
│   │   │       ├── ControlBindingTests.cs
│   │   │       ├── DifficultyProfileTests.cs
│   │   │       ├── DisplaySettingsTests.cs
│   │   │       ├── SettingsEditSessionTests.cs
│   │   │       ├── SettingsPersistenceTests.cs
│   │   │       └── SettingsValuesContractTests.cs
│   │   └── integration/         # Integration tests (actual files in Assets/tests/integration/)
│   │       ├── input/           # Input system integration tests (InputIntegrationTests.asmdef)
│   │       │   ├── InputContextControllerTests.cs
│   │       │   ├── InputFrameCaptureTests.cs
│   │       │   ├── RawCaptureDeadZoneTests.cs
│   │       │   ├── ContextTransitionsTests.cs
│   │       │   ├── SettingsConfigurationTests.cs
│   │       │   ├── SpecialRoutingTests.cs
│   │       │   └── TickProcessorTests.cs
│   │       ├── simulation/      # Simulation integration tests (SimulationIntegrationTests.asmdef)
│   │       │   ├── ContractSpineTests.cs
│   │       │   ├── SessionEndTests.cs
│   │       │   └── TestSteps.cs
│   │       ├── content/         # Content pipeline integration tests (ContentIntegrationTests.asmdef)
│   │       │   ├── RaceLoadIntegrationTests.cs
│   │       │   ├── RaceUnloadIntegrationTests.cs
│   │       │   ├── StartupErrorIntegrationTests.cs
│   │       │   └── QualityProfileIntegrationTests.cs # Quality profile and mipmap pipeline integration tests
│   │       └── settings/        # Settings integration tests (SettingsIntegrationTests.asmdef)
│   │           ├── ControlBindingIntegrationTests.cs
│   │           ├── DifficultyProfileIntegrationTests.cs
│   │           ├── DisplaySettingsIntegrationTests.cs
│   │           ├── SettingsLifecycleTests.cs
│   │           ├── SettingsPersistenceIntegrationTests.cs
│   │           └── SettingsRuntimeIntegrationTests.cs
│   ├── sprites/                 # Game sprites (currently empty — .gitkeep)
│   ├── Settings/                # URP render pipeline assets (Mobile, PC profiles)
│   │   └── Content/             # Content pipeline topology manifest
│   │       └── topology.json    # Addressable group topology (21 groups: Shared + 16 Cars + 4 Tracks)
│   ├── tests/                    # Unity test assemblies (EditMode, PlayMode)
│   │   ├── unit/                # Unit tests
│   │   │   ├── input/           # Input system unit tests (InputUnitTests.asmdef)
│   │   │   │   ├── EmaBrakePriorityTests.cs
│   │   │   │   └── SchemeArbitrationTests.cs
│   │   │   ├── simulation/      # Simulation unit tests (SimulationUnitTests.asmdef)
│   │   │   │   ├── SimulationDriverTests.cs
│   │   │   │   ├── SessionStartTests.cs
│   │   │   │   ├── InterruptionTests.cs
│   │   │   │   ├── InterpolationTests.cs
│   │   │   │   ├── PerformanceMonitorTests.cs
│   │   │   │   └── DeterminismReplayTests.cs
│   │   │   ├── multiplayer/     # Multiplayer unit tests (MultiplayerUnitTests.asmdef)
│   │   │   │   └── MultiplayerIsolationTests.cs
│   │   │   ├── content/         # Content pipeline unit tests
│   │   │   │   ├── ContentUnitTests.asmdef # State machine unit tests (refs: Overdrive.Content, Overdrive.Simulation)
│   │   │   │   ├── ContentStateMachineTests.cs
│   │   │   │   ├── RaceUnloadTests.cs
│   │   │   │   ├── StartupErrorTests.cs
│   │   │   │   └── raceload/     # Race load unit tests
│   │   │   │       ├── RaceLoadUnitTests.asmdef # (refs: Overdrive.Content, Overdrive.Simulation)
│   │   │   │       └── RaceLoadTests.cs
│   │   │   └── settings/        # Settings unit tests (SettingsUnitTests.asmdef)
│   │   │       ├── ControlBindingTests.cs
│   │   │       ├── DifficultyProfileTests.cs
│   │   │       ├── DisplaySettingsTests.cs
│   │   │       ├── SettingsEditSessionTests.cs
│   │   │       ├── SettingsPersistenceTests.cs
│   │   │       └── SettingsValuesContractTests.cs
│   │   ├── integration/         # Integration tests
│   │   │   ├── input/           # Input system integration tests (InputIntegrationTests.asmdef)
│   │   │   │   ├── InputContextControllerTests.cs
│   │       │   │   ├── InputFrameCaptureTests.cs
│   │   │   │   ├── RawCaptureDeadZoneTests.cs
│   │   │   │   ├── ContextTransitionsTests.cs
│   │   │   │   ├── SettingsConfigurationTests.cs
│   │   │   │   ├── SpecialRoutingTests.cs
│   │   │   │   └── TickProcessorTests.cs
│   │   │   ├── simulation/      # Simulation integration tests (SimulationIntegrationTests.asmdef)
│   │   │   │   ├── ContractSpineTests.cs
│   │   │   │   ├── SessionEndTests.cs
│   │   │   │   └── TestSteps.cs
│   │   │   ├── content/         # Content pipeline integration tests
│   │   │   │   ├── ContentIntegrationTests.asmdef # (refs: Overdrive.Content, Overdrive.Content.Unity, Overdrive.Simulation)
│   │   │   │   ├── RaceLoadIntegrationTests.cs
│   │   │   │   ├── RaceUnloadIntegrationTests.cs
│   │   │   │   └── StartupErrorIntegrationTests.cs
│   │   │   └── settings/        # Settings integration tests (SettingsIntegrationTests.asmdef)
│   │   │       ├── ControlBindingIntegrationTests.cs
│   │   │       ├── DifficultyProfileIntegrationTests.cs
│   │   │       ├── DisplaySettingsIntegrationTests.cs
│   │   │       ├── SettingsLifecycleTests.cs
│   │   │       ├── SettingsPersistenceIntegrationTests.cs
│   │   │       └── SettingsRuntimeIntegrationTests.cs
│   │   ├── editor/              # Editor-only tests
│   │   │   └── content/         # Content topology editor tests
│   │   │       ├── ContentTopologyTests.asmdef # (refs: Overdrive.Content.Editor, Overdrive.Content, Unity.Addressables.Editor)
│   │   │       └── ContentTopologyTests.cs
│   │   └── content/             # Test fixture assets (committed topology, car/track/shared)
│   │       └── Fixtures/
│   │           ├── Cars/         # Car definition fixtures (teamA, teamB, teamC)
│   │           ├── Tracks/       # Track data fixtures (monaco)
│   │           ├── Shared/       # Shared fixtures (prefabs, textures, audio, shader)
│   │           └── Scripts/       # Test fixture MonoBehaviours (CarFixtureData, TrackFixtureData)
│   ├── assets/                  # Learning system assets (stylesheets)
│   ├── learning-records/        # Style conformance records
│   ├── lessons/                 # Generated lesson HTML files
│   └── reference/               # Reference images and palette analysis
├── design/                      # Game design documents
│   ├── AGENTS.md                # Design directory standards
│   ├── accessibility-requirements.md # Accessibility requirements (Standard tier)
│   ├── art/                     # Art bible, palettes, reference catalogs, prompts
│   │   ├── art-bible.md         # Art bible (core export)
│   │   ├── palette.css          # Color palette (CSS)
│   │   ├── palette.json         # Color palette (JSON)
│   │   ├── prompts/             # AI generation prompts
│   │   │   ├── character-dardan-driver.md
│   │   │   ├── character-may-driver-and-mechanic.md
│   │   │   ├── character-millions-grid-girl.md
│   │   │   ├── character-seimec-mechanic.md
│   │   │   ├── character-tyrant-mechanic.md
│   │   │   ├── character-zeroforce-grid-girl.md
│   │   │   ├── krea2-prompt-book.md
│   │   │   └── test-kit-01.md
│   │   ├── reference-catalog.md # Reference image catalog
│   │   ├── reference/           # Reference images and generated assets
│   │   ├── style-anchor-prompt.md # Style anchor prompt
│   │   └── typography.json      # Typography specs
│   ├── gdd/                     # Game Design Documents (one per system)
│   │   ├── game-concept.md      # Core identity, pitch, and creative brief
│   │   ├── reviews/             # Design review logs
│   │   │   ├── ai-rival-review-log.md
│   │   │   ├── audio-system-review-log.md
│   │   │   ├── camera-review-log.md
│   │   │   ├── car-definition-data-review-log.md
│   │   │   ├── content-pipeline-review-log.md
│   │   │   ├── fuel-system-review-log.md
│   │   │   ├── game-concept-review-log.md
│   │   │   ├── ghost-recording-review-log.md
│   │   │   ├── grid-start-review-log.md
│   │   │   ├── hud-review-log.md
│   │   │   ├── input-system-review-log.md
│   │   │   ├── multiplayer-architecture-review-log.md
│   │   │   ├── pit-stop-review-log.md
│   │   │   ├── qualifying-review-log.md
│   │   │   ├── race-session-manager-review-log.md
│   │   │   ├── settings-review-log.md
│   │   │   ├── simulation-architecture-review-log.md
│   │   │   ├── tire-system-review-log.md
│   │   │   ├── track-system-review-log.md
│   │   │   ├── ui-menu-review-log.md
│   │   │   ├── vehicle-physics-review-log.md
│   │   │   └── vfx-review-log.md
│   │   ├── ai-rival.md
│   │   ├── audio-system.md
│   │   ├── camera.md
│   │   ├── car-definition-data.md
│   │   ├── content-pipeline.md
│   │   ├── fuel-system.md
│   │   ├── gdd-cross-review-2026-07-25.md
│   │   ├── gdd-cross-review-2026-07-26.md
│   │   ├── gdd-cross-review-2026-07-26-v2.md
│   │   ├── gdd-cross-review-2026-07-26-v3.md
│   │   ├── gdd-cross-review-2026-08-01.md
│   │   ├── ghost-recording.md
│   │   ├── grid-start.md
│   │   ├── hud.md
│   │   ├── input-system.md
│   │   ├── multiplayer-architecture.md
│   │   ├── pit-stop.md
│   │   ├── qualifying.md
│   │   ├── race-session-manager.md
│   │   ├── settings.md
│   │   ├── simulation-architecture.md
│   │   ├── systems-index.md
│   │   ├── tire-system.md
│   │   ├── track-system.md
│   │   ├── ui-menu.md
│   │   ├── vehicle-physics.md
│   │   └── vfx.md
│   ├── assets/                    # Asset specifications and manifests
│   │   ├── asset-manifest.md     # Master asset manifest
│   │   └── specs/                # Per-asset specification docs
│   │       ├── pit-building-assets.md
│   │       ├── team_tier1_a-car-assets.md
│   │       ├── team_tier1_b-car-assets.md
│   │       ├── team_tier1_c-car-assets.md
│   │       ├── team_tier1_d-car-assets.md
│   │       ├── team_tier2_a-car-assets.md
│   │       ├── team_tier2_b-car-assets.md
│   │       ├── team_tier2_c-car-assets.md
│   │       ├── team_tier2_d-car-assets.md
│   │       ├── team_tier3_a-car-assets.md
│   │       ├── team_tier3_b-car-assets.md
│   │       ├── team_tier3_c-car-assets.md
│   │       ├── team_tier3_d-car-assets.md
│   │       ├── team_tier4_a-car-assets.md
│   │       ├── team_tier4_b-car-assets.md
│   │       ├── team_tier4_c-car-assets.md
│   │       ├── team_tier4_d-car-assets.md
│   │       ├── track-monaco-assets.md
│   │       ├── track-monza-assets.md
│   │       ├── track-silverstone-assets.md
│   │       ├── track-spa-assets.md
│   │       └── trackside-shared-assets.md
│   ├── player-journey.md         # Player journey and progression design
│   ├── registry/
│   │   └── entities.yaml        # Single source of truth for cross-GDD game-world facts
│   ├── reviews/
│   │   └── cross-gdd-consistency-report.md # Cross-GDD consistency analysis
│   └── ux/                       # UX design documents
│       ├── car-selection.md      # Car selection screen UX
│       ├── finished-presentation.md # Race finish presentation UX
│       ├── interaction-patterns.md # Interaction patterns and controls
│       ├── loading.md            # Loading screen UX
│       ├── pause-menu.md         # Pause menu UX
│       ├── qualifying-not-started.md # Pre-qualifying screen UX
│       ├── qualifying-results.md  # Qualifying results screen UX
│       ├── race-hud.md           # Race HUD layout and behavior
│       ├── results.md            # Race results screen UX
│       ├── reviews/              # UX review logs
│       │   └── ux-review-2026-08-01.md
│       ├── settings.md           # Settings menu UX specification
│       ├── track-selection.md    # Track selection screen UX
│       └── ui-menu.md            # UI menu system design
├── docs/                        # Technical documentation
│   ├── architecture/            # Architecture Decision Records, reviews, traceability
│   │   ├── adr-0001-manual-simulation-authority-and-determinism-boundary.md
│   │   ├── adr-0002-vehicle-physics-implementation-pattern.md
│   │   ├── adr-0003-content-pipeline-and-addressables.md
│   │   ├── adr-0004-settings-persistence-and-control-profiles.md
│   │   ├── adr-0005-input-context-controller-and-action-map-inventory.md
│   │   ├── adr-0006-fuel-tire-state-ownership-and-tick-timing.md
│   │   ├── adr-0007-track-spline-format.md
│   │   ├── adr-0008-ghost-recording-data-format-and-mvp-buffer.md
│   │   ├── adr-0009-ai-rival-deterministic-architecture.md
│   │   ├── adr-0010-camera-vfx-rendering-budget-and-interpolation.md
│   │   ├── adr-0011-pit-stop-architecture.md
│   │   ├── adr-0012-audio-system-architecture.md
│   │   ├── adr-0013-qualifying-session-format.md
│   │   ├── adr-0014-hud-data-contract-and-layout.md
│   │   ├── adr-0015-car-definition-data-validation.md
│   │   ├── adr-0016-multiplayer-sdk-deferral-and-boundary.md
│   │   ├── adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md
│   │   ├── adr-0018-race-session-manager-authority.md
│   │   ├── adr-0019-ui-presentation-screen-flow-and-navigation.md
│   │   ├── architecture-review-2026-07-27.md
│   │   ├── architecture-review-2026-07-28-v5.md
│   │   ├── architecture-review-2026-07-28-v6.md
│   │   ├── architecture-review-2026-07-28.md
│   │   ├── architecture-review-2026-08-01.md
│   │   ├── architecture-review-2026-08-05-v2.md
│   │   ├── architecture-review-2026-08-05-v3.md
│   │   ├── architecture-review-2026-08-05-v4.md
│   │   ├── architecture-review-2026-08-05.md
│   │   ├── architecture-review-2026-08-06.md
│   │   ├── architecture-traceability.md
│   │   ├── architecture.md          # Master architecture doc
│   │   ├── change-impact-2026-08-01-adr-sync.md
│   │   ├── change-impact-2026-08-05-vehicle-physics.md
│   │   ├── complete-traceability-matrix.md
│   │   ├── control-manifest.md
│   │   ├── tr-registry.yaml         # Technical requirement ID persistence
│   │   ├── traceability-index.md
│   │   └── traceability-matrix.md
│   ├── agents/                   # Agent documentation
│   │   ├── domain.md             # Domain context for agents
│   │   ├── issue-tracker.md      # Issue tracking conventions
│   │   └── triage-labels.md     # Triage label definitions
│   ├── engine-reference/        # Curated engine API snapshots (version-pinned)
│   │   ├── super-monaco-gp-teams.md
│   │   ├── godot/                # Godot engine reference
│   │   ├── unity/                # Unity engine reference
│   │   └── unreal/               # Unreal engine reference
│   ├── framework/               # OCGS framework reference
│   │   ├── director-gates.md    # Shared review gate prompts
│   │   ├── agent-roster.md      # Full agent inventory with model tiers
│   │   ├── agent-coordination-map.md # Agent delegation relationships
│   │   ├── skills-reference.md  # All 158 skills cataloged by phase
│   │   ├── coordination-rules.md # Agent delegation and conflict resolution
│   │   ├── coding-standards.md  # Code review and testing standards
│   │   ├── directory-structure.md # Canonical directory layout
│   │   ├── technical-preferences.md # Project tech config (populated by /setup-engine)
│   │   ├── workflow-catalog.yaml # Phase definitions and artifact checks
│   │   ├── context-management.md
│   │   ├── hooks-reference.md
│   │   ├── hybrid-workflow.md
│   │   ├── quick-start.md
│   │   ├── review-workflow.md
│   │   ├── rules-reference.md
│   │   ├── setup-requirements.md
│   │   └── templates/           # Document templates (GDDs, ADRs, specs)
│   ├── examples/                # Session examples and workflow case studies
│   ├── registry/                # Architecture registry
│   │   └── architecture.yaml    # Architecture registry data
│   ├── plans/                   # Project plans and handoff docs
│   │   ├── asr-car-import-pipeline.md
│   │   ├── benetton-b189-animation-inventory.md
│   │   ├── benetton-b189-asset-pipeline-pilot.html
│   │   ├── benetton-b189-driver-animation-mapping.md
│   │   └── overdrive-handoff-2026-07-24.md
│   ├── research/                # Research documents
│   │   ├── coherence-architecture-verification-2026-08-05.md
│   │   ├── multiplayer-networking-comparison-2026.md
│   │   ├── mvp-performance-baseline-2026-07.md
│   │   ├── unity-mcp-landscape-2026-07-16.md
│   │   └── unity-packages-evaluation-2026-08.html
│   ├── AGENTS.md                # Docs directory standards
│   ├── tech-debt-register.md    # Technical debt tracking
│   ├── COLLABORATIVE-DESIGN-PRINCIPLE.md # User-driven collaboration model
│   ├── COPLAY.md                # Coplay integration notes
│   ├── WORKFLOW-GUIDE.md        # Workflow selection guide
│   ├── hybrid-workflow.md       # Hybrid workflow reference
│   ├── unity-tooling-plan.md    # Unity tooling integration plan
│   ├── workflow-transitions.md  # Workflow transition rules
│   ├── authoring-agents.md      # Agent creation guide
│   ├── authoring-skills.md      # Skill creation guide
│   └── CONTRIBUTING.md          # Framework contribution guide
├── tests/                       # Root test scaffolding (see Assets/tests/ for actual tests)
│   ├── EditMode/                # Edit-mode test scaffold
│   │   └── README.md
│   ├── PlayMode/                # Play-mode test scaffold
│   │   └── README.md
│   ├── unit/                    # Unit test scaffold (currently empty)
│   ├── integration/             # Integration test scaffold (currently empty)
│   ├── smoke/                   # Smoke tests
│   │   └── critical-paths.md
│   └── evidence/                # Test evidence and artifacts (currently empty)
├── tools/                       # Build and pipeline tools
│   ├── aseprite-mcp/            # Aseprite MCP server (Python/uv)
│   ├── assign-models.js         # Model assignment utility
│   └── ksanim/                  # Ksan animation parser (Python)
├── prototypes/                  # Throwaway prototypes
│   └── race-feel/               # RaceFeel prototype documentation
├── production/                  # Production management
│   ├── gate-checks/             # Quality gate check results
│   │   ├── concept-to-systems-design.md
│   │   ├── pre-production-to-production-2026-08-09.md
│   │   └── technical-setup-to-pre-production-2026-07-28.md
│   ├── session-logs/            # Session audit trail
│   │   ├── agent-audit.log      # Plugin audit log
│   │   └── session-log.md       # Human-readable session log
│   ├── session-state/           # Active session checkpoint
│   │   └── active.md            # Living state file
│   ├── epics/                    # Feature epics and stories
│   │   ├── index.md             # Epic index
│   │   ├── content-pipeline/    # Content pipeline epic
│   │   ├── ghost-recording/     # Ghost recording epic
│   │   ├── input-system/        # Input system epic (8 fused stories)
│   │   ├── multiplayer-architecture/ # Multiplayer architecture epic
│   │   ├── settings/            # Settings epic
│   │   ├── simulation-kernel/   # Simulation kernel epic (8 stories)
│   │   │   ├── EPIC.md
│   │   │   ├── story-001-contract-spine.md
│   │   │   ├── story-002-simulation-driver-tick-clock.md
│   │   │   ├── story-003-session-start.md
│   │   │   ├── story-004-interruption.md
│   │   │   ├── story-005-session-end.md
│   │   │   ├── story-006-presentation-interpolation.md
│   │   │   ├── story-007-performance-monitor.md
│   │   │   └── story-008-determinism-replay.md
│   ├── milestones/             # MVP/alpha/beta milestone definitions
│   │   ├── alpha.md
│   │   ├── beta.md
│   │   └── mvp.md
│   ├── qa/                     # QA playtest reports
│   │   ├── qa-plan-sprint-1-2026-08-08.md
│   │   ├── qa-signoff-sprint-1-2026-08-09.md
│   │   ├── smoke-2026-08-09.md
│   │   └── playtests/           # Playtest session reports
│   │       └── playtest-2026-08-05-thawane.md
│   ├── sprints/                # Sprint plans and status
│   │   ├── sprint-1.md
│   │   ├── sprint-1-retrospective.md
│   │   └── sprint-2.md
│   ├── sprint-status.yaml      # Current sprint status
│   ├── stage.txt                # Current production stage
│   └── review-mode.txt          # Review mode state flag
├── dotnet-tools.json            # .NET tool manifest (csharpier)
├── .editorconfig                # Editor formatting rules
├── .gitattributes               # Git attributes (line endings, binary handling)
├── .gitignore                   # Git ignore rules
├── .gitmodules                  # Git submodule config (aseprite-mcp)
├── .vscode/                     # VS Code configuration
│   ├── extensions.json          # Recommended extensions
│   ├── launch.json              # Debug launch configurations
│   └── settings.json            # Workspace settings
└── .github/                     # GitHub configuration
    ├── workflows/               # CI pipelines
    │   ├── opencode.yml         # OpenCode CI
    │   ├── opencode-review.yml  # OpenCode review
    │   ├── conventional-commits.yml # Conventional Commit validation (Cocogitto)
    │   ├── tests.yml            # Test suite CI pipeline
    │   └── stale.yml            # Stale issue management
    ├── ISSUE_TEMPLATE/          # Issue templates
    ├── PULL_REQUEST_TEMPLATE.md # PR template
    └── dependabot.yml           # Dependabot config
```

## Directory Purposes

**`.agents/`:**
- Purpose: Primary agent/skill/command/rule definitions — single source of truth for OCGS framework content
- Contains: `agents/` (51 agents), `commands/` (54 commands), `skills/` (158 skills), `rules/` (11 rules)
- Note: `.opencode/` has NTFS junctions into `.agents/` subdirectories for OpenCode runtime compatibility; content is tracked once here

**`.cortexkit/`:**
- Purpose: CortexKit runtime configuration
- Contains: `.gitignore`, `magic-context/historian/`

**`.pi/`:**
- Purpose: CortexKit PI runtime — extensions, MCP server config, and settings
- Contains: `extensions/` (8 OCGS extension modules), `mcp.json` (MCP server connections), `settings.json` (runtime settings)

**`.opencode/`:**
- Purpose: OpenCode-specific configuration — plugins and junction stubs for runtime compatibility
- Contains: TypeScript plugins (`plugins/ccgs-hooks.ts`, `plugins/drift-detector.ts`, `plugins/changelog-generator.ts`), plugin tests (`plugins/tests/`); local junction dirs (`agents/`, `commands/`, `rules/`, `skills/`) pointing to `.agents/` (not tracked)

**`Assets/`:**
- Purpose: Unity project assets — the actual game
- Contains: Scenes, C# scripts, materials, sprites, input actions, render pipeline settings
- Key files: `InputSystem_Actions.inputactions`, `Settings/PC_RPAsset.asset`, `Settings/Content/topology.json`, `source/Overdrive.Input.asmdef`, `source/Editor/Overdrive.Input.Editor.asmdef`, `source/Simulation/Overdrive.Simulation.asmdef`, `source/Simulation.Unity/Overdrive.Simulation.Unity.asmdef`, `source/Multiplayer/Overdrive.Multiplayer.asmdef`, `source/Content/Overdrive.Content.asmdef`, `source/Content/Editor/Overdrive.Content.Editor.asmdef`, `source/Content/Unity/Overdrive.Content.Unity.asmdef`, `source/Settings.Core/Overdrive.Settings.Core.asmdef`, `source/Settings/Overdrive.Settings.asmdef`

**`learning/`:**
- Purpose: Agent learning system — style conformance records, generated lessons, and reference analysis
- Contains: Mission statement, learning notes, resources, generated lesson HTML files, style conformance records, reference images and palette analysis
- Key files: `MISSION.md`, `NOTES.md`, `RESOURCES.md`, `learning-records/0001-style-and-conformance.md`, `lessons/0001-style-conformance-and-verification.html`, `reference/check-image-palette.py`

**`design/`:**
- Purpose: Game design documentation, art bible, asset specs, UX design, cross-system registries, and cross-GDD consistency analysis
- Contains: GDDs (`design/gdd/`), art bible and palettes (`design/art/`), asset specifications (`design/assets/`), UX design (`design/ux/`), quick specs (`design/quick-specs/`), entity/formula registry, design standards, cross-GDD reviews
- Key files: `gdd/game-concept.md`, `art/art-bible.md`, `assets/asset-manifest.md`, `ux/race-hud.md`, `quick-specs/camera-chase-velocity-direction-2026-08-05.md`, `registry/entities.yaml`, `AGENTS.md`, `reviews/cross-gdd-consistency-report.md`

**`docs/`:**
- Purpose: Technical documentation — architecture decisions, agent documentation, framework reference, workflow guides, research
- Contains: ADRs (19 total), architecture reviews, traceability matrices, agent documentation, engine API snapshots, OCGS framework docs, examples, plans, research
- Key files: `architecture/architecture.md`, `architecture/control-manifest.md`, `architecture/tr-registry.yaml`, `agents/domain.md`, `agents/issue-tracker.md`, `agents/triage-labels.md`, `framework/director-gates.md`, `framework/agent-roster.md`, `framework/skills-reference.md`, `framework/workflow-catalog.yaml`, `plans/asr-car-import-pipeline.md`, `research/multiplayer-networking-comparison-2026.md`, `research/coherence-architecture-verification-2026-08-05.md`

**`tests/`:**
- Purpose: Unity/C# gameplay and integration tests
- Contains: EditMode and PlayMode test directories, unit tests (input, simulation, multiplayer, content, settings), integration tests (input, simulation, content, settings), editor tests (content topology), test fixtures, smoke tests, and test evidence
- Test assemblies: `InputUnitTests`, `InputIntegrationTests`, `SimulationUnitTests`, `SimulationIntegrationTests`, `MultiplayerUnitTests`, `ContentUnitTests`, `RaceLoadUnitTests`, `ContentIntegrationTests`, `ContentTopologyTests`, `SettingsUnitTests`, `SettingsIntegrationTests`
- Key files: `unit/input/EmaBrakePriorityTests.cs`, `unit/simulation/SimulationDriverTests.cs`, `unit/simulation/DeterminismReplayTests.cs`, `unit/simulation/KernelIdentityTests.cs`, `unit/multiplayer/MultiplayerIsolationTests.cs`, `unit/content/ContentStateMachineTests.cs`, `unit/content/LoadingScreenControllerTests.cs`, `unit/content/raceload/RaceLoadTests.cs`, `unit/content/RaceUnloadTests.cs`, `unit/settings/SettingsEditSessionTests.cs`, `unit/settings/SettingsValuesContractTests.cs`, `unit/settings/DisplaySettingsTests.cs`, `integration/input/InputContextControllerTests.cs`, `integration/simulation/ContractSpineTests.cs`, `integration/content/RaceLoadIntegrationTests.cs`, `integration/content/RaceUnloadIntegrationTests.cs`, `integration/content/QualityProfileIntegrationTests.cs`, `integration/settings/SettingsLifecycleTests.cs`, `integration/settings/DisplaySettingsIntegrationTests.cs`, `editor/content/ContentTopologyTests.cs`

**`production/`:**
- Purpose: Production management — session logs, audit trails, active state, quality gate checks, feature epics and stories, QA playtest reports, sprint plans, milestone definitions
- Contains: Session logs, agent audit log, session state checkpoint, gate checks, feature epics with stories, QA playtest reports, review mode state, sprint plans, milestone definitions
- Key files: `session-logs/agent-audit.log`, `session-logs/session-log.md`, `session-state/active.md`, `gate-checks/concept-to-systems-design.md`, `gate-checks/pre-production-to-production-2026-08-09.md`, `gate-checks/technical-setup-to-pre-production-2026-07-28.md`, `epics/index.md`, `epics/input-system/story-001-input-action-asset-context-controller.md`, `epics/simulation-kernel/EPIC.md`, `epics/simulation-kernel/story-001-contract-spine.md` through `story-008-determinism-replay.md`, `epics/content-pipeline/`, `epics/settings/`, `epics/multiplayer-architecture/`, `stage.txt`, `review-mode.txt`, `sprint-status.yaml`, `sprints/sprint-1.md`, `sprints/sprint-2.md`, `sprints/sprint-3.md`, `sprints/sprint-2-retrospective.md`, `qa/qa-plan-sprint-3-2026-08-12.md`, `qa/qa-signoff-sprint-2-2026-08-12.md`, `qa/smoke-2026-08-12.md`, `milestones/mvp.md`

**`prototypes/`:**
- Purpose: Throwaway prototypes isolated from main source
- Contains: `race-feel/` (race feel prototype documentation)
- Key files: `race-feel/REPORT.md`, `race-feel/engine-data.md`, `race-feel/README.md`, `race-feel/tuning-panel-reference.html`

## Key File Locations

**Entry Points:**
- `opencode.json`: OpenCode session configuration — plugins, MCP, permissions
- `.github/workflows/conventional-commits.yml`: CI entry point for Conventional Commit validation

**Configuration:**
- `AGENTS.md`: Master framework configuration — technology stack, project structure, agent hierarchy, available commands
- `opencode.json`: Plugin loading, MCP server config, bash/read permissions
- `.mcp.json`: MCP server connections for CortexKit runtime
- `.pi/settings.json`: CortexKit PI runtime settings
- `.pi/mcp.json`: CortexKit MCP server overrides
- `Packages/manifest.json`: Unity package dependencies (URP, Input System, AI Nav, etc.)
- `ProjectSettings/ProjectVersion.txt`: Unity version (6000.3.22f1)
- `dotnet-tools.json`: .NET tool manifest (csharpier)
- `.editorconfig`: Editor formatting rules

**Core Logic:**
- `.agents/agents/[name].md`: Agent definitions (51 agents)
- `.agents/skills/[name]/SKILL.md`: Skill workflows (158 skills)
- `.agents/commands/[name].md`: Slash command routing (54 commands)
- `.agents/rules/[name].md`: Path-scoped coding rules (11 rules)
- `.opencode/plugins/ccgs-hooks.ts`: Primary lifecycle hooks plugin
- `.opencode/plugins/drift-detector.ts`: Template drift detection
- `.opencode/plugins/changelog-generator.ts`: Changelog generation
- `Assets/source/Simulation/SimulationKernel.cs`: 14-step simulation invocation spine
- `Assets/source/Simulation/SimulationStateMachine.cs`: Authoritative session lifecycle
- `Assets/source/Simulation/SimulationDriver.cs`: Manual fixed-step accumulator driver
- `Assets/source/Simulation/RenderInterpolator.cs`: Render interpolation math
- `Assets/source/Simulation/PerformanceMonitor.cs`: FPS protection monitor
- `Assets/source/Simulation.Unity/SimulationDriverAdapters.cs`: Unity lifecycle adapters for the simulation driver (UnityFrameDeltaSource, UnityPhysicsSimulator, SimulationDriverBehaviour)
- `Assets/source/Simulation/SimulationKernel.cs`: 14-step spine with ICanonicalSpineStep slot enforcement
- `Assets/source/InputFrameCapture.cs`: Production capture adapter (IFrameInputCapture)
- `Assets/source/Content/ContentStateMachine.cs`: Authoritative content pipeline lifecycle
- `Assets/source/Content/RaceLoadOrchestrator.cs`: Engine-free parallel 17-handle load with memory policy
- `Assets/source/Content/StartupOrchestrator.cs`: App-startup sequence (catalog init, Shared group retention)
- `Assets/source/Content/ContentContracts.cs`: ContentPipelineState, RaceContentSelection, ContentResourceState
- `Assets/source/Content/ContentSeams.cs`: Injectable content pipeline ports
- `Assets/source/Content/RaceLoadContracts.cs`: Engine-free load seams (IAddressableLoader, IRaceContentRuntime, etc.)
- `Assets/source/Content/LoadingScreenContracts.cs`: ILoadingScreenPresenter loading screen presentation port
- `Assets/source/Content/LoadingScreenController.cs`: Engine-free loading screen lifecycle controller
- `Assets/source/Content/QualityProfileContracts.cs`: Quality pipeline seams (IQualityProfileSource, IQualityOverrideSource, ITextureMipmapApplier)
- `Assets/source/Content/MipmapLimitResolver.cs`: Pure preset-to-mipmap-limit resolver
- `Assets/source/Content/Unity/ContentCompositionRoot.cs`: Wires content pipeline seams
- `Assets/source/Content/Unity/UnityContentRuntime.cs`: Concrete IRaceContentRuntime + IRaceContentAccumulator
- `Assets/source/Content/Unity/UnityTextureMipmapApplier.cs`: Writes QualitySettings.globalTextureMipmapLimit
- `Assets/source/Content/Editor/ContentTopologyValidator.cs`: Validates Addressable settings against topology manifest
- `Assets/source/Settings/DisplayContracts.cs`: Unity-side display types and ports
- `Assets/source/Settings/DisplayConfirmGate.cs`: 15-second confirmation timer with focus-loss rollback
- `Assets/source/Settings/QualityPresetApplier.cs`: URP render pipeline asset adapter
- `Assets/source/Settings/SettingsQualityProfileSource.cs`: IQualityProfileSource adapter (reads applied preset)
- `Assets/source/Settings/SettingsQualityOverrideSource.cs`: IQualityOverrideSource adapter (PerformanceMonitor signals)
- `Assets/source/Settings.Core/QualityPresets.cs`: Engine-free QualityPresetId and VfxDensityLevel enums
- `Assets/source/Settings.Core/ValueContracts.cs`: Typed value types for audio/accessibility/vfx ports
- `Assets/source/Settings.Core/ValuePorts.cs`: Typed value ports for SettingsEditSession change publication

**Design Documents:**
- `.opencode/plugins/tests/`: Plugin unit tests (11 test suites)
- `Assets/tests/unit/input/`: Input system unit tests (EmaBrakePriorityTests.cs, SchemeArbitrationTests.cs)
- `Assets/tests/unit/simulation/`: Simulation unit tests (SimulationDriverTests.cs, SessionStartTests.cs, InterruptionTests.cs, InterpolationTests.cs, PerformanceMonitorTests.cs, DeterminismReplayTests.cs, KernelIdentityTests.cs, TestSteps.cs)
- `Assets/tests/unit/multiplayer/`: Multiplayer unit tests (MultiplayerIsolationTests.cs — 7 ACs: D2 seam signatures, engine-free assembly, contract types, isolation guardrails, manifest denylist, no provider, deferral)
- `Assets/tests/unit/settings/`: Settings unit tests (ControlBindingTests.cs, DifficultyProfileTests.cs, DisplaySettingsTests.cs, SettingsEditSessionTests.cs, SettingsPersistenceTests.cs, SettingsValuesContractTests.cs)
- `Assets/tests/unit/content/`: Content pipeline unit tests (ContentStateMachineTests.cs, LoadingScreenControllerTests.cs, RaceUnloadTests.cs, StartupErrorTests.cs)
- `Assets/tests/unit/content/raceload/`: Race load unit tests (RaceLoadTests.cs)
- `Assets/tests/integration/input/`: Input system integration tests (InputContextControllerTests.cs, InputFrameCaptureTests.cs, RawCaptureDeadZoneTests.cs, ContextTransitionsTests.cs, SettingsConfigurationTests.cs, SpecialRoutingTests.cs, TickProcessorTests.cs)
- `Assets/tests/integration/simulation/`: Simulation integration tests (ContractSpineTests.cs, SessionEndTests.cs, TestSteps.cs)
- `Assets/tests/integration/settings/`: Settings integration tests (ControlBindingIntegrationTests.cs, DifficultyProfileIntegrationTests.cs, DisplaySettingsIntegrationTests.cs, SettingsLifecycleTests.cs, SettingsPersistenceIntegrationTests.cs, SettingsRuntimeIntegrationTests.cs)
- `Assets/tests/integration/content/`: Content pipeline integration tests (RaceLoadIntegrationTests.cs, RaceUnloadIntegrationTests.cs, StartupErrorIntegrationTests.cs, QualityProfileIntegrationTests.cs)
- `Assets/tests/editor/content/`: Content topology editor tests (ContentTopologyTests.cs)
- `Assets/tests/content/Fixtures/`: Committed topology fixture assets (car definitions, track data, shared resources)
- `design/art/reference-catalog.md` — Reference image catalog
- `design/assets/asset-manifest.md` — Master asset manifest
- `design/ux/race-hud.md` — Race HUD UX specification
- `design/ux/ui-menu.md` — UI menu system design
- `design/quick-specs/` — Quick specifications for validated findings (camera chase velocity, track Suzuka validation)
- `design/registry/entities.yaml`: Cross-GDD entity/formula/constant registry
- `design/reviews/cross-gdd-consistency-report.md`: Cross-GDD consistency analysis
- `docs/architecture/architecture.md`: Master architecture document
- `docs/architecture/control-manifest.md`: Control manifest
- `docs/architecture/adr-0001-manual-simulation-authority-and-determinism-boundary.md`: ADR on manual simulation authority
- `docs/architecture/adr-0002-vehicle-physics-implementation-pattern.md` through `adr-0015-car-definition-data-validation.md`: 14 ADRs (0002-0015)
- `docs/architecture/adr-0016-multiplayer-sdk-deferral-and-boundary.md`: ADR on online services deferral
- `docs/architecture/adr-0017-network-simulation-driver-interface-and-beta-canonical-state-model.md`: ADR on network simulation driver
- `docs/architecture/adr-0018-race-session-manager-authority.md`: ADR on race session manager authority
- `docs/architecture/adr-0019-ui-presentation-screen-flow-and-navigation.md`: ADR on UI presentation screen flow
- `docs/architecture/tr-registry.yaml`: Technical requirement ID persistence
- `docs/architecture/complete-traceability-matrix.md`: Full traceability matrix
- `docs/architecture/architecture-traceability.md`: Architecture traceability
- `docs/architecture/architecture-review-2026-08-05.md` through `architecture-review-2026-08-06.md`: Architecture review reports
- `docs/registry/architecture.yaml`: Architecture registry data
- `docs/framework/workflow-catalog.yaml`: Phase definitions and artifact checks
- `docs/framework/director-gates.md`: Shared review gate prompts
- `docs/plans/asr-car-import-pipeline.md`: ASR car import pipeline plan
- `docs/plans/benetton-b189-animation-inventory.md`: Benetton B189 animation inventory
- `docs/plans/benetton-b189-asset-pipeline-pilot.html`: Benetton B189 asset pipeline pilot (HTML)
- `docs/plans/benetton-b189-driver-animation-mapping.md`: Benetton B189 driver animation mapping
- `docs/plans/overdrive-handoff-2026-07-24.md`: Project handoff plan
- `docs/tech-debt-register.md`: Technical debt tracking register

**Tests:**
- `.opencode/plugins/tests/`: Plugin unit tests (11 test suites)
- `Assets/tests/unit/input/`: Input system unit tests (EmaBrakePriorityTests.cs, SchemeArbitrationTests.cs)
- `Assets/tests/unit/simulation/`: Simulation unit tests (SimulationDriverTests.cs, SessionStartTests.cs, InterruptionTests.cs, InterpolationTests.cs, PerformanceMonitorTests.cs, DeterminismReplayTests.cs, KernelIdentityTests.cs, TestSteps.cs)
- `Assets/tests/unit/multiplayer/`: Multiplayer unit tests (MultiplayerIsolationTests.cs — 7 ACs: D2 seam signatures, engine-free assembly, contract types, isolation guardrails, manifest denylist, no provider, deferral)
- `Assets/tests/unit/content/`: Content pipeline unit tests (ContentStateMachineTests.cs, LoadingScreenControllerTests.cs, RaceUnloadTests.cs, StartupErrorTests.cs; raceload/RaceLoadTests.cs)
- `Assets/tests/unit/settings/`: Settings unit tests (ControlBindingTests.cs, DifficultyProfileTests.cs, DisplaySettingsTests.cs, SettingsEditSessionTests.cs, SettingsPersistenceTests.cs, SettingsValuesContractTests.cs)
- `Assets/tests/integration/input/`: Input system integration tests (InputContextControllerTests.cs, InputFrameCaptureTests.cs, RawCaptureDeadZoneTests.cs, ContextTransitionsTests.cs, SettingsConfigurationTests.cs, SpecialRoutingTests.cs, TickProcessorTests.cs)
- `Assets/tests/integration/simulation/`: Simulation integration tests (ContractSpineTests.cs, SessionEndTests.cs, TestSteps.cs)
- `Assets/tests/integration/content/`: Content pipeline integration tests (RaceLoadIntegrationTests.cs, RaceUnloadIntegrationTests.cs, StartupErrorIntegrationTests.cs, QualityProfileIntegrationTests.cs)
- `Assets/tests/integration/settings/`: Settings integration tests (ControlBindingIntegrationTests.cs, DifficultyProfileIntegrationTests.cs, DisplaySettingsIntegrationTests.cs, SettingsLifecycleTests.cs, SettingsPersistenceIntegrationTests.cs, SettingsRuntimeIntegrationTests.cs)
- `Assets/tests/editor/content/`: Content topology editor tests (ContentTopologyTests.cs)

## Naming Conventions

**Agent files:** `[role-name].md` — lowercase, hyphen-separated (e.g., `creative-director.md`, `gameplay-programmer.md`)

**Skill directories:** `[skill-name]/SKILL.md` — lowercase, hyphen-separated (e.g., `concept-brainstorm/SKILL.md`, `design-system/SKILL.md`)

**Command files:** `[command-name].md` — matches skill directory name (e.g., `concept-brainstorm.md` → `skills/concept-brainstorm/SKILL.md`)

**Module directories:** `[theme-name]/` — lowercase, hyphen-separated (e.g., `engine-unity/`, `level-design/`)

**GDD files:** `[system-slug].md` — lowercase, hyphen-separated (e.g., `movement-system.md`, `combat-system.md`)

**Unity C# files:** PascalCase (e.g., `Readme.cs`, `ReadmeEditor.cs`)

**Unity assets:** PascalCase with spaces allowed (e.g., `DefaultVolumeProfile.asset`, `PC_RPAsset.asset`)

**Plugin files:** kebab-case TypeScript (e.g., `ccgs-hooks.ts`, `drift-detector.ts`)

## Where to Add New Code

**New agent:** `.agents/agents/[agent-name].md` — follow frontmatter template in `docs/authoring-agents.md`

**New skill:** `.agents/skills/[skill-name]/SKILL.md` — follow workflow template in `docs/authoring-skills.md`, add command file in `.agents/commands/[skill-name].md`

**New OpenCode plugin:** `.opencode/plugins/[plugin-name].ts` — implement `Plugin` interface from `@opencode-ai/plugin`, register in `opencode.json` plugin array

**New game C# script (Input):** `Assets/source/[ScriptName].cs` — follow Unity naming conventions, use PascalCase; group under `Overdrive.Input` assembly for Unity-dependent input-system code

**New input editor tool:** `Assets/source/Editor/[ScriptName].cs` — follow Unity editor naming conventions; place in `Overdrive.Input.Editor` assembly (Editor-only platform); reference `Unity.InputSystem`, `UnityEditor`, and `Overdrive.Input`

**New simulation contract or pipeline step:** `Assets/source/Simulation/[Name].cs` — follow engine-free naming conventions; place in `Overdrive.Simulation` assembly (no Unity engine references allowed); depend on `Unity.Mathematics` if needed

**New multiplayer seam type:** `Assets/source/Multiplayer/[Name].cs` — follow engine-free naming conventions; place in `Overdrive.Multiplayer` assembly (no Unity engine references allowed); depends only on `Overdrive.Simulation` and `Unity.Mathematics`

**New multiplayer test:** `Assets/tests/unit/multiplayer/[TestName].cs` — reference `MultiplayerUnitTests` assembly; verify engine-free boundary and contract invariants

**New content pipeline core type:** `Assets/source/Content/[Name].cs` — follow engine-free naming conventions; place in `Overdrive.Content` assembly (no Unity engine references allowed); depends on `Overdrive.Simulation` and `Overdrive.Settings.Core`; new seams go here as engine-free ports (e.g., `IContentLoadSeam`, `ICatalogInitializer`, `IFocusSeam`, `IQualityProfileSource`)

**New content pipeline Unity adapter:** `Assets/source/Content/Unity/[Name].cs` — follow Unity naming conventions; place in `Overdrive.Content.Unity` assembly (engine-allowed); bridge engine-free content pipeline seams to Unity APIs (Addressables, Object.Instantiate, Profiler, QualitySettings); references `Overdrive.Content`, `Overdrive.Simulation`, `Overdrive.Settings.Core`

**New content pipeline editor tool:** `Assets/source/Content/Editor/[Name].cs` — follow Unity editor naming conventions; place in `Overdrive.Content.Editor` assembly (Editor-only platform); reference `Unity.Addressables.Editor` and `Overdrive.Content`

**New content pipeline test:** `Assets/tests/unit/content/[TestName].cs` or `Assets/tests/integration/content/[TestName].cs` — reference `ContentUnitTests`/`RaceLoadUnitTests` or `ContentIntegrationTests` assembly respectively; editor tests go in `Assets/tests/editor/content/` referencing `ContentTopologyTests` assembly

**New settings core type:** `Assets/source/Settings.Core/[Name].cs` — follow engine-free naming conventions; place in `Overdrive.Settings.Core` assembly (no Unity engine references allowed); the persistence seam `IPlayerPrefsStore` is the sole storage port; new seam interfaces (`ICapture`, `ISchemeProbe`, `IDisplayApi`, etc.) go here as engine-free ports

**New settings Unity adapter:** `Assets/source/Settings/[Name].cs` — follow Unity naming conventions; place in `Overdrive.Settings` assembly (engine-allowed); bridge engine-free settings core to Unity APIs; adapters for display/quality (`DisplayConfirmGate`, `ScreenDisplayApi`, `QualityPresetApplier`), rebinding (`RebindCaptureAdapter`, `SchemeProbeAdapter`), difficulty (`DifficultyProfileCatalog`, `SettingsDifficultyProvider`), and binding migration (`SettingsBindingMapper`) live here

**New settings test:** `Assets/tests/unit/settings/[TestName].cs` or `Assets/tests/integration/settings/[TestName].cs` — reference `SettingsUnitTests` or `SettingsIntegrationTests` assembly respectively

**New simulation Unity adapter:** `Assets/source/Simulation.Unity/[Name].cs` — follow Unity naming conventions; place in `Overdrive.Simulation.Unity` assembly (engine-allowed, namespace `Overdrive.Simulation.UnityAdapters`); bridge engine-free simulation seams (`IPhysicsSimulator`, `IFrameDeltaSource`) to Unity APIs; references only `Overdrive.Simulation`

**New simulation test:** `Assets/tests/unit/simulation/[TestName].cs` or `Assets/tests/integration/simulation/[TestName].cs` — reference `SimulationUnitTests` or `SimulationIntegrationTests` assembly respectively; test only engine-free simulation contracts or integration seams

**New Unity scene:** `Assets/Scenes/[SceneName].unity` — follow existing scene patterns

**New design document:** `design/gdd/[system-slug].md` — must include all 8 required sections per `design/AGENTS.md`

**New ADR:** `docs/architecture/[adr-title].md` — follow standard ADR format

**New test:** `tests/[category]/[test-name].cs` (Unity) or `tests/[category]/[test-name].test.mjs` (plugin) — follow existing test patterns in the relevant subdirectory

**New CI workflow:** `.github/workflows/[workflow-name].yml` — follow existing workflow patterns (e.g., `tests.yml` for test suites)

**Shared utilities:** `tools/` — JavaScript utilities used across tooling scripts (e.g., `tools/assign-models.js`)

**Prototypes:** `prototypes/[prototype-name]/` — throwaway experiments, isolated from `Assets/`
