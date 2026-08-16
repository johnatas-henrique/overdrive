using System;
using System.Collections.Generic;
using UnityEngine.InputSystem;

namespace Overdrive.Input
{
    /// <summary>Outcome of classifying a remap candidate during Settings Listening (AC-10).</summary>
    public enum RemapResult
    {
        /// <summary>Valid, non-conflicting candidate — the override is applied.</summary>
        Captured,

        /// <summary>Candidate conflicts with an existing NON-reserved binding.</summary>
        Conflict,

        /// <summary>Candidate is reserved (Confirm/Cancel/Pause), malformed, or exceeds a slot limit.</summary>
        Rejected
    }

    /// <summary>One rebindable binding exposed to Settings, identified by its stable InputBinding Guid.</summary>
    public readonly struct BindingSlot
    {
        /// <summary>Creates a slot.</summary>
        /// <param name="id">The stable InputBinding Guid.</param>
        /// <param name="actionName">The owning action name.</param>
        /// <param name="displayName">Human-readable name for the Settings UI.</param>
        /// <param name="currentPath">The current effective control path.</param>
        /// <param name="isReserved">Whether this is a fixed Confirm/Cancel/Pause binding.</param>
        public BindingSlot(Guid id, string actionName, string displayName, string currentPath, bool isReserved)
        {
            Id = id;
            ActionName = actionName;
            DisplayName = displayName;
            CurrentPath = currentPath;
            IsReserved = isReserved;
        }

        /// <summary>The stable InputBinding Guid used for overrides.</summary>
        public Guid Id { get; }

        /// <summary>The owning action name.</summary>
        public string ActionName { get; }

        /// <summary>Human-readable name for the Settings UI.</summary>
        public string DisplayName { get; }

        /// <summary>The current effective control path (including any override).</summary>
        public string CurrentPath { get; }

        /// <summary>True for a fixed reserved binding (Confirm, Cancel, Pause) that cannot be replaced or removed.</summary>
        public bool IsReserved { get; }
    }

    /// <summary>A persisted override: a stable binding id plus the control path to apply (AC-66/AC-67).</summary>
    public readonly struct BindingOverride
    {
        /// <summary>Creates an override.</summary>
        /// <param name="bindingId">The stable InputBinding Guid to override.</param>
        /// <param name="path">The control path to apply.</param>
        public BindingOverride(Guid bindingId, string path)
        {
            BindingId = bindingId;
            Path = path;
        }

        /// <summary>The stable InputBinding Guid.</summary>
        public Guid BindingId { get; }

        /// <summary>The control path to apply.</summary>
        public string Path { get; }
    }

    /// <summary>
    /// Exposes the remappable and reserved binding slots to Settings and applies per-slot overrides keyed by
    /// stable InputBinding Guid (AC-10/AC-29/AC-46/AC-66/AC-67). The catalog is the Input-side contract:
    /// Settings UI/persistence (Settings epic) consumes these slots and calls <see cref="TryRebind"/> /
    /// <see cref="ApplyOverrides"/>; the catalog never persists. Reserved Confirm/Cancel/Pause bindings cannot
    /// be replaced or removed.
    /// </summary>
    public sealed class InputBindingCatalog
    {
        /// <summary>Maximum active overrides per action (AC-10 "exceeded"): a second override on the same action is rejected.</summary>
        public const int MaxOverridesPerAction = 1;

        private readonly Dictionary<Guid, (InputAction action, int bindingIndex)> _bindingMap;
        private readonly List<BindingSlot> _remappableSlots;
        private readonly List<BindingSlot> _reservedSlots;
        private readonly Dictionary<string, int> _overridesPerAction;

        /// <summary>Creates the catalog from the input action asset, indexing every binding slot by stable id.</summary>
        /// <param name="asset">The input action asset (Overdrive.Input InputSystem_Actions.asset).</param>
        /// <exception cref="ArgumentNullException"><paramref name="asset"/> is null.</exception>
        public InputBindingCatalog(InputActionAsset asset)
        {
            if (asset == null)
            {
                throw new ArgumentNullException(nameof(asset));
            }

            _bindingMap = new Dictionary<Guid, (InputAction, int)>();
            _remappableSlots = new List<BindingSlot>();
            _reservedSlots = new List<BindingSlot>();
            _overridesPerAction = new Dictionary<string, int>();

            IndexAsset(asset);
        }

        /// <summary>The slots the player may rebind (Accelerate, Brake, Steer Left/Right, CameraToggle).</summary>
        public IReadOnlyList<BindingSlot> RemappableSlots => _remappableSlots;

        /// <summary>The fixed reserved slots (Confirm, Cancel, Pause) that cannot be rebound.</summary>
        public IReadOnlyList<BindingSlot> ReservedSlots => _reservedSlots;

        /// <summary>
        /// Resolves the stable Input action GUID that owns a binding (the story's BindingTarget.ActionId).
        /// Returns <see cref="Guid.Empty"/> when the binding id matches no known binding.
        /// </summary>
        /// <param name="bindingId">The stable InputBinding Guid.</param>
        /// <returns>The owning Input action's stable id, or <see cref="Guid.Empty"/> if unknown.</returns>
        public Guid GetActionId(Guid bindingId)
        {
            return _bindingMap.TryGetValue(bindingId, out (InputAction action, int bindingIndex) entry) ? entry.action.id : Guid.Empty;
        }

        /// <summary>Whether a binding id is indexed (known to the current asset).</summary>
        /// <param name="bindingId">The stable InputBinding Guid.</param>
        public bool HasBinding(Guid bindingId)
        {
            return _bindingMap.ContainsKey(bindingId);
        }

        /// <summary>
        /// Classifies a remap candidate without applying it (AC-10). Returns <see cref="RemapResult.Captured"/>,
        /// <see cref="RemapResult.Conflict"/>, or <see cref="RemapResult.Rejected"/> (reserved slot, malformed
        /// path, conflict with a reserved binding, or the action at its override cap). No gameplay edge is queued.
        /// </summary>
        /// <param name="slotId">The stable id of the slot being rebound.</param>
        /// <param name="path">The candidate control path.</param>
        public RemapResult ClassifyCandidate(Guid slotId, string path)
        {
            if (!_bindingMap.TryGetValue(slotId, out var target))
            {
                return RemapResult.Rejected;
            }

            if (IsReservedSlot(slotId))
            {
                return RemapResult.Rejected; // AC-46
            }

            if (string.IsNullOrEmpty(path) || !ResolvesToControl(path))
            {
                return RemapResult.Rejected; // malformed
            }

            if (IsAtOverrideCap(target.action.name, slotId))
            {
                return RemapResult.Rejected; // exceeded (AC-10)
            }

            if (ConflictsWithReserved(path))
            {
                return RemapResult.Rejected; // AC-29
            }

            if (ConflictsWithRemappable(path, slotId))
            {
                return RemapResult.Conflict; // AC-10
            }

            return RemapResult.Captured;
        }

        /// <summary>
        /// Applies a rebind when the candidate is <see cref="RemapResult.Captured"/> (AC-10/AC-66). Mutates the
        /// in-memory asset immediately; the override is keyed by the stable binding id so only that slot changes.
        /// </summary>
        /// <param name="slotId">The stable id of the slot being rebound.</param>
        /// <param name="path">The candidate control path.</param>
        /// <returns>Captured if the override was applied; otherwise the rejection/conflict reason.</returns>
        public RemapResult TryRebind(Guid slotId, string path)
        {
            RemapResult result = ClassifyCandidate(slotId, path);
            if (result == RemapResult.Captured)
            {
                (InputAction action, int bindingIndex) = _bindingMap[slotId];
                bool hadOverride = !string.IsNullOrEmpty(action.bindings[bindingIndex].overridePath);
                action.ApplyBindingOverride(bindingIndex, path);
                RefreshSlotPath(slotId);

                // Substitution on an already-overridden slot does not add a NEW override — the count
                // stays (AC-10 accounting: one override per action, replacement is not an increment).
                if (!hadOverride)
                {
                    _overridesPerAction[action.name] = OverrideCount(action.name) + 1;
                }
            }

            return result;
        }

        /// <summary>
        /// Applies a batch of persisted overrides (AC-67). An override whose stable id no longer matches any
        /// current binding is discarded and reported; a known id whose path is malformed, reserved-conflicting,
        /// or at the override cap is also reported as not applied. Valid overrides remain active.
        /// </summary>
        /// <param name="overrides">The persisted override list.</param>
        /// <returns>The ids that were NOT applied (unknown id, malformed path, reserved conflict, or cap violation).</returns>
        public Guid[] ApplyOverrides(IReadOnlyList<BindingOverride> overrides)
        {
            List<Guid> notApplied = new List<Guid>();
            if (overrides == null)
            {
                return notApplied.ToArray();
            }

            foreach (BindingOverride entry in overrides)
            {
                if (_bindingMap.ContainsKey(entry.BindingId))
                {
                    // A known id whose path is malformed, reserved-conflicting, or at the override cap is
                    // also reported: only an actually-applied override is excluded.
                    RemapResult result = TryRebind(entry.BindingId, entry.Path);
                    if (result != RemapResult.Captured)
                    {
                        notApplied.Add(entry.BindingId);
                    }
                }
                else
                {
                    notApplied.Add(entry.BindingId);
                }
            }

            return notApplied.ToArray();
        }

        /// <summary>
        /// Removes the override on a slot, restoring its default path (AC-46 "removed" flow). A reserved slot
        /// is never removed.
        /// </summary>
        /// <param name="slotId">The stable id of the slot to reset.</param>
        /// <returns>True if an override was removed; false if the slot had none or is reserved.</returns>
        public bool RemoveOverride(Guid slotId)
        {
            if (IsReservedSlot(slotId) || !_bindingMap.TryGetValue(slotId, out var target))
            {
                return false;
            }

            InputBinding binding = target.action.bindings[target.bindingIndex];
            if (string.IsNullOrEmpty(binding.overridePath))
            {
                return false;
            }

            target.action.RemoveBindingOverride(target.bindingIndex);
            RefreshSlotPath(slotId);
            _overridesPerAction[target.action.name] = Math.Max(0, OverrideCount(target.action.name) - 1);
            return true;
        }

        private void RefreshSlotPath(Guid slotId)
        {
            if (!_bindingMap.TryGetValue(slotId, out (InputAction action, int bindingIndex) entry))
            {
                return;
            }

            InputBinding binding = entry.action.bindings[entry.bindingIndex];
            string effective = binding.overridePath ?? binding.path;
            for (int i = 0; i < _remappableSlots.Count; i++)
            {
                if (_remappableSlots[i].Id == slotId)
                {
                    BindingSlot current = _remappableSlots[i];
                    _remappableSlots[i] = new BindingSlot(current.Id, current.ActionName, current.DisplayName, effective, current.IsReserved);
                    return;
                }
            }
        }

        private static bool ResolvesToControl(string path)
        {
            return InputSystem.FindControl(path) != null;
        }

        private bool IsReservedSlot(Guid slotId)
        {
            foreach (BindingSlot slot in _reservedSlots)
            {
                if (slot.Id == slotId)
                {
                    return true;
                }
            }

            return false;
        }

        private bool IsAtOverrideCap(string actionName, Guid slotId)
        {
            if (OverrideCount(actionName) < MaxOverridesPerAction)
            {
                return false;
            }

            // At the cap already: substituting the override on THIS slot is allowed (a player re-rebinds
            // an already-customized slot); only a NEW slot of the same action hits the cap.
            return !HasOverride(slotId);
        }

        private bool HasOverride(Guid slotId)
        {
            if (!_bindingMap.TryGetValue(slotId, out (InputAction action, int bindingIndex) entry))
            {
                return false;
            }

            return !string.IsNullOrEmpty(entry.action.bindings[entry.bindingIndex].overridePath);
        }

        private int OverrideCount(string actionName)
        {
            return _overridesPerAction.TryGetValue(actionName, out int count) ? count : 0;
        }

        private bool ConflictsWithReserved(string path)
        {
            foreach (BindingSlot slot in _reservedSlots)
            {
                if (string.Equals(slot.CurrentPath, path, StringComparison.Ordinal))
                {
                    return true;
                }
            }

            return false;
        }

        private bool ConflictsWithRemappable(string path, Guid exceptSlotId)
        {
            foreach (BindingSlot slot in _remappableSlots)
            {
                if (slot.Id == exceptSlotId)
                {
                    continue;
                }

                if (string.Equals(slot.CurrentPath, path, StringComparison.Ordinal))
                {
                    return true;
                }
            }

            return false;
        }

        private void IndexAsset(InputActionAsset asset)
        {
            foreach (InputActionMap map in asset.actionMaps)
            {
                foreach (InputAction action in map.actions)
                {
                    IndexAction(action);
                }
            }
        }

        private void IndexAction(InputAction action)
        {
            bool isReserved = IsReservedAction(action);
            int compositeOrdinal = 0;
            IReadOnlyList<InputBinding> bindings = action.bindings;

            for (int i = 0; i < bindings.Count; i++)
            {
                InputBinding binding = bindings[i];
                if (binding.isComposite)
                {
                    compositeOrdinal++;
                    continue;
                }

                // Seed the per-action override count from overrides already present on the asset, so a
                // catalog built over an already-customized asset respects the cap from construction.
                if (!string.IsNullOrEmpty(binding.overridePath))
                {
                    _overridesPerAction[action.name] = OverrideCount(action.name) + 1;
                }

                string displayName = BuildDisplayName(action, binding, isReserved, compositeOrdinal);
                var slot = new BindingSlot(binding.id, action.name, displayName, binding.overridePath ?? binding.path, isReserved);

                if (isReserved)
                {
                    _reservedSlots.Add(slot);
                }
                else
                {
                    _remappableSlots.Add(slot);
                }

                _bindingMap[binding.id] = (action, i);
            }
        }

        private static bool IsReservedAction(InputAction action)
        {
            switch (action.name)
            {
                case "Confirm":
                case "Cancel":
                case "Pause":
                    return true;
                default:
                    return false;
            }
        }

        private static string BuildDisplayName(InputAction action, InputBinding binding, bool isReserved, int compositeOrdinal)
        {
            if (isReserved)
            {
                return action.name;
            }

            if (!binding.isPartOfComposite)
            {
                return action.name;
            }

            string suffix = compositeOrdinal > 1 ? " Secondary" : string.Empty;
            return binding.name == "Negative" ? $"Steer Left{suffix}" : $"Steer Right{suffix}";
        }
    }
}
