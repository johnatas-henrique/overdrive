using UnityEngine;

namespace Overdrive.Content.Tests.Fixtures
{
    /// <summary>
    /// Committed fixture ScriptableObject for story 3-8 topology tests. Two optional
    /// reference fields create real serialized dependency edges observed by
    /// <c>AssetDatabase.GetDependencies</c>: <see cref="CrossCarReference"/> is non-null
    /// only on car A's fixture (points at car B's asset — the cross-car violation),
    /// <see cref="SharedReference"/> is non-null only on car C's fixture (points at a
    /// Shared asset — the allowed shared dependency).
    /// </summary>
    [CreateAssetMenu(fileName = "CarFixtureData", menuName = "Overdrive Tests/Car Fixture Data")]
    public sealed class CarFixtureData : ScriptableObject
    {
        /// <summary>Cross-car reference — set only on car A's fixture (violation edge).</summary>
        [SerializeField] private UnityEngine.Object crossCarReference;
        /// <summary>Shared reference — set only on car C's fixture (allowed edge).</summary>
        [SerializeField] private UnityEngine.Object sharedReference;

        /// <summary>True when this fixture carries the cross-car reference (car A).</summary>
        public bool HasCrossCarReference => crossCarReference != null;

        /// <summary>True when this fixture carries the shared reference (car C).</summary>
        public bool HasSharedReference => sharedReference != null;
    }
}
