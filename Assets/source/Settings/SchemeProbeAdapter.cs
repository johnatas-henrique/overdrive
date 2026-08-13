using System;
using Overdrive.Input;
using Overdrive.Settings.Core;

namespace Overdrive.Settings
{
    /// <summary>
    /// Read-only active-scheme probe backed by <see cref="InputContextController.ActiveScheme"/>
    /// (AC-E11). Settings never mutates the probe; scheme arbitration on device reconnect remains
    /// InputContextController's domain (ADR-0005). Converts the Input assembly's
    /// <see cref="Overdrive.Input.ControlScheme"/> to the engine-free core enum at the boundary.
    /// </summary>
    public sealed class SchemeProbeAdapter : ISchemeProbe
    {
        private readonly InputContextController _controller;

        /// <summary>Creates the probe.</summary>
        /// <param name="controller">The Input context controller (sole action-map owner).</param>
        /// <exception cref="ArgumentNullException"><paramref name="controller"/> is null.</exception>
        public SchemeProbeAdapter(InputContextController controller)
        {
            _controller = controller ?? throw new ArgumentNullException(nameof(controller));
        }

        /// <summary>The currently active scheme, converted to the core enum.</summary>
        public Overdrive.Settings.Core.ControlScheme ActiveScheme => Convert(_controller.ActiveScheme);

        private static Overdrive.Settings.Core.ControlScheme Convert(Overdrive.Input.ControlScheme scheme)
        {
            switch (scheme)
            {
                case Overdrive.Input.ControlScheme.Gamepad:
                    return Overdrive.Settings.Core.ControlScheme.Gamepad;
                default:
                    return Overdrive.Settings.Core.ControlScheme.KeyboardMouse;
            }
        }
    }
}
