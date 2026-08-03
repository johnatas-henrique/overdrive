// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is the arcade grip (ADR-0002) fun and responsive enough to sustain the 30s loop?
// Date: 2026-08-01

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
        [SerializeField] int segmentsPerTurn = 24;      // smoothness of curves

        [Header("Spawn")]
        [SerializeField] Vector3 startPosition = new Vector3(-200f, 0.5f, -70f); // ON the start/finish line (was x=0, 200 m off - bug 2026-08-02)
        [SerializeField] Vector3 startRotation = new Vector3(0f, 90f, 0f); // +X: along the bottom straight

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
                // Start line at (0,0,-turnRadius) heading +Z.
                float halfStraight = straightLength * 0.5f;

                // Bottom straight: from (-halfStraight, 0, -turnRadius) to (halfStraight, 0, -turnRadius)
                AddLine(new Vector3(-halfStraight, 0f, -turnRadius),
                        new Vector3(halfStraight, 0f, -turnRadius));
                // Right turn (semicircle): from (halfStraight, 0, -turnRadius) to (halfStraight, 0, turnRadius)
                AddArc(new Vector3(halfStraight, 0f, 0f), turnRadius, -90f, 90f);
                // Top straight: from (halfStraight, 0, turnRadius) to (-halfStraight, 0, turnRadius)
                AddLine(new Vector3(halfStraight, 0f, turnRadius),
                        new Vector3(-halfStraight, 0f, turnRadius));
                // Left turn (semicircle): back to start
                AddArc(new Vector3(-halfStraight, 0f, 0f), turnRadius, 90f, 270f);
            }

            BuildRoadMesh();
            BuildGrass();
            BuildWalls();
            BuildFinishLineMark();
            BuildSpeedMarkers();
            BuildKerbs();
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

            // Destroy generated children (RaceFloor, Walls, SpeedMarkers,
            // FinishLineMark). Destroy is deferred to end of frame, which is
            // fine here: the new floor/walls are built in the same frame.
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

        /// <summary>Builds a simple road mesh (dark plane) along the centerline.</summary>
        void BuildRoadMesh()
        {
            var filter = GetComponent<MeshFilter>();
            if (filter == null) filter = gameObject.AddComponent<MeshFilter>();
            var renderer = GetComponent<MeshRenderer>();
            if (renderer == null) renderer = gameObject.AddComponent<MeshRenderer>();

            var vertices = new List<Vector3>();
            var triangles = new List<int>();

            for (int i = 0; i < _centerline.Count - 1; i++)
            {
                Vector3 p0 = _centerline[i];
                Vector3 p1 = _centerline[i + 1];
                Vector3 dir = (p1 - p0).normalized;
                Vector3 right = Vector3.Cross(Vector3.up, dir).normalized * (trackWidth * 0.5f);

                int baseIdx = vertices.Count;
                vertices.Add(p0 + right);
                vertices.Add(p0 - right);
                vertices.Add(p1 + right);
                vertices.Add(p1 - right);
                triangles.Add(baseIdx);
                triangles.Add(baseIdx + 1);
                triangles.Add(baseIdx + 2);
                triangles.Add(baseIdx + 2);
                triangles.Add(baseIdx + 1);
                triangles.Add(baseIdx + 3);
            }

            var mesh = new Mesh { name = "PrototypeRoad" };
            mesh.SetVertices(vertices);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            filter.sharedMesh = mesh;

            // Collision: invisible floor with thickness at Y=0.
            // A flat MeshCollider has zero thickness and lets the car tunnel
            // through under gravity; a BoxCollider does not.
            BuildCollisionFloor();

            if (renderer.sharedMaterial == null)
            {
                var mat = new Material(Shader.Find("Universal Render Pipeline/Simple Lit"));
                mat.color = new Color(0.25f, 0.25f, 0.28f);
                renderer.sharedMaterial = mat;
            }
        }

        /// <summary>
        /// Grass runoff band on both sides of the road (visual only; the
        /// RaceFloor collider already covers it). The car detects grass by
        /// lateral offset and loses grip/speed via ArcadeCar.surfaceGrip.
        /// Winding is per-side (the right band had its normals flipped and
        /// was backface-culled - fixed 2026-08-02).
        /// </summary>
        void BuildGrass()
        {
            var vertices = new List<Vector3>();
            var triangles = new List<int>();

            for (int i = 0; i < _centerline.Count - 1; i++)
            {
                Vector3 p0 = _centerline[i];
                Vector3 p1 = _centerline[i + 1];
                Vector3 dir = (p1 - p0).normalized;
                Vector3 right = Vector3.Cross(Vector3.up, dir).normalized;

                // Two bands per segment: left and right of the road, each
                // grassWidth deep, from the road edge outward. The right
                // band's vertex order is REVERSED so its normals point up
                // (cross(right, dir) points down; the road quad works
                // because it spans +right..-right through the center).
                for (int side = -1; side <= 1; side += 2)
                {
                    Vector3 inPos = right * (HalfWidth * side);
                    Vector3 outPos = right * ((HalfWidth + grassWidth) * side);
                    bool rev = side > 0;
                    Vector3 e0 = rev ? outPos : inPos;
                    Vector3 e1 = rev ? inPos : outPos;
                    Vector3 e2 = rev ? inPos : outPos;
                    Vector3 e3 = rev ? outPos : inPos;

                    int b = vertices.Count;
                    vertices.Add(p0 + e0);
                    vertices.Add(p0 + e1);
                    vertices.Add(p1 + e2);
                    vertices.Add(p1 + e3);
                    triangles.Add(b);
                    triangles.Add(b + 1);
                    triangles.Add(b + 2);
                    triangles.Add(b);
                    triangles.Add(b + 2);
                    triangles.Add(b + 3);
                }
            }

            var go = new GameObject("Grass");
            go.transform.SetParent(transform, false);
            var mesh = new Mesh { name = "PrototypeGrass" };
            mesh.SetVertices(vertices);
            mesh.SetTriangles(triangles, 0);
            mesh.RecalculateNormals();
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mat = new Material(Shader.Find("Universal Render Pipeline/Simple Lit"));
            mat.color = new Color(0.18f, 0.42f, 0.18f);
            go.AddComponent<MeshRenderer>().sharedMaterial = mat;
        }

        /// <summary>Invisible BoxCollider floor covering the whole track area.</summary>
        void BuildCollisionFloor()
        {
            // Size the floor to the track bounds (Spa is ~1.3 x 2.1 km, the
            // old fixed 1000 m square did not cover it).
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

            // Zero-friction physics material: the custom grip model owns all
            // lateral behavior. PhysX surface friction would fight it (it
            // generated up to 2229 N·m of counter-torque at the contact point
            // and ate throttle force, killing steering in motion).
            col.material = ZeroFriction();

            // No renderer: invisible, collidable only.
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
        /// Track limit walls on both sides, PAST the grass runoff
        /// (offset = halfWidth + grassWidth). One mesh + one MeshCollider
        /// for the whole track. Gives the driver a visual boundary and an
        /// error margin: a small mistake stays on grass, only a big one
        /// hits the wall (playtest 2026-08-02 - the old walls at the road
        /// edge made errors impossible).
        /// Walls have real thickness (0.5 m): a zero-thickness mesh lets a
        /// fast car tunnel through between physics ticks.
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
                if (segLen < 0.001f) continue; // degenerate duplicate point (oval closure)
                dir /= segLen;
                Vector3 right = Vector3.Cross(Vector3.up, dir).normalized;

                // Two walls per segment: left and right of the road.
                for (int side = -1; side <= 1; side += 2)
                {
                    Vector3 off = right * (halfWidth * side);
                    Vector3 inner = off;
                    Vector3 outer = off + right * (wallThickness * side);

                    // Box per wall segment: 4 corners x 2 (bottom/top).
                    int b = vertices.Count;
                    vertices.Add(p0 + inner);                          // 0 bottom inner
                    vertices.Add(p0 + inner + Vector3.up * wallHeight); // 1 top inner
                    vertices.Add(p1 + inner + Vector3.up * wallHeight); // 2 top inner far
                    vertices.Add(p1 + inner);                          // 3 bottom inner far
                    vertices.Add(p0 + outer);                          // 4 bottom outer
                    vertices.Add(p0 + outer + Vector3.up * wallHeight); // 5 top outer
                    vertices.Add(p1 + outer + Vector3.up * wallHeight); // 6 top outer far
                    vertices.Add(p1 + outer);                          // 7 bottom outer far

                    // Face toward road (inner): 0,1,2,3
                    triangles.Add(b + 0); triangles.Add(b + 1); triangles.Add(b + 2);
                    triangles.Add(b + 0); triangles.Add(b + 2); triangles.Add(b + 3);
                    // Face away (outer): 4,6,5,7
                    triangles.Add(b + 4); triangles.Add(b + 6); triangles.Add(b + 5);
                    triangles.Add(b + 4); triangles.Add(b + 7); triangles.Add(b + 6);
                    // Top cap: 1,5,6,2
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
            wallMat.color = new Color(0.9f, 0.9f, 0.9f); // light gray, visible boundary
            mr.sharedMaterial = wallMat;

            // One continuous MeshCollider: a single smooth surface along the
            // whole oval. Per-segment BoxColliders had square corners that
            // snagged the car at segment joints (observed: car caught and
            // thrown). CCD on the car prevents tunneling through this mesh.
            var mc = go.AddComponent<MeshCollider>();
            mc.sharedMesh = mesh;
            mc.material = ZeroFriction();
        }

        /// <summary>
        /// Passing-reference objects for speed feel: red/white zebra strips on
        /// both track edges every 10 m plus tall blue marker posts every 50 m.
        /// On a featureless track the eye has nothing to measure speed against;
        /// these stream past and make 300 km/h actually read as fast.
        /// Combined into 3 meshes (red/white/posts) to keep draw calls low.
        /// </summary>
        void BuildSpeedMarkers()
        {
            float halfWidth = trackWidth * 0.5f;
            const float zebraLen = 2f;      // m along the track
            const float zebraWidth = 0.45f; // m across
            const float zebraEvery = 10f;   // m spacing
            const float postEvery = 50f;    // m spacing
            const float postHeight = 1.6f;
            const float postHalf = 0.08f;

            var redVerts = new List<Vector3>();
            var redTris = new List<int>();
            var whiteVerts = new List<Vector3>();
            var whiteTris = new List<int>();
            var postVerts = new List<Vector3>();
            var postTris = new List<int>();

            float traveled = 0f;
            float nextZebra = 5f; // first zebra away from the start line
            float nextPost = 50f;
            bool zebraRed = true;

            for (int i = 0; i < _centerline.Count - 1; i++)
            {
                Vector3 p0 = _centerline[i];
                Vector3 p1 = _centerline[i + 1];
                Vector3 d = p1 - p0;
                float segLen = d.magnitude;
                if (segLen < 0.001f) continue;
                Vector3 dir = d / segLen;
                Vector3 right = Vector3.Cross(Vector3.up, dir);

                float step = 0f;
                while (step < segLen)
                {
                    Vector3 p = p0 + dir * step;

                    if (traveled >= nextZebra)
                    {
                        // Zebra strip: flat quad on each edge, slightly inside
                        // the road edge so it does not fight the wall mesh.
                        float edge = halfWidth - zebraWidth * 0.5f;
                        for (int side = -1; side <= 1; side += 2)
                        {
                            Vector3 c = p + right * (edge * side);
                            Vector3 f = dir * (zebraLen * 0.5f);
                            Vector3 w = right * (zebraWidth * 0.5f);
                            var verts = zebraRed ? redVerts : whiteVerts;
                            var tris = zebraRed ? redTris : whiteTris;
                            int b = verts.Count;
                            verts.Add(c - f - w + Vector3.up * 0.02f);
                            verts.Add(c - f + w + Vector3.up * 0.02f);
                            verts.Add(c + f + w + Vector3.up * 0.02f);
                            verts.Add(c + f - w + Vector3.up * 0.02f);
                            tris.Add(b); tris.Add(b + 1); tris.Add(b + 2);
                            tris.Add(b); tris.Add(b + 2); tris.Add(b + 3);
                        }
                        zebraRed = !zebraRed;
                        nextZebra += zebraEvery;
                    }

                    if (traveled >= nextPost)
                    {
                        // Tall marker post outside each edge, past the grass.
                        float postOff = halfWidth + grassWidth + 0.5f;
                        for (int side = -1; side <= 1; side += 2)
                        {
                            Vector3 c = p + right * (postOff * side);
                            int b = postVerts.Count;
                            postVerts.Add(c + new Vector3(-postHalf, 0f, -postHalf));
                            postVerts.Add(c + new Vector3(postHalf, 0f, -postHalf));
                            postVerts.Add(c + new Vector3(postHalf, postHeight, -postHalf));
                            postVerts.Add(c + new Vector3(-postHalf, postHeight, -postHalf));
                            postVerts.Add(c + new Vector3(-postHalf, 0f, postHalf));
                            postVerts.Add(c + new Vector3(postHalf, 0f, postHalf));
                            postVerts.Add(c + new Vector3(postHalf, postHeight, postHalf));
                            postVerts.Add(c + new Vector3(-postHalf, postHeight, postHalf));
                            postTris.AddRange(new[] { b, b + 1, b + 2, b, b + 2, b + 3,
                                                      b + 4, b + 6, b + 5, b + 4, b + 7, b + 6,
                                                      b + 0, b + 4, b + 5, b + 0, b + 5, b + 1,
                                                      b + 3, b + 2, b + 6, b + 3, b + 6, b + 7,
                                                      b + 1, b + 5, b + 6, b + 1, b + 6, b + 2,
                                                      b + 4, b + 0, b + 3, b + 4, b + 3, b + 7 });
                        }
                        nextPost += postEvery;
                    }

                    step += 0.5f;
                    traveled += 0.5f;
                }
            }

            var root = new GameObject("SpeedMarkers");
            root.transform.SetParent(transform, false);
            MakeMarkerMesh(root.transform, "ZebrasRed", redVerts, redTris, new Color(0.85f, 0.10f, 0.10f));
            MakeMarkerMesh(root.transform, "ZebrasWhite", whiteVerts, whiteTris, new Color(0.93f, 0.93f, 0.93f));
            MakeMarkerMesh(root.transform, "Posts", postVerts, postTris, new Color(0.10f, 0.45f, 0.85f));
        }

        /// <summary>
        /// Kerbs: red/white zebra tiles on the INNER edge of corners, centered
        /// ON the asphalt edge (half on track, half on grass) so they read as
        /// a real curb. Tiles are contiguous along the corner arc (no gaps)
        /// and 2x the size of the first version (playtest 2026-08-02).
        /// Visual only - no physics effect in the prototype.
        /// </summary>
        void BuildKerbs()
        {
            const float kerbWidth = 1.2f;      // m across (half on road, half on grass)
            const float kerbDepth = 4f;        // m along the track per tile (contiguous)
            const float kerbRadiusThresh = 250f; // tighter than this = kerbs

            var redV = new List<Vector3>();
            var redT = new List<int>();
            var whtV = new List<Vector3>();
            var whtT = new List<int>();
            bool red = true;

            // Tile slot = floor(traveled / kerbDepth): exactly ONE tile per
            // 4 m of arc. Using a cumulative nextKerb counter (old code)
            // desynced from traveled on straights - entering a corner after
            // a straight dumped a backlog of overlapping tiles in the first
            // 0.5 m ("kerbs stacked on each other" - user report 2026-08-02).
            float traveled = 0f;
            int lastSlot = -1;
            for (int i = 0; i < _centerline.Count - 1; i++)
            {
                Vector3 p0 = _centerline[i];
                Vector3 p1 = _centerline[i + 1];
                Vector3 d = p1 - p0;
                float segLen = d.magnitude;
                if (segLen < 0.001f) continue;
                Vector3 dir = d / segLen;
                Vector3 right = Vector3.Cross(Vector3.up, dir);

                int ia = Mathf.Max(0, i - 1);
                int ic = Mathf.Min(_centerline.Count - 1, i + 1);
                float radius = RadiusFromHeading(ia, i, ic);
                bool isCorner = radius < kerbRadiusThresh;
                Vector3 inner = right;
                if (isCorner)
                {
                    // Turn direction: cross of consecutive headings, y sign.
                    // cross.y > 0 = right turn -> inner is +right.
                    Vector3 d1 = _centerline[i] - _centerline[ia];
                    Vector3 d2 = _centerline[ic] - _centerline[i];
                    float cy = Vector3.Cross(d1, d2).y;
                    inner = right * (cy > 0f ? 1f : -1f);
                }

                float step = 0f;
                while (step < segLen)
                {
                    if (isCorner)
                    {
                        int slot = (int)(traveled / kerbDepth);
                        if (slot > lastSlot)
                        {
                            lastSlot = slot;
                            Vector3 p = p0 + dir * step;
                            Vector3 c = p + inner * HalfWidth; // centered ON the edge
                            Vector3 f = dir * (kerbDepth * 0.5f);
                            Vector3 w = inner * (kerbWidth * 0.5f);
                            var verts = red ? redV : whtV;
                            var tris = red ? redT : whtT;
                            int b = verts.Count;
                            verts.Add(c - f - w + Vector3.up * 0.03f);
                            verts.Add(c - f + w + Vector3.up * 0.03f);
                            verts.Add(c + f + w + Vector3.up * 0.03f);
                            verts.Add(c + f - w + Vector3.up * 0.03f);
                            tris.Add(b); tris.Add(b + 1); tris.Add(b + 2);
                            tris.Add(b); tris.Add(b + 2); tris.Add(b + 3);
                            red = !red;
                        }
                    }
                    step += 0.5f;
                    traveled += 0.5f;
                }
            }

            var root = new GameObject("Kerbs");
            root.transform.SetParent(transform, false);
            MakeMarkerMesh(root.transform, "KerbsRed", redV, redT, new Color(0.85f, 0.10f, 0.10f));
            MakeMarkerMesh(root.transform, "KerbsWhite", whtV, whtT, new Color(0.93f, 0.93f, 0.93f));
        }

        void MakeMarkerMesh(Transform parent, string name, List<Vector3> verts, List<int> tris, Color color)
        {
            if (verts.Count == 0) return;
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var mesh = new Mesh { name = name };
            mesh.SetVertices(verts);
            mesh.SetTriangles(tris, 0);
            mesh.RecalculateNormals();
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mat = new Material(Shader.Find("Universal Render Pipeline/Simple Lit"));
            mat.color = color;
            go.AddComponent<MeshRenderer>().sharedMaterial = mat;
        }

        /// <summary>
        /// Visible checkered band across the road at the start/finish line,
        /// so the lap crossing point is easy to verify visually.
        /// </summary>
        void BuildFinishLineMark()
        {
            const float bandDepth = 3f;   // meters along the track
            const int checkCols = 8;      // checks across the width
            const int checkRows = 2;      // checks along the depth

            var go = new GameObject("FinishLineMark");
            go.transform.SetParent(transform, false);
            go.transform.position = FinishLinePosition + Vector3.up * 0.02f;
            go.transform.rotation = Quaternion.LookRotation(FinishLineDirection, Vector3.up);

            var filter = go.AddComponent<MeshFilter>();
            var renderer = go.AddComponent<MeshRenderer>();

            // Procedural checkerboard texture.
            int texSize = 16;
            var tex = new Texture2D(texSize, texSize);
            tex.wrapMode = TextureWrapMode.Repeat;
            for (int y = 0; y < texSize; y++)
            {
                for (int x = 0; x < texSize; x++)
                {
                    bool white = ((x / (texSize / checkCols)) + (y / (texSize / checkRows))) % 2 == 0;
                    tex.SetPixel(x, y, white ? Color.white : Color.black);
                }
            }
            tex.Apply();

            var mat = new Material(Shader.Find("Universal Render Pipeline/Simple Lit"));
            mat.mainTexture = tex;
            renderer.sharedMaterial = mat;

            // Flat quad across the track width.
            var mesh = new Mesh { name = "FinishLineMark" };
            float halfW = trackWidth * 0.5f;
            float halfD = bandDepth * 0.5f;
            mesh.vertices = new[]
            {
                new Vector3(-halfW, 0f, -halfD),
                new Vector3(-halfW, 0f, halfD),
                new Vector3(halfW, 0f, halfD),
                new Vector3(halfW, 0f, -halfD)
            };
            mesh.uv = new[]
            {
                new Vector2(0f, 0f),
                new Vector2(0f, 1f),
                new Vector2(1f, 1f),
                new Vector2(1f, 0f)
            };
            mesh.triangles = new[] { 0, 1, 2, 0, 2, 3 };
            mesh.RecalculateNormals();
            filter.sharedMesh = mesh;
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
