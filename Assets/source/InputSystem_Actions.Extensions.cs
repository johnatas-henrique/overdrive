namespace Overdrive.Input
{
    /// <summary>Compatibility aliases for the context names used by ADR-0005.</summary>
    public partial class InputSystem_Actions
    {
        /// <summary>Gets the OverdriveGameplay action-map wrapper.</summary>
        public OverdriveGameplayActions Gameplay => OverdriveGameplay;

        /// <summary>Gets the OverdriveUI action-map wrapper.</summary>
        public OverdriveUIActions UI => OverdriveUI;
    }
}
