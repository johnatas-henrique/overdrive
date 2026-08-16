using System;
using System.Collections.Generic;

namespace Overdrive.Content
{
    /// <summary>
    /// Canonical content topology manifest model (Story 3-8). JSON-deserializable via
    /// <c>JsonUtility.FromJson&lt;ContentTopologyData&gt;</c> — <see cref="SerializableAttribute"/>
    /// classes with public fields, <see cref="List{T}"/> collections, no dictionaries,
    /// no properties-only members. Lives at <c>Assets/Settings/Content/topology.json</c>.
    /// </summary>
    [Serializable]
    public sealed class ContentTopologyData
    {
        /// <summary>All 21 groups (Shared + 16 Cars + 4 Tracks) — the canonical list.</summary>
        public List<ContentTopologyGroup> groups = new List<ContentTopologyGroup>();

        /// <summary>Full project group count (21).</summary>
        public int expectedGroupCount;

        /// <summary>True: car-group dependencies on Shared assets are allowed.</summary>
        public bool allowedSharedDependencies;

        /// <summary>True: car-group dependencies on another car bundle are forbidden.</summary>
        public bool forbiddenCrossCarDependencies;
    }

    /// <summary>
    /// One Addressable group's topology contract. <see cref="name"/> mirrors the group name;
    /// <see cref="rootAddress"/> + <see cref="rootPath"/> identify the group's root entry
    /// (Shared omits both). <see cref="allowedTypes"/> (labels like "Prefab") and
    /// <see cref="allowedPaths"/> (project-relative globs) are the membership predicates.
    /// </summary>
    [Serializable]
    public sealed class ContentTopologyGroup
    {
        /// <summary>Group name, e.g. <c>Shared</c>, <c>Cars/team_tier4_d</c>, <c>Tracks/monaco</c>.</summary>
        public string name;

        /// <summary>Category: <c>Shared</c>, <c>Cars</c>, or <c>Tracks</c> (first path segment).</summary>
        public string category;

        /// <summary>Root entry's expected address, e.g. <c>Cars/team_tier4_d/CarDefinition</c>. Null for Shared.</summary>
        public string rootAddress;

        /// <summary>Root entry's project-relative asset path, e.g. <c>Assets/Cars/team_tier4_d/CarDefinition.prefab</c>. Omitted for Shared.</summary>
        public string rootPath;

        /// <summary>Optional type labels ("Prefab", "AudioClip", "Shader", "Texture2D") for the Shared group.</summary>
        public List<string> allowedTypes = new List<string>();

        /// <summary>Project-relative path globs, e.g. <c>Assets/Cars/team_tier4_d/**</c>.</summary>
        public List<string> allowedPaths = new List<string>();
    }
}
