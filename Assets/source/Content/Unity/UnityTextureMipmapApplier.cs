using UnityEngine;
using Overdrive.Content;

namespace Overdrive.Content.Unity
{
    /// <summary>
    /// Unity-backed <see cref="ITextureMipmapApplier"/> (story 3-14): writes
    /// <c>QualitySettings.globalTextureMipmapLimit</c>. Settable in PlayMode (unlike
    /// Screen.SetResolution), so the real applier IS integration-testable; the editor
    /// does not need to enter PlayMode for the write to take effect on loaded textures.
    /// </summary>
    public sealed class UnityTextureMipmapApplier : ITextureMipmapApplier
    {
        /// <summary>Last limit applied (test observability; -1 = never applied).</summary>
        public int LastApplied { get; private set; } = -1;

        /// <inheritdoc />
        public void Apply(int limit)
        {
            QualitySettings.globalTextureMipmapLimit = limit;
            LastApplied = limit;
        }
    }
}
