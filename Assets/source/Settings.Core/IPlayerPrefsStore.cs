namespace Overdrive.Settings.Core
{
    /// <summary>
    /// The persistence seam between the engine-free settings core and the platform store
    /// (ADR-0004:54-63). The Unity adapter implements this over <c>UnityEngine.PlayerPrefs</c>;
    /// tests inject a fake that records the call sequence to verify backup-first atomicity.
    /// </summary>
    public interface IPlayerPrefsStore
    {
        /// <summary>Returns the string stored under the key, or null when absent.</summary>
        /// <param name="key">The storage key.</param>
        string GetString(string key);

        /// <summary>Returns whether the key exists in the store.</summary>
        /// <param name="key">The storage key.</param>
        bool HasKey(string key);

        /// <summary>Stores a string under the key. May throw on platform failure (simulating full storage).</summary>
        /// <param name="key">The storage key.</param>
        /// <param name="value">The value to store.</param>
        void SetString(string key, string value);

        /// <summary>Flushes pending writes to durable storage. Called explicitly after backup-first write (ADR-0004:62).</summary>
        void Save();
    }
}
