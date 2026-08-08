using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;

/// <summary>
/// Sole owner of the Overdrive action maps (OverdriveGameplay, OverdriveUI) and of the
/// <see cref="InputSystemUIInputModule"/> used for menu input, per ADR-0005.
///
/// <para>
/// Context transitions happen exclusively through <see cref="SetGameplayContext"/> and
/// <see cref="SetUIContext"/>. Each transition disables the outgoing action map before
/// enabling the incoming one, so exactly one action map is enabled at any time. The action
/// maps and the UI input module are private to this controller: the controller's own public
/// API surface never activates them (only the sanctioned SetGameplayContext/SetUIContext
/// transitions do), and external Enable/Disable calls from project source are rejected by
/// static source scan (AC-45b). The controller-owned asset is readable through the read-only
/// <see cref="ActiveAsset"/> accessor — the sanctioned read path for Input-domain consumers
/// (e.g. story-002 raw sample capture). Precise activation contract: the asset's own public
/// Enable()/FindActionMap().Enable() remain callable by a consumer through the accessor (as
/// they were via the module's actionsAsset before it), but activation has no lasting effect —
/// every context transition re-establishes exactly-one-map, and EnforceGlobalSoleOwnership
/// sweeps foreign asset instances.
/// </para>
///
/// <para>
/// The pause edge is observed from OverdriveGameplay.Pause while the Gameplay context is
/// active. A press raises <see cref="PauseEdge"/> exactly once (holding does not re-raise);
/// the edge is then pending (<see cref="HasPendingPauseEdge"/>) until the Gameplay→UI
/// transition consumes it. While the UI context is active the pending-edge state is always
/// empty. Full per-frame raw input capture is story 002; only the edge observable and the
/// pending-edge test hook are implemented here.
/// </para>
///
/// Usage (one instance per game session, placed in the bootstrap scene):
/// <code>
/// var controller = gameObject.AddComponent&lt;InputContextController&gt;();
/// controller.SetGameplayContext();
/// // ... on pause:
/// controller.SetUIContext();
/// // ... on resume:
/// controller.SetGameplayContext();
/// </code>
/// </summary>
public class InputContextController : MonoBehaviour
{
    private InputSystem_Actions _actions;
    private InputActionMap _gameplayMap;
    private InputActionMap _uiMap;
    private InputSystemUIInputModule _uiModule;
    private InputAction _accelerateAction;
    private InputAction _brakeAction;
    private InputAction _steerAction;
    private InputActionReference _submitReference;
    private InputActionReference _cancelReference;
    private InputActionReference _moveReference;
    private InputActionReference _pointReference;
    private InputActionReference _leftClickReference;
    private ulong _captureSequence;
    private bool _observedPausePending;

    /// <summary>
    /// Rises exactly once per press of OverdriveGameplay.Pause while the Gameplay context is
    /// active. Holding the button does not re-raise it; a fresh press after release does.
    /// </summary>
    public event System.Action PauseEdge;

    /// <summary>
    /// The currently active input context. <see cref="InputContext.None"/> before the first
    /// context transition, <see cref="InputContext.Gameplay"/> or <see cref="InputContext.UI"/>
    /// afterwards.
    /// </summary>
    public InputContext ActiveContext { get; private set; } = InputContext.None;

    /// <summary>
    /// True while a Pause edge is pending consumption. Set by a Pause press in the Gameplay
    /// context and cleared by the Gameplay→UI transition (ADR-0005). Always false while the
    /// UI context is active. Test hook for the story-001 pending-edge contract.
    /// </summary>
    public bool HasPendingPauseEdge { get; private set; }

    /// <summary>
    /// Number of action maps currently enabled: 0 before the first context transition,
    /// exactly 1 while a context is active. Test hook for the single-active-map invariant
    /// (AC-45).
    /// </summary>
    public int EnabledMapCount =>
        ((_gameplayMap != null && _gameplayMap.enabled) ? 1 : 0)
        + ((_uiMap != null && _uiMap.enabled) ? 1 : 0);

    /// <summary>
    /// Read-only access to the active input asset — the controller-owned
    /// <see cref="InputSystem_Actions"/> wrapper instance. The sanctioned read path for
    /// Input-domain consumers (e.g. story-002 raw sample capture).
    ///
    /// <para>
    /// Precise activation contract: this is a read-only accessor, not an activation surface —
    /// but the asset's own public <c>Enable()</c>/<c>FindActionMap().Enable()</c> remain
    /// callable by a consumer through it, exactly as they were callable via the module's
    /// <c>actionsAsset</c> before this accessor existed. Such activation has NO lasting
    /// effect: every context transition re-establishes exactly-one-map (disable-before-enable,
    /// ADR-0005), and <see cref="EnforceGlobalSoleOwnership"/> sweeps foreign asset
    /// instances at init and at both context transitions.
    /// </para>
    /// </summary>
    /// <remarks>
    /// Returns null before <see cref="Awake"/> creates the wrapper — consumers must access it
    /// after creation (any time after the component exists in the scene). The returned asset is
    /// the controller's own wrapper instance by identity (reference equality); a foreign
    /// InputSystem_Actions wrapper enabled elsewhere is swept by EnforceGlobalSoleOwnership at
    /// init and at both context transitions, so this accessor can never hand out the actions of
    /// a second, foreign enabled asset.
    /// </remarks>
    public InputActionAsset ActiveAsset => _actions != null ? _actions.asset : null;

    private void Awake()
    {
        DontDestroyOnLoad(gameObject);
        EnsureInitialized();
    }

    /// <summary>
    /// Captures the controller-owned gameplay actions exactly once for the current render-frame
    /// simulation update. The returned value is immutable and does not consume the pending Pause
    /// edge; tick processing owns Pause consumption in Story 006.
    ///
    /// <example>
    /// <code>
    /// RawInputSample sample = inputController.CaptureLatestRawSample();
    /// simulation.Process(sample);
    /// </code>
    /// </example>
    /// <remarks>
    /// Calling this method after the controller has been destroyed is undefined because
    /// <see cref="OnDestroy"/> disposes the controller-owned action asset.
    /// </remarks>
    /// </summary>
    public RawInputSample CaptureLatestRawSample()
    {
        EnsureInitialized();

        var (accelerateRaw, brakeRaw, steerRaw) = ReadRawChannels();
        var pauseRise = ActiveContext == InputContext.Gameplay
            && HasPendingPauseEdge
            && !_observedPausePending;
        _observedPausePending = HasPendingPauseEdge;

        var sample = new RawInputSample(
            _captureSequence++,
            DetermineControlScheme(),
            accelerateRaw,
            brakeRaw,
            steerRaw,
            pauseRise,
            DetectAvailability(),
            RawInputSampleValidity.GetFlags(accelerateRaw, brakeRaw, steerRaw));
        return sample;
    }

    private (float accelerate, float brake, float steer) ReadRawChannels()
    {
        return (_accelerateAction.ReadValue<float>(),
            _brakeAction.ReadValue<float>(),
            _steerAction.ReadValue<float>());
    }

    private InputAvailability DetectAvailability()
    {
        // Story-008 owns final scheme-aware availability arbitration; Story-002 uses the same
        // eligible-device proxy as DetermineControlScheme().
        return Keyboard.current != null
            || Mouse.current != null
            || Gamepad.current != null
            ? InputAvailability.Available
            : InputAvailability.NoInputDevice;
    }

    private void OnDestroy()
    {
        // Disable the module first so it releases its action references while the action
        // asset is still alive; the null guard tolerates arbitrary component-destroy order.
        if (_uiModule != null)
            _uiModule.enabled = false;
        // Story-001 module wiring creates these ScriptableObject references; destroy them here
        // or every controller lifecycle leaks five references until the next domain reload.
        DestroyInputReference(ref _submitReference);
        DestroyInputReference(ref _cancelReference);
        DestroyInputReference(ref _moveReference);
        DestroyInputReference(ref _pointReference);
        DestroyInputReference(ref _leftClickReference);
        if (_actions != null)
        {
            _actions.OverdriveGameplay.Pause.performed -= OnGameplayPausePerformed;
            // The generated wrapper's finalizer (InputSystem_Actions.cs:727-731) asserts BOTH
            // maps are disabled when the wrapper is collected. Dispose() alone destroys the
            // asset; when the controller is destroyed mid-context (e.g. scene unload while
            // paused), one map is still enabled and the finalizer asserts at GC time.
            // The wrapper's aggregate Disable() clears both maps, satisfying the contract.
            _actions.Disable();
            _actions.Dispose();
        }
    }

    private void Update()
    {
        // Sole-ownership enforcement (AC-45b), per-frame scope: the UI input module is a
        // scene component that external code could in principle reach, so its enablement is
        // re-asserted against the commanded context every frame — an external module
        // activation attempt therefore has no lasting effect. The action maps are NOT
        // re-asserted per-frame: they are re-established on context TRANSITIONS
        // (disable-before-enable, ADR-0005). Because InputActionAsset.Enable() is public, an
        // external same-asset activation is possible through the read-only ActiveAsset
        // accessor (or the module's actionsAsset) — it persists until the next context
        // transition, at which point exactly-one-map is re-established.
        if (_uiModule != null && _uiModule.enabled != (ActiveContext == InputContext.UI))
            _uiModule.enabled = ActiveContext == InputContext.UI;
    }

    /// <summary>
    /// Enters the Gameplay context: disables OverdriveUI (and the UI input module), then
    /// enables OverdriveGameplay. OverdriveGameplay.Pause starts being observed for the
    /// pause edge. Safe to call repeatedly; the resulting state is identical.
    /// </summary>
    public void SetGameplayContext()
    {
        EnsureInitialized();
        // Re-assert global sole ownership before every transition so the invariant holds
        // unconditionally (AC-45), independent of the module's ref-count bookkeeping.
        EnforceGlobalSoleOwnership();
        // Disable before enable — exactly one map is active at any time (ADR-0005).
        _uiMap.Disable();
        _uiModule.enabled = false;
        _gameplayMap.Enable();
        ActiveContext = InputContext.Gameplay;
    }

    /// <summary>
    /// Enters the UI context: disables OverdriveGameplay, clears any pending pause edge
    /// (the Gameplay→UI transition consumes it, per ADR-0005), then enables OverdriveUI and
    /// the UI input module so Confirm/Cancel/Navigate/Point/Click route into the UI event
    /// system. Safe to call repeatedly; the resulting state is identical.
    /// </summary>
    public void SetUIContext()
    {
        EnsureInitialized();
        // Re-assert global sole ownership before every transition (AC-45): this runs while
        // our own maps are the only ones allowed to be enabled, so foreign enabled actions
        // (leaked wrappers, stale module residue) are swept before our UI map comes up.
        EnforceGlobalSoleOwnership();
        _gameplayMap.Disable();
        ClearPendingPauseEdge();
        _uiMap.Enable();
        _uiModule.enabled = true;
        ActiveContext = InputContext.UI;
    }

    private void EnsureInitialized()
    {
        if (_actions != null)
            return;

        CreateActionWrapper();
        SetupEventSystemAndModule();
        StripDefaultModuleActions();
        WireUiModuleReferences();
        SubscribePauseAndEnforceOwnership();
    }

    private void CreateActionWrapper()
    {
        _actions = new InputSystem_Actions();
        _gameplayMap = _actions.OverdriveGameplay.Get();
        _uiMap = _actions.OverdriveUI.Get();
        _accelerateAction = _actions.OverdriveGameplay.Accelerate;
        _brakeAction = _actions.OverdriveGameplay.Brake;
        _steerAction = _actions.OverdriveGameplay.Steer;
    }

    private void SetupEventSystemAndModule()
    {
        // Scene invariant: exactly one ACTIVE EventSystem must exist at bootstrap; an inactive
        // EventSystem is skipped by FindFirstObjectByType and would silently produce a second.
        // The controller reuses it when present, otherwise creates one on this GameObject so it
        // fully owns its input lifecycle. The module must live on the EventSystem GameObject
        // for the UI event system to drive it.
        // Bootstrap-time one-shot singleton acquisition; sanctioned exception to the no-Find
        // standard. This is never performed per-frame.
        var eventSystem = FindFirstObjectByType<EventSystem>();
        if (eventSystem == null)
            eventSystem = gameObject.AddComponent<EventSystem>();
        _uiModule = eventSystem.GetComponent<InputSystemUIInputModule>()
            ?? eventSystem.gameObject.AddComponent<InputSystemUIInputModule>();

        // Keep the module off until the UI context is entered; the module's OnEnable would
        // otherwise bind and enable the package's default actions.
        _uiModule.enabled = false;
    }

    private void StripDefaultModuleActions()
    {
        // N-1 safety (second review round; mechanism corrected by the third, guarantee by the
        // fourth — see EnforceGlobalSoleOwnership below): a module added via AddComponent on
        // an active GameObject runs OnEnable synchronously, and with no actions assigned it
        // calls AssignDefaultActions() — wiring ALL 10 references (point, leftClick,
        // rightClick, middleClick, scrollWheel, trackedDeviceOrientation,
        // trackedDevicePosition, move, submit, cancel) to the package's embedded
        // DefaultInputActions asset. In that fresh path the intermediate `_uiModule.enabled =
        // false` above already triggers OnDisable, whose CONDITIONAL UnassignActions() —
        // InputSystemUIInputModule.cs:1665-1668, fires only when
        // `defaultActions.asset == actionsAsset`, which AssignDefaultActions just made true —
        // cleans the default-asset references up, making the explicit call below a no-op.
        // The explicit call IS load-bearing for the reuse path: a pre-existing, already-
        // disabled module with serialized default refs (OnEnable never ran this session)
        // sees the enabled toggle as a no-op — Unity fires OnDisable only on an
        // enabled→disabled transition — so the conditional cleanup never fires and only this
        // call strips the stale references. Keep it unconditional so both paths are covered.
        // This call only fixes the MODULE's references though: it cannot touch actions other
        // code enabled in the global InputActionState, which is what the AC-45 failure
        // class actually was (see EnforceGlobalSoleOwnership). UnassignActions() nulls
        // actionsAsset too, so the actionsAsset assignment below must stay AFTER this call.
        _uiModule.UnassignActions();
    }

    private void WireUiModuleReferences()
    {
        // OverdriveUI is wired into the UI input module: Confirm → Submit, Cancel → Cancel,
        // plus Navigate/Point/Click for normal menu routing (ADR-0005).
        _uiModule.actionsAsset = _actions.asset;
        _submitReference = InputActionReference.Create(_actions.OverdriveUI.Confirm);
        _cancelReference = InputActionReference.Create(_actions.OverdriveUI.Cancel);
        _moveReference = InputActionReference.Create(_actions.OverdriveUI.Navigate);
        _pointReference = InputActionReference.Create(_actions.OverdriveUI.Point);
        _leftClickReference = InputActionReference.Create(_actions.OverdriveUI.Click);
        _uiModule.submit = _submitReference;
        _uiModule.cancel = _cancelReference;
        _uiModule.move = _moveReference;
        _uiModule.point = _pointReference;
        _uiModule.leftClick = _leftClickReference;
    }

    private void SubscribePauseAndEnforceOwnership()
    {
        _actions.OverdriveGameplay.Pause.performed += OnGameplayPausePerformed;

        // Establish sole ownership the moment this controller exists (AC-45, fourth review
        // round): wipes anything the module's OnEnable just enabled transiently AND any
        // foreign asset that leaked in before us.
        EnforceGlobalSoleOwnership();
    }

    private void ClearPendingPauseEdge()
    {
        HasPendingPauseEdge = false;
        _observedPausePending = false;
    }

    private static void DestroyInputReference(ref InputActionReference reference)
    {
        if (reference == null)
            return;
        UnityEngine.Object.Destroy(reference);
        reference = null;
    }

    private ControlScheme DetermineControlScheme()
    {
        if (Keyboard.current != null || Mouse.current != null)
            return ControlScheme.KeyboardMouse;
        if (Gamepad.current != null)
            return ControlScheme.Gamepad;
        // TODO story-007: replace with last-meaningful-device arbitration (ADR-0005).
        return ControlScheme.KeyboardMouse;
    }

    /// <summary>
    /// Enforces the exactly-one-active-asset invariant against the GLOBAL enabled-actions
    /// list (ADR-0005). Every action currently enabled that is not one of this controller's
    /// two maps is disabled — identity (reference equality) is the comparison, never names:
    /// every InputSystem_Actions wrapper instance shares the asset JSON name, so name-based
    /// filtering cannot distinguish "our" asset from a leaked one.
    ///
    /// <para>
    /// Why this is needed (debug-mission root cause, AC-45): the UI module's ref-count
    /// bookkeeping (EnableInputAction/TryDisableInputAction,
    /// InputSystemUIInputModule.cs:1730-1777) is per-module and keyed on action identity; it
    /// can only undo what THAT module instance enabled, and only while the action objects
    /// are alive. The controller's own cleanup (_actions.Disable/Dispose) only touches its
    /// own asset. Neither reaches actions other code enabled in the global InputActionState.
    /// Evidence: with domain reload disabled, a leaked InputSystem_Actions wrapper from a
    /// prior editor/play-mode environment had BOTH maps enabled across every AC-45 test —
    /// InputTestFixture's SaveAndReset wipes InputActionState but not ScriptableObjects, so
    /// the leaked asset and its enabled maps survived every test boundary. A module's
    /// AssignDefaultActions() also leaves stale s_InputActionReferenceCounts entries
    /// (refCount=1, destroyed asset) — inert (their actions are not enabled) but proof that
    /// the module's bookkeeping is not the invariant.
    /// </para>
    ///
    /// <para>
    /// Cost is paid only at context transitions (never per-frame): ListEnabledActions
    /// iterates the enabled list, and every foreign action found is disabled exactly once.
    /// Disable() early-outs on already-disabled actions and is safe on enabled actions with
    /// live state — ListEnabledActions only returns those.
    /// </para>
    /// </summary>
    private void EnforceGlobalSoleOwnership()
    {
        if (_actions == null)
            return;
        var myAsset = _actions.asset;
        foreach (var action in InputSystem.ListEnabledActions())
        {
            var map = action.actionMap;
            if (map == null || !ReferenceEquals(map.asset, myAsset))
                action.Disable();
        }
    }

    private void OnGameplayPausePerformed(InputAction.CallbackContext context)
    {
        // The map only performs while the Gameplay context is active; the guard keeps the
        // invariant explicit and protects against stale callbacks during teardown.
        if (ActiveContext != InputContext.Gameplay)
            return;
        HasPendingPauseEdge = true;
        PauseEdge?.Invoke();
    }
}
