using System;

namespace Overdrive.Settings.Core
{
    /// <summary>
    /// A persisted binding override (mirror of <c>Overdrive.Input.BindingOverride</c> — the shipped
    /// Input contract, 2 fields, which governs over the draft 4-field ADR-0004 form; ActionId is
    /// derivable from the catalog and IsReserved is a catalog property, never persisted). The core
    /// defines its own minimal type so the engine-free assembly does not depend on Input.
    /// </summary>
    public readonly struct BindingOverrideData
    {
        /// <summary>Creates a binding override.</summary>
        /// <param name="bindingId">The stable InputBinding Guid.</param>
        /// <param name="path">The control path to apply.</param>
        public BindingOverrideData(Guid bindingId, string path)
        {
            BindingId = bindingId;
            Path = path;
        }

        /// <summary>The stable InputBinding Guid.</summary>
        public Guid BindingId { get; }

        /// <summary>The control path to apply.</summary>
        public string Path { get; }
    }
}
