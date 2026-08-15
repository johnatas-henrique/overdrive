using System;
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

namespace Overdrive.Content.Unity
{
    /// <summary><see cref="ICatalogInitializer"/> over <c>Addressables.InitializeAsync</c>.</summary>
    public sealed class CatalogInitializer : ICatalogInitializer
    {
        /// <summary>Creates the initializer.</summary>
        public CatalogInitializer()
        {
        }

        /// <inheritdoc />
        public void Initialize(Action<CatalogInitResult> onComplete)
        {
            if (onComplete == null)
                throw new ArgumentNullException(nameof(onComplete));

            var handle = Addressables.InitializeAsync();
            handle.Completed += op => onComplete(new CatalogInitResult(
                op.Status == AsyncOperationStatus.Succeeded,
                op.OperationException?.Message ?? string.Empty));
            // The init handle is consumed inside the completion (never retained — only the
            // Shared handle is retained lifelong, per the Story 005 contract).
        }
    }

    /// <summary>
    /// <see cref="ISharedLoader"/> over the Shared bootstrap sentinel
    /// (<c>AddressableKeys.SharedBootstrap</c>, concrete <c>GameObject</c> type — a wrong
    /// asset type in the bundle is a real type-mismatch error, never silently accepted).
    /// The handle is RETAINED for the app lifetime (GDD:54 — Shared persists for the session).
    /// </summary>
    public sealed class SharedLoader : ISharedLoader, IDisposable
    {
        private AsyncOperationHandle<GameObject> _retained;
        private bool _retainedValid;

        /// <inheritdoc />
        public void LoadShared(Action<SharedLoadResult> onComplete)
        {
            if (onComplete == null)
                throw new ArgumentNullException(nameof(onComplete));
            if (_retainedValid)
            {
                onComplete(new SharedLoadResult(true, string.Empty));
                return;
            }

            var handle = Addressables.LoadAssetAsync<GameObject>(AddressableKeys.SharedBootstrap);
            handle.Completed += op =>
            {
                if (op.Status == AsyncOperationStatus.Succeeded)
                {
                    _retained = op;
                    _retainedValid = true;
                    onComplete(new SharedLoadResult(true, string.Empty));
                }
                else
                {
                    onComplete(new SharedLoadResult(false, op.OperationException?.Message ?? "Shared load failed"));
                }
            };
        }

        /// <summary>Releases the retained Shared handle (app teardown only).</summary>
        public void Dispose()
        {
            if (_retainedValid)
            {
                Addressables.Release(_retained);
                _retainedValid = false;
            }
        }
    }

    /// <summary>
    /// <see cref="IFatalErrorHandler"/> — logs the error and closes the app
    /// (GDD:193/:202 "show error and close"). <c>Application.Quit</c> is a NO-OP in the
    /// Editor (Unity-documented), so tests never terminate; production builds close.
    /// </summary>
    public sealed class FatalErrorHandler : IFatalErrorHandler
    {
        /// <inheritdoc />
        public void Fatal(string reason, Overdrive.Simulation.ContentErrorType type)
        {
            Debug.LogError($"[Content] FATAL ({type}): {reason}");
            Application.Quit(0);
        }
    }

    /// <summary><see cref="IFocusSeam"/> over <c>Application.isFocused</c> + <c>Application.focusChanged</c>.</summary>
    public sealed class FocusSeam : IFocusSeam
    {
        /// <inheritdoc />
        public bool IsFocused => Application.isFocused;

        /// <inheritdoc />
        public event Action<bool> FocusChanged
        {
            add => Application.focusChanged += value;
            remove => Application.focusChanged -= value;
        }
    }
}
