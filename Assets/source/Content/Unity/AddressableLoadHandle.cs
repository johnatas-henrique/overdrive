using System;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

namespace Overdrive.Content.Unity
{
    /// <summary>
    /// <see cref="IAddressableLoader"/> implementation over <c>Addressables.LoadAssetAsync</c>
    /// (Addressables 3.1.0). The <see cref="AddressableLoadHandle"/> wrapper is delivered to
    /// the completion callback; the engine-free orchestrator never sees the raw
    /// <c>AsyncOperationHandle</c>.
    /// </summary>
    public sealed class AddressableLoader : IAddressableLoader
    {
        /// <summary>Starts an async load of <paramref name="key"/> as a UnityEngine.Object; <paramref name="onComplete"/> fires once when the handle finishes.</summary>
        public IAsyncLoadHandle LoadAssetAsync(object key, Action<IAsyncLoadHandle> onComplete)
        {
            if (key == null)
                throw new ArgumentNullException(nameof(key));
            var handle = Addressables.LoadAssetAsync<UnityEngine.Object>(key);
            var wrapper = new AddressableLoadHandle(handle);
            handle.Completed += _ => onComplete(wrapper);
            return wrapper;
        }
    }

    /// <summary>
    /// <see cref="IAsyncLoadHandle"/> (+ per-handle <see cref="IDownloadStatusSource"/>)
    /// over an <c>AsyncOperationHandle&lt;UnityEngine.Object&gt;</c>.
    /// </summary>
    public sealed class AddressableLoadHandle : IAsyncLoadHandle
    {
        private readonly AsyncOperationHandle<UnityEngine.Object> _handle;

        /// <summary>Wraps the raw Addressables handle.</summary>
        public AddressableLoadHandle(AsyncOperationHandle<UnityEngine.Object> handle)
        {
            _handle = handle;
        }

        /// <inheritdoc />
        public bool IsDone => _handle.IsDone;

        /// <inheritdoc />
        public object Result => _handle.IsValid() ? _handle.Result : null;

        /// <inheritdoc />
        public Exception OperationException => _handle.IsValid() ? _handle.OperationException : null;

        /// <inheritdoc />
        public (long DownloadedBytes, long TotalBytes) GetDownloadStatus()
        {
            if (!_handle.IsValid())
                return (0L, 0L);
            var status = _handle.GetDownloadStatus();
            return (status.DownloadedBytes, status.TotalBytes);
        }

        /// <inheritdoc />
        public void Release()
        {
            if (_handle.IsValid())
                Addressables.Release(_handle);
        }
    }
}
