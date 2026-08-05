// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is the arcade grip (ADR-0002) fun and responsive enough to sustain the 30s loop?
// Date: 2026-08-01
//
// 2026-08-03: Track visuals rebuilt from CartoonTracksPack1 assets (user-approved):
//  - Road uses the CLEAR asphalt band (1TARMAC_inner region, V 0.50-0.75, ~2x lighter
//    than the oval band) cut from road.psd at y 2048-4096 (8192x2048), with normal map.
//    The package texture is an ATLAS (U draws the whole oval) - tiling it repeats the
//    same 68 m of asphalt with a visible seam, so we use a continuous U mapping
//    (traveled / trackLength) instead of tile repeat.
//  - Outer grass = GRASS_1 (7 m band each side), inner grass = GRASS_2 filling the
//    whole infield (oval only).
//  - Inner walls REMOVED (infield fully open per user decision 2026-08-03).
//  - Outer walls = CartoonTracksPack1 wall prefabs: A on box straight (z=-70),
//    B on opposite straight (z=+70), C on first turn (x=+200), D on second (x=-200).
//    Each instance gets a BoxCollider sized to its mesh + zero-friction material.
//  - Speed markers, kerbs, checkered finish line removed (asset props come next).

using System.Collections.Generic;
using UnityEngine;

namespace RaceFeel
{
    /// <summary>
    /// Simple procedural track for the prototype: an oval with two straights
    /// and two wide turns. Builds a finish-line trigger automatically; the
    /// controller owns lap counting and timing.
    /// </summary>
    public class PrototypeTrack : MonoBehaviour
    {
        public enum TrackVariant { Oval, Spa }

        [Header("Layout")]
        [SerializeField] TrackVariant variant = TrackVariant.Oval;

        [Header("Geometry")]
        [SerializeField] float straightLength = 400f;   // m per straight (long enough to reach top speed)
        [SerializeField] float turnRadius = 70f;        // m corner radius
        [SerializeField] float trackWidth = 14f;        // m lane width (arcade: wider = more room to err, 2026-08-02)
        [SerializeField] float grassWidth = 7f;         // m grass runoff on each side (walls sit past it)
        [SerializeField] int segmentsPerTurn = 128;     // smoothness of curves
        [Header("Spawn")]
        [SerializeField] Vector3 startPosition = new Vector3(-8f, 0.5f, -66.5f); // POLE POSITION: grid slot 1, 8 m behind the start line (x=0)
        [SerializeField] Vector3 startRotation = new Vector3(0f, 90f, 0f); // +X: along the bottom straight

        [Header("Materials (CartoonTracksPack1)")]
        [SerializeField] Material roadMaterial;    // clear asphalt band cut (RoadClear)
        [SerializeField] Material grassOuterMaterial; // GRASS_1: outer grass band
        [SerializeField] Material grassInnerMaterial; // GRASS_2: infield (oval only)
        [SerializeField] float roadTileLength = 68f;  // m per U repeat (matches package: 1501m / 22)

        [Header("Wall Prefabs (CartoonTracksPack1)")]
        [SerializeField] GameObject wallPrefabA; // 4m, box straight
        [SerializeField] GameObject wallPrefabB; // 4m, opposite straight
        [SerializeField] GameObject wallPrefabC; // 2.9m, first turn
        [SerializeField] GameObject wallPrefabD; // 2m, second turn
        [SerializeField] float wallOffset = 14f; // m from centerline (halfWidth + grassWidth)

        [Header("Start Grid (CartoonTracksPack1)")]
        [SerializeField] GameObject startLinePrefab;   // prop_startline: white line across the track (14 m)
        [SerializeField] GameObject startLightsPrefab; // prop_startlights: gantry over the start line
        [SerializeField] GameObject gridLinePrefab;    // prop_gridline: per-slot grid line (3.3 m)
        [SerializeField] Material edgeLineMaterial;    // ROAD_MARKS: white edge lines

        List<Vector3> _centerline = new List<Vector3>();
        RaceFeelController _controller;
        bool _built;

        public Vector3 StartPosition => variant == TrackVariant.Spa
            ? _centerline[0] + Vector3.up * 0.5f
            : startPosition;

        public Quaternion StartRotation => variant == TrackVariant.Spa
            ? Quaternion.LookRotation(FinishLineDirection, Vector3.up)
            : Quaternion.Euler(startRotation);

        /// <summary>Center of the start/finish line (first centerline point).</summary>
        public Vector3 FinishLinePosition => _centerline.Count > 0 ? _centerline[0] : Vector3.zero;

        /// <summary>Half the road width (asphalt edge).</summary>
        public float HalfWidth => trackWidth * 0.5f;

        /// <summary>
        /// Signed lateral distance from the centerline: positive = right side
        /// of the travel direction, negative = left. Used by the car to
        /// detect off-track (grass) for grip/decel behavior.
        /// </summary>
        public float GetLateralOffset(Vector3 worldPos)
        {
            if (_centerline.Count < 2) return 0f;
            int idx = ClosestCenterlineIndex(worldPos);
            int start = Mathf.Max(0, idx - 1);
            int end = Mathf.Min(_centerline.Count - 2, idx + 1);
            float bestSq = float.MaxValue;
            Vector3 bestProj = Vector3.zero;
            Vector3 bestRight = Vector3.right;
            for (int i = start; i <= end; i++)
            {
                Vector3 a = _centerline[i];
                Vector3 b = _centerline[i + 1];
                Vector3 ab = b - a;
                float lenSq = ab.sqrMagnitude;
                if (lenSq < 0.0001f) continue;
                float t = Mathf.Clamp01(Vector3.Dot(worldPos - a, ab) / lenSq);
                Vector3 proj = a + ab * t;
                float sq = (worldPos - proj).sqrMagnitude;
                if (sq < bestSq)
                {
                    bestSq = sq;
                    bestProj = proj;
                    bestRight = Vector3.Cross(Vector3.up, ab.normalized);
                }
            }
            return Vector3.Dot(worldPos - bestProj, bestRight);
        }

        /// <summary>Tangent of the track at the start/finish line.</summary>
        public Vector3 FinishLineDirection
        {
            get
            {
                if (_centerline.Count < 2) return Vector3.forward;
                var d = _centerline[1] - _centerline[0];
                return d.sqrMagnitude > 0.0001f ? d.normalized : Vector3.forward;
            }
        }

        /// <summary>
        /// Corner radius at a fixed point ~lookAhead meters ahead of the car
        /// (centerline curvature), NOT the minimum across the window. The
        /// minimum-radius approach made the car "steer early": on a straight
        /// near any corner the window included the corner's tight radius, so
        /// the car turned hard on the straight (observed: "car turns too much
        /// on straights, too little in corners"). Reading the radius at the
        /// lookahead point gives the corner only when it is actually
        /// approaching. Returns ~10000 on straights.
        /// </summary>
        public float GetCornerRadiusAhead(Vector3 worldPos, float lookAheadDistance = 40f)
        {
            if (_centerline.Count < 12) return 10000f;
            int idx = ClosestCenterlineIndex(worldPos);
            float dist = 0f;
            int i = idx;
            while (i < _centerline.Count - 2 && dist < lookAheadDistance)
            {
                dist += (_centerline[i + 1] - _centerline[i]).magnitude;
                i++;
            }
            return RadiusFromHeading(i - 1, i, i + 1);
        }

        float RadiusFromHeading(int a, int b, int c)
        {
            Vector2 A = new Vector2(_centerline[a].x, _centerline[a].z);
            Vector2 B = new Vector2(_centerline[b].x, _centerline[b].z);
            Vector2 C = new Vector2(_centerline[c].x, _centerline[c].z);
            Vector2 d1 = (B - A).normalized;
            Vector2 d2 = (C - B).normalized;
            float delta = Mathf.Atan2(d1.x * d2.y - d1.y * d2.x, d1.x * d2.x + d1.y * d2.y);
            if (Mathf.Abs(delta) < 0.01f) return 10000f; // straight
            // Circumradius of the polygon edge: arc/(4*sin(delta/2)).
            // arc/delta would overestimate by ~2x on smoothly sampled
            // circles (observed: oval R=70 measured as 139.9 m), which
            // delayed the drift trigger (vLimit too high).
            float arc = (B - A).magnitude + (C - B).magnitude;
            return arc / (4f * Mathf.Sin(Mathf.Abs(delta) * 0.5f));
        }

        int ClosestCenterlineIndex(Vector3 worldPos)
        {
            int best = 0;
            float bestSq = float.MaxValue;
            for (int i = 0; i < _centerline.Count; i++)
            {
                float sq = (_centerline[i] - worldPos).sqrMagnitude;
                if (sq < bestSq) { bestSq = sq; best = i; }
            }
            return best;
        }

        public void BuildTrack()
        {
            if (_built) return;
            _built = true;

            _centerline.Clear();
            _controller = FindFirstObjectByType<RaceFeelController>();
            if (variant == TrackVariant.Spa)
            {
                // Real Spa-Francorchamps centerline (OpenStreetMap data, ~6 m
                // spacing, clockwise, 7.0 km). Elevation ignored (planar physics).
                _centerline.AddRange(SpaTrackData.Points);
            }
            else
            {
                // Oval: two straights connected by semicircles, all in XZ plane.
                // The centerline STARTS at the start/finish line (x=0, middle of
                // the bottom straight) so lap detection (first point) matches the
                // visible start line and the F1-style grid behind it (2026-08-03).
                float halfStraight = straightLength * 0.5f;

                // Bottom straight, first half: from (0,0,-turnRadius) to (halfStraight, 0, -turnRadius)
                AddLine(new Vector3(0f, 0f, -turnRadius),
                        new Vector3(halfStraight, 0f, -turnRadius));
                // Right turn (semicircle): from (halfStraight, 0, -turnRadius) to (halfStraight, 0, turnRadius)
                AddArc(new Vector3(halfStraight, 0f, 0f), turnRadius, -90f, 90f);
                // Top straight: from (halfStraight, 0, turnRadius) to (-halfStraight, 0, turnRadius)
                AddLine(new Vector3(halfStraight, 0f, turnRadius),
                        new Vector3(-halfStraight, 0f, turnRadius));
                // Left turn (semicircle): back to the bottom straight
                AddArc(new Vector3(-halfStraight, 0f, 0f), turnRadius, 90f, 270f);
                // Bottom straight, second half: closes the loop back at x=0
                AddLine(new Vector3(-halfStraight, 0f, -turnRadius),
                        new Vector3(0f, 0f, -turnRadius));
            }

            BuildRoadMesh();
            BuildGrassBand(grassOuterMaterial);
            if (variant == TrackVariant.Oval)
            {
                BuildInfieldGrass(grassInnerMaterial);
                BuildWallPrefabs();
                BuildStartGrid();
                BuildEdgeLines(edgeLineMaterial);
            }
            else
            {
                BuildWalls();
            }
        }

        /// <summary>
        /// Swap to the other track layout at runtime (tuning panel button).
        /// Destroys every generated child (walls, floor, markers, finish) plus
        /// the road mesh on this GameObject, then rebuilds from scratch.
        /// The caller resets the controller afterwards (spawn point changes).
        /// </summary>
        public void SwitchVariant()
        {
            variant = variant == TrackVariant.Oval ? TrackVariant.Spa : TrackVariant.Oval;

            // Destroy generated children. Destroy is deferred to end of frame,
            // which is fine here: the new floor/walls are built in the same frame.
            for (int i = transform.childCount - 1; i >= 0; i--)
                Destroy(transform.GetChild(i).gameObject);

            // Road mesh lives on this GameObject.
            var filter = GetComponent<MeshFilter>();
            if (filter != null) filter.sharedMesh = null;
            var renderer = GetComponent<MeshRenderer>();
            if (renderer != null) renderer.sharedMaterial = null;

            _built = false;
            BuildTrack();
        }

        /// <summary>The currently active layout.</summary>
        public TrackVariant Variant => variant;

        void AddLine(Vector3 a, Vector3 b)
        {
            int steps = 8;
            for (int i = 0; i <= steps; i++)
                _centerline.Add(Vector3.Lerp(a, b, (float)i / steps));
        }

        void AddArc(Vector3 center, float radius, float startAngle, float endAngle)
        {
            for (int i = 0; i <= segmentsPerTurn; i++)
            {
                float angle = Mathf.Lerp(startAngle, endAngle, (float)i / segmentsPerTurn) * Mathf.Deg2Rad;
                _centerline.Add(center + new Vector3(Mathf.Cos(angle) * radius, 0f, Mathf.Sin(angle) * radius));
            }
        }

        /// <summary>
        /// Builds the road mesh along the centerline with SHARED vertices:
        /// one right-vector per centerline point (central tangent), so
        /// adjacent segments coincide exactly - the old per-segment right
        /// diverged on curves and left triangular gaps showing through to the
        /// floor (observed: "spaces between splines without asphalt texture").
        /// UV: U = traveled / roadTileLength (tile repeat), V = 0..1 across width.
        /// </summary>
        void BuildRoadMesh()
        {
            var filter = GetComponent<MeshFilter>();
            if (filter == null) filter = gameObject.AddComponent<MeshFilter>();
            var renderer = GetComponent<MeshRenderer>();
            if (renderer == null) renderer = gameObject.AddComponent<MeshRenderer>();

            int n = _centerline.Count;
            var rights = ComputePointRights();
            var vertices = new List<Vector3>();
            var triangles = new List<int>();
            var uvs = new List<Vector2>();
            float traveled = 0f;

            // Two vertices per centerline point: p + right*halfW, p - right*halfW.
            for (int i = 0; i < n; i++)
            {
                Vector3 p = _centerline[i];
                Vector3 r = rights[i] * HalfWidth;
                vertices.Add(p + r);
                vertices.Add(p - r);
                uvs.Add(new Vector2(traveled / roadTileLength, 1f)); // right edge
                uvs.Add(new Vector2(traveled / roadTileLength, 0f)); // left edge
                if (i < n - 1) traveled += (_centerline[i + 1] - _centerline[i]).magnitude;
            }

            for (int i = 0; i < n - 1; i++)
            {
                int a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
                triangles.Add(a); triangles.Add(b); triangles.Add(c);
                triangles.Add(c); triangles.Add(b); triangles.Add(d);
            }

            var mesh = new Mesh { name = "PrototypeRoad" };
            mesh.SetVertices(vertices);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            filter.sharedMesh = mesh;

            // Collision: invisible floor with thickness at Y=0.
            BuildCollisionFloor();

            if (renderer.sharedMaterial == null)
            {
                if (roadMaterial != null)
                {
                    renderer.sharedMaterial = roadMaterial;
                }
                else
                {
                    var mat = new Material(Shader.Find("Universal Render Pipeline/Simple Lit"));
                    mat.color = new Color(0.25f, 0.25f, 0.28f);
                    renderer.sharedMaterial = mat;
                }
            }
        }

        /// <summary>
        /// One normalized right-vector per centerline point, using the CENTRAL
        /// tangent (p[i+1]-p[i-1]) so shared vertices on curves are exact.
        /// Endpoints fall back to forward/backward difference.
        /// </summary>
        Vector3[] ComputePointRights()
        {
            int n = _centerline.Count;
            var rights = new Vector3[n];
            for (int i = 0; i < n; i++)
            {
                Vector3 prev = _centerline[Mathf.Max(0, i - 1)];
                Vector3 next = _centerline[Mathf.Min(n - 1, i + 1)];
                Vector3 dir = (next - prev);
                if (dir.sqrMagnitude < 0.0001f) dir = _centerline[Mathf.Min(n - 1, i + 1)] - _centerline[i];
                dir.Normalize();
                rights[i] = Vector3.Cross(Vector3.up, dir).normalized;
            }
            return rights;
        }

        /// <summary>
        /// Outer grass band with SHARED vertices (central tangent per point,
        /// same as the road mesh) so curves have no gaps. OVAL: only the
        /// OUTER band - the infield GRASS_2 fills the whole interior, so the
        /// old inner band (GRASS_1 drawn over the infield) was removed
        /// (duplicate-texture bug 2026-08-03). SPA: both sides.
        /// Winding per side keeps normals up.
        /// </summary>
        void BuildGrassBand(Material mat)
        {
            int n = _centerline.Count;
            var rights = ComputePointRights();
            var vertices = new List<Vector3>();
            var triangles = new List<int>();
            var uvs = new List<Vector2>();

            int sideCount = variant == TrackVariant.Oval ? 1 : 2;
            for (int s = 0; s < sideCount; s++)
            {
                // s=0: +right (outer band). s=1 (Spa only): -right (inner band).
                int sign = s == 0 ? 1 : -1;
                int baseV = vertices.Count;
                for (int i = 0; i < n; i++)
                {
                    Vector3 p = _centerline[i];
                    Vector3 r = rights[i] * sign;
                    Vector3 outer = p + r * (HalfWidth + grassWidth);
                    Vector3 inner = p + r * HalfWidth;
                    // v0 = outer, v1 = inner: (v0,v1,v2) keeps normals up.
                    vertices.Add(outer);
                    vertices.Add(inner);
                    uvs.Add(new Vector2(p.x / 54f, p.z / 54f));
                    uvs.Add(new Vector2(p.x / 54f, p.z / 54f));
                }
                for (int i = 0; i < n - 1; i++)
                {
                    int v0 = baseV + i * 2, v1 = baseV + i * 2 + 1;
                    int v2 = baseV + (i + 1) * 2, v3 = baseV + (i + 1) * 2 + 1;
                    triangles.Add(v0); triangles.Add(v1); triangles.Add(v2);
                    triangles.Add(v2); triangles.Add(v1); triangles.Add(v3);
                }
            }

            var go = new GameObject("OuterGrass");
            go.transform.SetParent(transform, false);
            var mesh = new Mesh { name = "PrototypeOuterGrass" };
            mesh.SetVertices(vertices);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            go.AddComponent<MeshRenderer>().sharedMaterial = mat;
        }

        /// <summary>
        /// Infield grass (OVAL ONLY): fills the ENTIRE space inside the oval,
        /// from the inner road edge to the middle. GRASS_2 (mowed-lawn style)
        /// is visually distinct from the outer GRASS_1, per user decision
        /// 2026-08-03. The ring uses -right*halfW (same central tangent as the
        /// road mesh) so the infield edge coincides EXACTLY with the inner
        /// road edge - the old "toward oval center" inward vector pointed
        /// diagonally on straights and overlapped/gapped the road (2026-08-03).
        /// Built as a fan from the oval center to the inner road edge ring.
        /// </summary>
        void BuildInfieldGrass(Material mat)
        {
            if (mat == null) return;
            int n = _centerline.Count;
            var rights = ComputePointRights();
            float halfW = HalfWidth;

            var vertices = new List<Vector3>();
            var triangles = new List<int>();
            var uvs = new List<Vector2>();

            // Inner road edge ring: p - right*halfW (the road's inner edge).
            int edgeStart = vertices.Count;
            for (int i = 0; i < n; i++)
            {
                Vector3 p = _centerline[i];
                vertices.Add(p - rights[i] * halfW);
                // Tiling matches the asset: grass_2 repeats ~9.5m per UV unit
                // (measured on 0GRASS2/1GRASS_2 by paired-vertex regression).
                uvs.Add(new Vector2(p.x / 9.5f, p.z / 9.5f));
            }

            // Fan: center + each edge pair. The ring is closed (oval centerline
            // ends where it starts), so the last pair closes back to edgeStart.
            int centerIdx = vertices.Count;
            vertices.Add(Vector3.zero + Vector3.up * 0.005f);
            uvs.Add(new Vector2(0f, 0f));
            int edgeCount = n;
            for (int i = 0; i < edgeCount; i++)
            {
                // Winding was inverted (normals pointed down, mesh culled).
                // (centerIdx, b, a) gives CCW triangles -> normals up.
                int a = edgeStart + i;
                int b = edgeStart + ((i + 1) % edgeCount);
                triangles.Add(centerIdx);
                triangles.Add(b);
                triangles.Add(a);
            }

            var go = new GameObject("InfieldGrass");
            go.transform.SetParent(transform, false);
            var mesh = new Mesh { name = "PrototypeInfieldGrass" };
            mesh.SetVertices(vertices);
            mesh.SetUVs(0, uvs);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            go.AddComponent<MeshRenderer>().sharedMaterial = mat;
        }

        /// <summary>
        /// F1-style start area (OVAL ONLY): start line + start lights gantry
        /// + 8 grid-slot lines in 2-2-2-2 formation behind the line, all from
        /// CartoonTracksPack1 prefabs. Positions are computed from the track
        /// geometry (start line at x=0, grid slots at x=-8/-16/-24/-32 m,
        /// alternating lateral offset +-3.5 m). Wall A bounds: (4.0, 4.34, 0.68).
        /// </summary>
/// <summary>
/// F1-style start area (OVAL ONLY): start line + driver-facing start lights
/// + 8 grid-slot marks in a 2-2-2-2 formation. GridSlot anchors remain at
/// the car center positions; each visible mark is a child offset in front.
/// </summary>
void BuildStartGrid()
{
    var root = new GameObject("StartGrid");
    root.transform.SetParent(transform, false);

    // Track z centerline of the box straight is z = -turnRadius.
    float zTrack = -turnRadius;

    // Start line: white strip across the track at x=0 (finish line).
    if (startLinePrefab != null)
    {
        var line = Instantiate(startLinePrefab, new Vector3(0f, 0.02f, zTrack), Quaternion.identity, root.transform);
        line.name = "StartLine";
    }

    // Cars travel toward +X. Place the light assembly outside the +Z edge
    // and rotate it 180 degrees so its face points toward incoming drivers.
    if (startLightsPrefab != null)
    {
        const float startLightsForwardOffset = -2f;
        const float startLightsOutsideClearance = 6f;
        var lightsPosition = new Vector3(
            startLightsForwardOffset,
            0f,
            zTrack + wallOffset + startLightsOutsideClearance);
        var lights = Instantiate(
            startLightsPrefab,
            lightsPosition,
            Quaternion.Euler(0f, 180f, 0f),
            root.transform);
        lights.name = "StartLights";
    }

    // The car centers remain at -8, -16, -24, and -32 m. Each GridSlot
    // anchor uses that same coordinate; the visible mark is a child 2.5 m
    // ahead of the car and rotated to face the incoming direction.
    if (gridLinePrefab != null)
    {
        const float spawnX = -8f;
        const float rowSpacing = 8f;
        const float frontClearance = 2.5f;
        int slot = 1;
        for (int row = 0; row < 4; row++)
        {
            float carCenterX = spawnX - row * rowSpacing;
            for (int side = 0; side < 2; side++)
            {
                float lateralOffset = side == 0 ? 3.5f : -3.5f;
                var anchor = new GameObject($"GridSlot{slot}");
                anchor.transform.SetParent(root.transform, false);
                anchor.transform.localPosition = new Vector3(
                    carCenterX,
                    0.02f,
                    zTrack + lateralOffset);
                anchor.transform.localRotation = Quaternion.identity;

                var mark = Instantiate(gridLinePrefab, anchor.transform);
                mark.name = "GridMark";
                mark.transform.localPosition = new Vector3(frontClearance, 0f, 0f);
                mark.transform.localRotation = Quaternion.Euler(0f, 180f, 0f);
                slot++;
            }
        }
    }

    Debug.Log($"[PrototypeTrack] StartGrid placed (line={(startLinePrefab != null)}, lights={(startLightsPrefab != null)}, slots={(gridLinePrefab != null ? 8 : 0)})");
}

        /// <summary>
        /// White edge lines (ROAD_MARKS) along BOTH road edges, using shared
        /// vertices from ComputePointRights so they follow the curves exactly.
        /// Each edge is a thin quad strip (0.15 m wide) inset 0.3 m from the
        /// asphalt edge. OVAL ONLY for now.
        /// </summary>
/// <summary>
/// White edge lines (ROAD_MARKS) along BOTH road edges, using shared
/// vertices from ComputePointRights so they follow the curves exactly.
/// The strips sit slightly above the asphalt to prevent z-fighting and
/// reverse winding on the opposite side so both remain front-facing.
/// </summary>
/// <summary>
/// White edge lines (ROAD_MARKS) along BOTH road edges, using shared
/// vertices from ComputePointRights so they follow the curves exactly.
/// The strips sit slightly above the asphalt to prevent z-fighting and
/// use front-facing winding on both sides.
/// </summary>
void BuildEdgeLines(Material mat)
{
    if (mat == null) return;
    int n = _centerline.Count;
    var rights = ComputePointRights();
    const float inset = 0.3f;
    const float halfW = 0.075f;
    const float lineHeight = 0.02f;

    var vertices = new List<Vector3>();
    var triangles = new List<int>();
    var uvs = new List<Vector2>();

    for (int sign = -1; sign <= 1; sign += 2)
    {
        int baseV = vertices.Count;
        for (int i = 0; i < n; i++)
        {
            Vector3 p = _centerline[i] + Vector3.up * lineHeight;
            Vector3 r = rights[i] * sign;
            Vector3 inner = p + r * (HalfWidth - inset - halfW);
            Vector3 outer = p + r * (HalfWidth - inset + halfW);
            vertices.Add(inner);
            vertices.Add(outer);
            uvs.Add(new Vector2(0f, 0f));
            uvs.Add(new Vector2(1f, 0f));
        }

        for (int i = 0; i < n - 1; i++)
        {
            int v0 = baseV + i * 2;
            int v1 = baseV + i * 2 + 1;
            int v2 = baseV + (i + 1) * 2;
            int v3 = baseV + (i + 1) * 2 + 1;
            if (sign < 0)
            {
                triangles.Add(v0); triangles.Add(v1); triangles.Add(v2);
                triangles.Add(v2); triangles.Add(v1); triangles.Add(v3);
            }
            else
            {
                triangles.Add(v0); triangles.Add(v2); triangles.Add(v1);
                triangles.Add(v2); triangles.Add(v3); triangles.Add(v1);
            }
        }
    }

    var go = new GameObject("EdgeLines");
    go.transform.SetParent(transform, false);
    var mesh = new Mesh { name = "PrototypeEdgeLines" };
    mesh.SetVertices(vertices);
    mesh.SetUVs(0, uvs);
    mesh.SetTriangles(triangles, 0);
    mesh.RecalculateNormals();
    go.AddComponent<MeshFilter>().sharedMesh = mesh;
    go.AddComponent<MeshRenderer>().sharedMaterial = mat;
}

        /// <summary>Invisible BoxCollider floor covering the whole track area.</summary>
        void BuildCollisionFloor()
        {
            Vector3 min = _centerline[0], max = _centerline[0];
            for (int i = 1; i < _centerline.Count; i++)
            {
                min = Vector3.Min(min, _centerline[i]);
                max = Vector3.Max(max, _centerline[i]);
            }
            Vector3 center = (min + max) * 0.5f;
            Vector3 size = max - min + new Vector3(400f, 0f, 400f); // margin

            var floor = new GameObject("RaceFloor");
            floor.transform.SetParent(transform, false);
            floor.transform.position = new Vector3(center.x, -0.2f, center.z);

            var col = floor.AddComponent<BoxCollider>();
            col.size = new Vector3(size.x, 0.4f, size.z);
            col.material = ZeroFriction();

            var mf = floor.AddComponent<MeshFilter>();
            mf.sharedMesh = null;
        }

        /// <summary>A frictionless physics material shared by floor and car.</summary>
        public static PhysicsMaterial ZeroFriction()
        {
            var mat = new PhysicsMaterial("PrototypeZeroFriction");
            mat.dynamicFriction = 0f;
            mat.staticFriction = 0f;
            mat.frictionCombine = PhysicsMaterialCombine.Minimum;
            mat.bounciness = 0f;
            return mat;
        }

        /// <summary>
        /// Simple procedural walls for the Spa layout (the oval uses the
        /// CartoonTracksPack1 prefabs instead). One mesh + one MeshCollider
        /// for the whole track, on BOTH sides.
        /// </summary>
        void BuildWalls()
        {
            const float wallHeight = 1.2f;
            const float wallThickness = 0.5f;
            float halfWidth = HalfWidth + grassWidth;

            var vertices = new List<Vector3>();
            var triangles = new List<int>();

            for (int i = 0; i < _centerline.Count - 1; i++)
            {
                Vector3 p0 = _centerline[i];
                Vector3 p1 = _centerline[i + 1];
                Vector3 dir = (p1 - p0);
                float segLen = dir.magnitude;
                if (segLen < 0.001f) continue;
                dir /= segLen;
                Vector3 right = Vector3.Cross(Vector3.up, dir).normalized;

                for (int side = -1; side <= 1; side += 2)
                {
                    Vector3 off = right * (halfWidth * side);
                    Vector3 inner = off;
                    Vector3 outer = off + right * (wallThickness * side);

                    int b = vertices.Count;
                    vertices.Add(p0 + inner);
                    vertices.Add(p0 + inner + Vector3.up * wallHeight);
                    vertices.Add(p1 + inner + Vector3.up * wallHeight);
                    vertices.Add(p1 + inner);
                    vertices.Add(p0 + outer);
                    vertices.Add(p0 + outer + Vector3.up * wallHeight);
                    vertices.Add(p1 + outer + Vector3.up * wallHeight);
                    vertices.Add(p1 + outer);

                    triangles.Add(b + 0); triangles.Add(b + 1); triangles.Add(b + 2);
                    triangles.Add(b + 0); triangles.Add(b + 2); triangles.Add(b + 3);
                    triangles.Add(b + 4); triangles.Add(b + 6); triangles.Add(b + 5);
                    triangles.Add(b + 4); triangles.Add(b + 7); triangles.Add(b + 6);
                    triangles.Add(b + 1); triangles.Add(b + 5); triangles.Add(b + 6);
                    triangles.Add(b + 1); triangles.Add(b + 6); triangles.Add(b + 2);
                }
            }

            var go = new GameObject("Walls");
            go.transform.SetParent(transform, false);

            var mesh = new Mesh { name = "PrototypeWalls" };
            mesh.SetVertices(vertices);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();

            var mf = go.AddComponent<MeshFilter>();
            mf.sharedMesh = mesh;

            var mr = go.AddComponent<MeshRenderer>();
            var wallMat = new Material(Shader.Find("Universal Render Pipeline/Simple Lit"));
            wallMat.color = new Color(0.9f, 0.9f, 0.9f);
            mr.sharedMaterial = wallMat;

            var mc = go.AddComponent<MeshCollider>();
            mc.sharedMesh = mesh;
            mc.material = ZeroFriction();
        }

        /// <summary>
        /// Outer walls from CartoonTracksPack1 prefabs (OVAL ONLY), placed
        /// continuously along each section at wallOffset from the centerline:
        /// A on the box straight (z=-70), B on the opposite straight (z=+70),
        /// C on the first turn (x=+200), D on the second turn (x=-200).
        /// Each instance gets a BoxCollider sized to its mesh + zero-friction
        /// material so the car bounces off (PhysX inelastic collision) instead
        /// of passing through (user requirement 2026-08-03).
        /// </summary>
        /// <summary>
        /// Outer walls from CartoonTracksPack1 prefabs (OVAL ONLY), placed
        /// continuously along each section at wallOffset from the centerline:
        /// A on the box straight (z=-70), B on the opposite straight (z=+70),
        /// C on the first turn (x=+200), D on the second turn (x=-200).
        /// Each instance gets a BoxCollider sized to its mesh + zero-friction
        /// material so the car bounces off (PhysX inelastic collision) instead
        /// of passing through (user requirement 2026-08-03).
        /// Walls are placed END-TO-END analytically per section (not by walking
        /// the centerline, which over-placed at fine sampling): straight walls
        /// at fixed lateral offset, turn walls on the outer arc (radius
        /// turnRadius + wallOffset).
        /// </summary>
        void BuildWallPrefabs()
        {
            var root = new GameObject("CartoonWalls");
            root.transform.SetParent(transform, false);

            float halfS = straightLength * 0.5f;
            float wallR = turnRadius + wallOffset; // outer wall radius on turns
            int count = 0;

            // Section 0: box straight, z = -(turnRadius + wallOffset), dir +X.
            float zBox = -(turnRadius + wallOffset);
            float lenA = WallLength(wallPrefabA);
            if (wallPrefabA != null && lenA > 0f)
            {
                int n = Mathf.CeilToInt(straightLength / lenA);
                for (int i = 0; i < n; i++)
                {
                    float x = -halfS + (i + 0.5f) * lenA;
                    Vector3 pos = new Vector3(x, 0f, zBox);
                    Quaternion rot = Quaternion.LookRotation(Vector3.right, Vector3.up) * Quaternion.Euler(0f, -90f, 0f);
                    var inst = Instantiate(wallPrefabA, pos, rot, root.transform);
                    SetupWallCollider(inst);
                    count++;
                }
            }

            // Section 2: opposite straight, z = +(turnRadius + wallOffset), dir -X.
            float zOpp = turnRadius + wallOffset;
            float lenB = WallLength(wallPrefabB);
            if (wallPrefabB != null && lenB > 0f)
            {
                int n = Mathf.CeilToInt(straightLength / lenB);
                for (int i = 0; i < n; i++)
                {
                    float x = halfS - (i + 0.5f) * lenB;
                    Vector3 pos = new Vector3(x, 0f, zOpp);
                    Quaternion rot = Quaternion.LookRotation(-Vector3.right, Vector3.up) * Quaternion.Euler(0f, -90f, 0f);
                    var inst = Instantiate(wallPrefabB, pos, rot, root.transform);
                    SetupWallCollider(inst);
                    count++;
                }
            }

            // Section 1: right turn, center (halfS, 0), outer radius wallR,
            // angle -90..+90 (travel from z=-turnRadius to z=+turnRadius).
            float lenC = WallLength(wallPrefabC);
            if (wallPrefabC != null && lenC > 0f)
            {
                float arcLen = Mathf.PI * wallR;
                int n = Mathf.CeilToInt(arcLen / lenC);
                for (int i = 0; i < n; i++)
                {
                    float ang = -90f + (i + 0.5f) * (lenC / wallR) * Mathf.Rad2Deg;
                    float a = ang * Mathf.Deg2Rad;
                    Vector3 pos = new Vector3(halfS + wallR * Mathf.Cos(a), 0f, wallR * Mathf.Sin(a));
                    Vector3 tan = new Vector3(-Mathf.Sin(a), 0f, Mathf.Cos(a)); // d/dθ
                    Quaternion rot = Quaternion.LookRotation(tan, Vector3.up) * Quaternion.Euler(0f, -90f, 0f);
                    var inst = Instantiate(wallPrefabC, pos, rot, root.transform);
                    SetupWallCollider(inst);
                    count++;
                }
            }

            // Section 3: left turn, center (-halfS, 0), outer radius wallR,
            // angle +90..+270 (travel from z=+turnRadius to z=-turnRadius).
            float lenD = WallLength(wallPrefabD);
            if (wallPrefabD != null && lenD > 0f)
            {
                float arcLen = Mathf.PI * wallR;
                int n = Mathf.CeilToInt(arcLen / lenD);
                for (int i = 0; i < n; i++)
                {
                    float ang = 90f + (i + 0.5f) * (lenD / wallR) * Mathf.Rad2Deg;
                    float a = ang * Mathf.Deg2Rad;
                    Vector3 pos = new Vector3(-halfS + wallR * Mathf.Cos(a), 0f, wallR * Mathf.Sin(a));
                    Vector3 tan = new Vector3(-Mathf.Sin(a), 0f, Mathf.Cos(a));
                    Quaternion rot = Quaternion.LookRotation(tan, Vector3.up) * Quaternion.Euler(0f, -90f, 0f);
                    var inst = Instantiate(wallPrefabD, pos, rot, root.transform);
                    SetupWallCollider(inst);
                    count++;
                }
            }

            Debug.Log($"[PrototypeTrack] CartoonWalls placed: {count}");
        }

        /// <summary>
        /// Length of a wall prefab along its local X axis, measured in the
        /// prefab ROOT space. Child mesh bounds are local to each child, so
        /// they must be transformed into root space before encapsulating;
        /// encapsulating raw local bounds returned 2.9m for the 2.0m-wide
        /// wall C (its fence child has an offset pivot), leaving 0.9m gaps.
        /// </summary>
        float WallLength(GameObject prefab)
        {
            var mfs = prefab.GetComponentsInChildren<MeshFilter>(true);
            if (mfs.Length == 0) return 4f;
            Bounds b = new Bounds(mfs[0].transform.TransformPoint(mfs[0].sharedMesh.bounds.min), Vector3.zero);
            foreach (var mf in mfs)
                b.Encapsulate(TransformBoundsToRoot(mf));
            return b.size.x;
        }

        /// <summary>Bounds of a mesh in the prefab ROOT space (not the child's local space).</summary>
        Bounds TransformBoundsToRoot(MeshFilter mf)
        {
            var local = mf.sharedMesh.bounds;
            var corners = new Vector3[8];
            corners[0] = mf.transform.TransformPoint(local.min);
            corners[1] = mf.transform.TransformPoint(new Vector3(local.max.x, local.min.y, local.min.z));
            corners[2] = mf.transform.TransformPoint(new Vector3(local.min.x, local.max.y, local.min.z));
            corners[3] = mf.transform.TransformPoint(new Vector3(local.max.x, local.max.y, local.min.z));
            corners[4] = mf.transform.TransformPoint(new Vector3(local.min.x, local.min.y, local.max.z));
            corners[5] = mf.transform.TransformPoint(new Vector3(local.max.x, local.min.y, local.max.z));
            corners[6] = mf.transform.TransformPoint(new Vector3(local.min.x, local.max.y, local.max.z));
            corners[7] = mf.transform.TransformPoint(local.max);
            Bounds b = new Bounds(corners[0], Vector3.zero);
            for (int i = 1; i < 8; i++) b.Encapsulate(corners[i]);
            return b;
        }

        void SetupWallCollider(GameObject inst)
        {
            var mfs = inst.GetComponentsInChildren<MeshFilter>(true);
            if (mfs.Length == 0) return;
            // Measure in the INSTANCE's local space (BoxCollider is local).
            // TransformBoundsToRoot runs on the prefab asset (unrotated), but
            // here the instance is rotated on track, so child->world then
            // world->instance-local yields the unrotated prefab bounds.
            Bounds b = new Bounds(inst.transform.InverseTransformPoint(mfs[0].transform.TransformPoint(mfs[0].sharedMesh.bounds.min)), Vector3.zero);
            foreach (var mf in mfs)
                b.Encapsulate(InstanceLocalBounds(mf, inst));
            var col = inst.AddComponent<BoxCollider>();
            col.center = b.center;
            col.size = b.size;
            col.material = ZeroFriction();
        }

        /// <summary>Mesh bounds expressed in the instanced root's local space.</summary>
        Bounds InstanceLocalBounds(MeshFilter mf, GameObject root)
        {
            var local = mf.sharedMesh.bounds;
            var corners = new Vector3[8];
            corners[0] = root.transform.InverseTransformPoint(mf.transform.TransformPoint(local.min));
            corners[1] = root.transform.InverseTransformPoint(mf.transform.TransformPoint(new Vector3(local.max.x, local.min.y, local.min.z)));
            corners[2] = root.transform.InverseTransformPoint(mf.transform.TransformPoint(new Vector3(local.min.x, local.max.y, local.min.z)));
            corners[3] = root.transform.InverseTransformPoint(mf.transform.TransformPoint(new Vector3(local.max.x, local.max.y, local.min.z)));
            corners[4] = root.transform.InverseTransformPoint(mf.transform.TransformPoint(new Vector3(local.min.x, local.min.y, local.max.z)));
            corners[5] = root.transform.InverseTransformPoint(mf.transform.TransformPoint(new Vector3(local.max.x, local.min.y, local.max.z)));
            corners[6] = root.transform.InverseTransformPoint(mf.transform.TransformPoint(new Vector3(local.min.x, local.max.y, local.max.z)));
            corners[7] = root.transform.InverseTransformPoint(mf.transform.TransformPoint(local.max));
            Bounds b = new Bounds(corners[0], Vector3.zero);
            for (int i = 1; i < 8; i++) b.Encapsulate(corners[i]);
            return b;
        }

        void OnDrawGizmos()
        {
            if (_centerline.Count == 0) return;
            Gizmos.color = Color.yellow;
            for (int i = 0; i < _centerline.Count - 1; i++)
                Gizmos.DrawLine(_centerline[i], _centerline[i + 1]);
        }
    }
}
