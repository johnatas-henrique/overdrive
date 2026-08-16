using System;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Controls;

namespace Overdrive.Input
{
    /// <summary>
    /// Scheme arbitration responsibility of <see cref="InputContextController"/> (C11 split,
    /// 2026-08-15): the active device scheme, the ADR-0005 arbitration rules (KeyboardMouse
    /// default, last meaningful device wins, anti-oscillation, device-loss precedence), and
    /// the meaningfulness probes. Fields and construction live in the core partial; the
    /// profile (arbitration thresholds) is set by Settings via <see cref="SetControlProfile"/>.
    /// </summary>
    public sealed partial class InputContextController
    {
        /// <summary>Gets the currently active input device scheme (defaults to KeyboardMouse).</summary>
        public ControlScheme ActiveScheme => _activeScheme;

        /// <summary>Raised when the active scheme changes; prompt glyphs and pointer policy observe this.</summary>
        public event Action<ControlScheme> OnActiveSchemeChanged;

        /// <summary>
        /// Updates the active control profile used by scheme arbitration (the trigger/stick "meaningful"
        /// thresholds). The Settings epic passes the sanitized active profile here; until then the default
        /// profile (Input-owned trigger, ADR-0004) applies. This only affects the controller's arbitration
        /// thresholds — the tick pipeline receives its own profile via <see cref="TickProcessor"/>.
        /// </summary>
        public void SetControlProfile(ControlProfile profile)
        {
            _profile = profile;
        }

        /// <summary>
        /// Resolves the active input-device scheme for this Dynamic Update. Call once per render
        /// frame BEFORE <see cref="CaptureLatestRawSample"/> (explicit call order — the Simulation
        /// driver owns it, not Unity script execution order). Collects meaningful-event flags from
        /// the update's processed actions plus the current analog and pointer values, then applies
        /// ADR-0005 arbitration: KeyboardMouse default, last meaningful device wins, both meaningful
        /// in one update preserves the current scheme (anti-oscillation), and a scheme that lost its
        /// device loses arbitration (eligibility wins). Clears the pending Pause edge and raises
        /// <see cref="OnActiveSchemeChanged"/> only on an actual change.
        /// </summary>
        public ControlScheme ResolveActiveScheme()
        {
            bool keyboardEligible = Keyboard.current != null || Mouse.current != null;
            bool gamepadEligible = Gamepad.current != null;

            bool pointerMeaningful = IsKeyboardPointerMeaningful();
            if (pointerMeaningful)
            {
                // A pointer delta >= 2 px makes the pointer visible and counts as keyboard/mouse
                // meaningful → the KeyboardMouse scheme becomes active (Story 007 AC-48).
                ShowPointer();
            }

            bool keyboardMeaningful = _keyboardMeaningful || pointerMeaningful;
            bool gamepadMeaningful = _gamepadMeaningful || IsGamepadAnalogMeaningful();

            _keyboardMeaningful = false;
            _gamepadMeaningful = false;

            // Device-loss precedence (AC-62): a scheme that lost its device cannot be preserved,
            // regardless of anti-oscillation.
            if ((_activeScheme == ControlScheme.Gamepad && !gamepadEligible) ||
                (_activeScheme == ControlScheme.KeyboardMouse && !keyboardEligible))
            {
                if (keyboardEligible)
                {
                    return SetActiveScheme(ControlScheme.KeyboardMouse);
                }

                if (gamepadEligible)
                {
                    return SetActiveScheme(ControlScheme.Gamepad);
                }

                return _activeScheme;
            }

            // Anti-oscillation (AC-62): both schemes meaningful this update → keep the current.
            if (keyboardMeaningful && gamepadMeaningful)
            {
                return _activeScheme;
            }

            if (gamepadMeaningful)
            {
                return SetActiveScheme(ControlScheme.Gamepad);
            }

            if (keyboardMeaningful)
            {
                return SetActiveScheme(ControlScheme.KeyboardMouse);
            }

            return _activeScheme;
        }

        private ControlScheme SetActiveScheme(ControlScheme scheme)
        {
            if (scheme == _activeScheme)
            {
                return scheme;
            }

            _activeScheme = scheme;
            // AC-40: a pending Pause edge is consumed by the scheme change that triggered it.
            ConsumePendingPauseEdgeOnTransition();
            OnActiveSchemeChanged?.Invoke(scheme);
            return scheme;
        }

        private static bool IsAnySchemeEligible()
        {
            return (Keyboard.current != null || Mouse.current != null) || Gamepad.current != null;
        }

        private bool IsKeyboardPointerMeaningful()
        {
            return Mouse.current != null && Mouse.current.delta.magnitude >= PointerMeaningfulDeltaPixels;
        }

        private bool IsGamepadAnalogMeaningful()
        {
            if (Gamepad.current == null)
            {
                return false;
            }

            float accelerate = ReadGamepadAxis(_asset.Gameplay.Accelerate);
            float brake = ReadGamepadAxis(_asset.Gameplay.Brake);
            if (accelerate > _profile.TriggerInner ||
                brake > _profile.TriggerInner)
            {
                return true;
            }

            return IsStickMagnitudeMeaningful();
        }

        private bool IsStickMagnitudeMeaningful()
        {
            // Steer binds to a single gamepad stick (leftStick). If a future control profile
            // added a second stick to the action, this returns on whichever control the Input
            // System enumerates first — acceptable today, revisit if Story 008 allows stick rebinding.
            foreach (InputControl control in _asset.Gameplay.Steer.controls)
            {
                if (control.parent is StickControl stick && stick.device is Gamepad)
                {
                    Vector2 raw = stick.ReadUnprocessedValue();
                    return raw.magnitude > _profile.StickInner;
                }
            }

            return false;
        }

        /// <summary>Flags a meaningful digital event by the device that produced it.</summary>
        private void FlagMeaningfulFromDevice(InputControl control)
        {
            if (control?.device is Gamepad)
            {
                _gamepadMeaningful = true;
            }
            else
            {
                _keyboardMeaningful = true;
            }
        }

        private static float ReadGamepadAxis(InputAction action)
        {
            foreach (InputControl control in action.controls)
            {
                if (control is InputControl<float> axis && control.device is Gamepad)
                {
                    // ReadUnprocessedValue bypasses embedded processors (e.g. the StickControl's
                    // axisDeadzone on leftStick/x); triggers carry none but the call is uniform.
                    return axis.ReadUnprocessedValue();
                }
            }

            return 0f;
        }
    }
}
