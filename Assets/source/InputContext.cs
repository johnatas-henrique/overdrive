/// <summary>
/// The runtime input context of the game, as defined in ADR-0005.
/// Exactly one of <see cref="Gameplay"/> or <see cref="UI"/> is active at any time once
/// the game has started; <see cref="None"/> is the initial state before the first context
/// transition, in which neither action map is enabled.
/// </summary>
public enum InputContext
{
    /// <summary>Initial state: no context active, neither action map enabled.</summary>
    None = 0,

    /// <summary>
    /// Driving context: OverdriveGameplay is the enabled action map and the
    /// InputSystemUIInputModule is disabled. OverdriveGameplay.Pause is observed for
    /// the pause edge that triggers the transition to <see cref="UI"/>.
    /// </summary>
    Gameplay = 1,

    /// <summary>
    /// Menu context: OverdriveUI is the enabled action map and the InputSystemUIInputModule
    /// is enabled, routing Confirm/Cancel/Navigate/Point/Click into the UI event system.
    /// </summary>
    UI = 2,
}
