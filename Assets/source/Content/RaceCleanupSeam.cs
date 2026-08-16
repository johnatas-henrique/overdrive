using System;

namespace Overdrive.Content
{
    /// <summary>
    /// Concrete <see cref="IContentCleanupSeam"/> (Story 004 — Race Unload): the SM calls
    /// <see cref="BeginCleanup"/> when entering CP_Unloading on BOTH the unload path
    /// (<c>OnContentUnloadRequested</c>) and the error path (<c>ReportLoadError</c>); this
    /// implementation performs the real release through the injected
    /// <see cref="IContentReleaser"/> port and then echoes the SM-generated
    /// <paramref name="cleanupId"/> back via <c>ContentStateMachine.ReportCleanupComplete</c>
    /// — the ONLY trigger for <c>ContentUnloadComplete</c> (unload path) or
    /// <c>ContentLoadError</c> (error path, cleanup-before-error AC-SM4).
    /// </summary>
    /// <remarks>
    /// Depends on the concrete <see cref="ContentStateMachine"/> (same engine-free assembly;
    /// <c>ReportCleanupComplete</c> is a public inbound method of its documented contract).
    /// The construction cycle (SM needs the seam; the seam needs the SM) is broken by the
    /// composition root's late-bound <c>CleanupSeamProxy</c> — the SM is constructed first
    /// with the proxy, then this seam is constructed with the SM and bound to the proxy.
    /// </remarks>
    public sealed class RaceCleanupSeam : IContentCleanupSeam
    {
        private readonly IContentReleaser _releaser;
        private readonly ContentStateMachine _sm;

        /// <summary>Creates the seam; <paramref name="releaser"/> performs the release, <paramref name="sm"/> receives the completion echo.</summary>
        public RaceCleanupSeam(IContentReleaser releaser, ContentStateMachine sm)
        {
            _releaser = releaser ?? throw new ArgumentNullException(nameof(releaser));
            _sm = sm ?? throw new ArgumentNullException(nameof(sm));
        }

        /// <inheritdoc />
        public void BeginCleanup(int cleanupId)
        {
            _releaser.ReleaseAll();
            _sm.ReportCleanupComplete(cleanupId);
        }
    }
}
