using System;

namespace Overdrive.Content
{
    /// <summary>
    /// Presentation surface for the loading screen. Content drives the lifecycle
    /// through this port; the visual implementation (layout, text, spinner, VFX,
    /// dismiss animation) is owned by the UI Menu epic (ui-menu.md). All members
    /// are fire-and-forget: exceptions thrown by an implementation are swallowed
    /// by the controller (SafePublish — AC-LS8/EC9) and never affect loading.
    /// </summary>
    public interface ILoadingScreenPresenter
    {
        /// <summary>Shows a progress value in [0, 1]. Content guarantees monotonicity (AC-LS2).</summary>
        void ShowProgress(float progress);

        /// <summary>Shows the first-launch catalog state: "Preparing..." with spinner (AC-LS6).</summary>
        void ShowPreparing();

        /// <summary>Signals successful load completion; the UI Menu handles its own 300ms fade (AC-LS4).</summary>
        void OnLoadComplete();

        /// <summary>Shows the error banner (200ms fade per UX loading.md).</summary>
        void OnLoadError(string reason);

        /// <summary>True while loading blocks input (AC-LS5). Enforcement is UI/Input-owned; this reports the state.</summary>
        bool InputBlocked { get; }
    }
}
