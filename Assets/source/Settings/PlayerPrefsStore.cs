using Overdrive.Settings.Core;
using UnityEngine;

namespace Overdrive.Settings
{
    /// <summary>
    /// The Unity adapter that implements <see cref="IPlayerPrefsStore"/> over
    /// <c>UnityEngine.PlayerPrefs</c> (ADR-0004). This is the ONLY Unity-touching type in the
    /// persistence path — the engine-free core never references it.
    /// </summary>
    public sealed class PlayerPrefsStore : IPlayerPrefsStore
    {
        /// <inheritdoc />
        public string GetString(string key) => PlayerPrefs.GetString(key);

        /// <inheritdoc />
        public bool HasKey(string key) => PlayerPrefs.HasKey(key);

        /// <inheritdoc />
        public void SetString(string key, string value) => PlayerPrefs.SetString(key, value);

        /// <inheritdoc />
        public void Save() => PlayerPrefs.Save();
    }
}
