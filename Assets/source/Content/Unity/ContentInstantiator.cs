using System;
using UnityEngine;

namespace Overdrive.Content.Unity
{
    /// <summary>
    /// <see cref="IContentInstantiator"/> over <c>Object.Instantiate</c> /
    /// <c>Object.Destroy</c>. Only GameObjects are instantiable as track instances
    /// (fail-fast otherwise — a non-GameObject track root is a wiring defect).
    /// </summary>
    public sealed class ContentInstantiator : IContentInstantiator
    {
        /// <inheritdoc />
        public object Instantiate(object prefab)
        {
            if (prefab is GameObject prefabGo)
                return UnityEngine.Object.Instantiate(prefabGo);
            throw new InvalidOperationException($"Track root must be a GameObject, was: {prefab?.GetType().Name ?? "null"}.");
        }

        /// <inheritdoc />
        public void ReleaseInstance(object instance)
        {
            if (instance is UnityEngine.Object o && o != null)
                UnityEngine.Object.Destroy(o);
        }
    }
}
