using NUnit.Framework;
using Unity.Mathematics;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Pure-math tests for Story 006 (Presentation — Render Interpolation): α computation,
    /// Lerp/Slerp correctness with valid-input-precedence rotation fallback, monotonicity at
    /// 60/30/144 Hz cadences, buffer advancement (visual snappiness), and the never-leads
    /// invariant. Engine wiring (LateUpdate, Rigidbody.interpolation, visual hierarchy) is
    /// deferred to the MVP-assembly gate per the story.
    /// </summary>
    public class InterpolationTests
    {
        private const float Tolerance1E4 = 1e-4f;
        private const float FixedDt = SimulationTickContext.FIXED_DT;

        // =================================================================================
        // AC-2.1: α = remainder / FIXED_DT ≈ 0.48 (±0.02) at 8ms
        // =================================================================================

        [Test]
        public void AC21_AlphaAtEightMillisecondsIsZeroPointFourEight()
        {
            float alpha = RenderInterpolator.ComputeAlpha(0.008f);

            Assert.AreEqual(0.48f, alpha, 0.02f);
            Assert.Less(alpha, 1f, "alpha never reaches 1");
        }

        [Test]
        public void AC21_ZeroRemainderYieldsZeroAlpha()
        {
            Assert.AreEqual(0f, RenderInterpolator.ComputeAlpha(0f), 1e-6f);
        }

        [Test]
        public void AC21_RemainderApproachingFixedDtYieldsAlphaApproachingOne()
        {
            float nearFull = FixedDt - 1e-5f;
            float alpha = RenderInterpolator.ComputeAlpha(nearFull);

            Assert.Greater(alpha, 0.9f);
            Assert.Less(alpha, 1f, "strictly below 1 (precondition remainder < FIXED_DT)");
        }

        // =================================================================================
        // AC-2.5: position Lerp, rotation Slerp
        // =================================================================================

        [Test]
        public void AC25_AlphaZeroReturnsPreviousPose()
        {
            var previous = new CarState(1, new float3(0f, 0f, 0f), quaternion.EulerXYZ(0f, 0f, 0f));
            var current = new CarState(1, new float3(10f, 0f, 0f), quaternion.EulerXYZ(0f, 0f, 90f * math.PI / 180f));

            CarState result = RenderInterpolator.Interpolate(previous, current, 0f);

            Assert.AreEqual(0f, result.Position3.x, Tolerance1E4);
            Assert.AreEqual(0f, math.lengthsq(result.Rotation.value - previous.Rotation.value), Tolerance1E4,
                "α=0 returns the previous rotation");
        }

        [Test]
        public void AC25_IdenticalPosesUnchanged()
        {
            var pose = new CarState(1, new float3(5f, 2f, -3f), quaternion.EulerXYZ(0.1f, 0.2f, 0.3f));

            CarState result = RenderInterpolator.Interpolate(pose, pose, 0.5f);

            Assert.AreEqual(5f, result.Position3.x, Tolerance1E4);
            Assert.AreEqual(2f, result.Position3.y, Tolerance1E4);
            Assert.AreEqual(-3f, result.Position3.z, Tolerance1E4);
            Assert.AreEqual(0f, math.lengthsq(result.Rotation.value - pose.Rotation.value), Tolerance1E4,
                "identical rotations stay identical");
        }

        [Test]
        public void AC25_AntipodalQuaternionsAreEquivalent()
        {
            var q = quaternion.EulerXYZ(0f, 0f, 30f * math.PI / 180f);
            var qNeg = new quaternion(-q.value); // same rotation, negated representation
            var from = new CarState(1, new float3(0f, 0f, 0f), q);
            var to = new CarState(1, new float3(1f, 0f, 0f), qNeg);

            CarState result = RenderInterpolator.Interpolate(from, to, 0.5f);

            Assert.AreEqual(0f, math.lengthsq(result.Rotation.value - q.value), 1e-3f,
                "antipodal representations interpolate to the same rotation (shortest path)");
        }

        [Test]
        public void AC25_PositionUsesLinearLerp()
        {
            var previous = new CarState(1, new float3(0f, 0f, 0f), quaternion.identity);
            var current = new CarState(1, new float3(10f, 0f, 0f), quaternion.identity);

            CarState result = RenderInterpolator.Interpolate(previous, current, 0.25f);

            Assert.AreEqual(2.5f, result.Position3.x, Tolerance1E4, "Lerp(P0, P1, 0.25)");
            Assert.AreEqual(0f, result.Position3.y, Tolerance1E4);
            Assert.AreEqual(0f, result.Position3.z, Tolerance1E4);
        }

        // =================================================================================
        // AC-2.5 rotation fallback: valid-input precedence, never non-finite
        // =================================================================================

        [Test]
        public void AC25_CurrentInvalidRotationFallsBackToPrevious()
        {
            var previous = new CarState(1, new float3(0f, 0f, 0f), quaternion.EulerXYZ(0f, 0.5f, 0f));
            var current = new CarState(1, new float3(1f, 0f, 0f),
                new quaternion(float.NaN, 0f, 0f, 1f)); // invalid: NaN component

            CarState result = RenderInterpolator.Interpolate(previous, current, 0.5f);

            Assert.AreEqual(0f, math.lengthsq(result.Rotation.value - previous.Rotation.value), 1e-3f,
                "current invalid → previous rotation used");
            Assert.IsTrue(math.all(math.isfinite(result.Rotation.value)), "output never non-finite");
        }

        [Test]
        public void AC25_PreviousInvalidRotationFallsBackToCurrent()
        {
            var previous = new CarState(1, new float3(0f, 0f, 0f), new quaternion(0f, 0f, 0f, 0f)); // zero quaternion
            var current = new CarState(1, new float3(1f, 0f, 0f), quaternion.EulerXYZ(0f, 0.5f, 0f));

            CarState result = RenderInterpolator.Interpolate(previous, current, 0.5f);

            Assert.AreEqual(0f, math.lengthsq(result.Rotation.value - current.Rotation.value), 1e-3f,
                "previous invalid → current rotation used");
            Assert.IsTrue(math.all(math.isfinite(result.Rotation.value)), "output never non-finite");
        }

        [Test]
        public void AC25_BothInvalidRotationsYieldIdentity()
        {
            var previous = new CarState(1, new float3(0f, 0f, 0f), new quaternion(float.PositiveInfinity, 0f, 0f, 0f));
            var current = new CarState(1, new float3(1f, 0f, 0f), new quaternion(0f, 0f, 0f, 0f));

            CarState result = RenderInterpolator.Interpolate(previous, current, 0.5f);

            Assert.AreEqual(0f, math.lengthsq(result.Rotation.value - quaternion.identity.value), 1e-3f,
                "both invalid → identity rotation");
            Assert.IsTrue(math.all(math.isfinite(result.Rotation.value)), "output never non-finite");
        }

        // =================================================================================
        // AC-2.2/2.3/2.4: monotonicity at 60/30/144 Hz, Lerp within 1e-4
        // =================================================================================

        [Test]
        public void AC22_SixtyHzMonotonicAndMatchesLerp()
        {
            // Constant velocity +x: each completed step advances position by 1 unit.
            var steps = new CarState[12];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new CarState(1, new float3(i, 0f, 0f), quaternion.identity);

            var previous = steps[0];
            var current = steps[1];
            float previousPosition = 0f;

            for (int frame = 0; frame < 10; frame++)
            {
                float remainder = 0.5f * FixedDt; // 60Hz display at 60Hz sim: half a tick in
                float alpha = RenderInterpolator.ComputeAlpha(remainder);
                CarState visual = RenderInterpolator.Interpolate(previous, current, alpha);

                float expected = math.lerp(previous.Position3.x, current.Position3.x, alpha);
                Assert.AreEqual(expected, visual.Position3.x, Tolerance1E4, $"frame {frame} matches Lerp");
                Assert.GreaterOrEqual(visual.Position3.x, previousPosition, $"frame {frame} monotonic +x");
                previousPosition = visual.Position3.x;

                RenderInterpolator.AdvanceVisualBuffers(ref previous, ref current, steps[frame + 2]);
            }
        }

        [Test]
        public void AC23_ThirtyHzMonotonicAndMatchesLerp()
        {
            // 30Hz display at 60Hz sim: two steps per interval. The normal case carries a
            // NONZERO remainder after the second step (a real 30Hz interval is rarely exactly
            // 2×FIXED_DT) — interpolation must match independent Lerp at that remainder.
            var steps = new CarState[30];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new CarState(1, new float3(i, 0f, 0f), quaternion.identity);

            var previous = steps[0];
            var current = steps[1];
            int stepIndex = 1;
            float previousPosition = 0f;

            for (int frame = 0; frame < 10; frame++)
            {
                // Two steps complete this interval (frame runs at 2×FIXED_DT).
                RenderInterpolator.AdvanceVisualBuffers(ref previous, ref current, steps[++stepIndex]);
                RenderInterpolator.AdvanceVisualBuffers(ref previous, ref current, steps[++stepIndex]);

                // Nonzero remainder after the second step (normal case) — independently
                // verified Lerp output (QA case AC-2.3).
                float remainder = 0.3f * FixedDt;
                float alpha = RenderInterpolator.ComputeAlpha(remainder);
                CarState visual = RenderInterpolator.Interpolate(previous, current, alpha);

                float expected = math.lerp(previous.Position3.x, current.Position3.x, alpha);
                Assert.AreEqual(expected, visual.Position3.x, Tolerance1E4,
                    $"frame {frame} matches independent Lerp at nonzero remainder");
                Assert.GreaterOrEqual(visual.Position3.x, previousPosition, $"frame {frame} monotonic +x");
                previousPosition = visual.Position3.x;
            }
        }

        [Test]
        public void AC24_OneHundredFortyFourHzMonotonicAndMatchesLerp()
        {
            // 144Hz display: zero or one step per frame; interpolate with the current remainder.
            var steps = new CarState[20];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new CarState(1, new float3(i, 0f, 0f), quaternion.identity);

            var previous = steps[0];
            var current = steps[1];
            int stepIndex = 1;
            float previousPosition = 0f;

            for (int frame = 0; frame < 10; frame++)
            {
                // Alternate: some frames complete a step (advancing buffers), some do not.
                bool stepThisFrame = frame % 2 == 0;
                if (stepThisFrame && stepIndex + 1 < steps.Length)
                {
                    RenderInterpolator.AdvanceVisualBuffers(ref previous, ref current, steps[++stepIndex]);
                }

                float remainder = (stepThisFrame ? 0.1f : 0.4f) * FixedDt;
                float alpha = RenderInterpolator.ComputeAlpha(remainder);
                CarState visual = RenderInterpolator.Interpolate(previous, current, alpha);

                float expected = math.lerp(previous.Position3.x, current.Position3.x, alpha);
                Assert.AreEqual(expected, visual.Position3.x, Tolerance1E4, $"frame {frame} matches Lerp");
                Assert.GreaterOrEqual(visual.Position3.x, previousPosition, $"frame {frame} monotonic +x");
                previousPosition = visual.Position3.x;
            }
        }

        [Test]
        public void AC22_NegativeVelocityMonotonicInNegativeDirection()
        {
            // QA edge case: negative velocity → monotonic in the negative direction. Uses a
            // NON-midpoint alpha (0.25) so a reversed-endpoint implementation
            // (Lerp(current, previous, α)) cannot survive via midpoint symmetry.
            var steps = new CarState[12];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new CarState(1, new float3(10f - i, 0f, 0f), quaternion.identity); // decreasing x

            var previous = steps[0];
            var current = steps[1];
            float previousPosition = previous.Position3.x;

            for (int frame = 0; frame < 10; frame++)
            {
                float alpha = RenderInterpolator.ComputeAlpha(0.25f * FixedDt);
                CarState visual = RenderInterpolator.Interpolate(previous, current, alpha);

                float expected = math.lerp(previous.Position3.x, current.Position3.x, alpha);
                Assert.AreEqual(expected, visual.Position3.x, Tolerance1E4, $"frame {frame} matches Lerp");
                Assert.LessOrEqual(visual.Position3.x, previousPosition, $"frame {frame} monotonic -x");
                previousPosition = visual.Position3.x;

                RenderInterpolator.AdvanceVisualBuffers(ref previous, ref current, steps[frame + 2]);
            }
        }

        [Test]
        public void AC25_SlerpInteriorAngleMatchesIndependentComputation()
        {
            // QA edge: two DISTINCT valid rotations at a NON-midpoint interior alpha must
            // produce the shortest-path normalized slerp — kills both a degenerate
            // always-returns-previous implementation AND a reversed-endpoint
            // (slerp(current, previous, α)) implementation, which midpoint symmetry would
            // otherwise mask.
            var previous = new CarState(1, new float3(0f, 0f, 0f), quaternion.EulerXYZ(0f, 0f, 0f));
            var current = new CarState(1, new float3(10f, 0f, 0f), quaternion.EulerXYZ(0f, 90f * math.PI / 180f, 0f));
            const float alpha = 0.25f;

            CarState result = RenderInterpolator.Interpolate(previous, current, alpha);

            quaternion expected = math.slerp(previous.Rotation, current.Rotation, alpha);
            Assert.AreEqual(0f, math.lengthsq(result.Rotation.value - expected.value), 1e-3f,
                "interior slerp matches independent shortest-path computation");
            Assert.AreEqual(1f, math.length(result.Rotation.value), 1e-3f, "output is normalized");

            // The result must differ from the previous rotation (proves interpolation happened).
            Assert.Greater(math.lengthsq(result.Rotation.value - previous.Rotation.value), 1e-4f,
                "interior alpha actually interpolates, not returns previous");
        }

        // =================================================================================
        // Buffer advancement (visual snappiness) — final two completed states only
        // =================================================================================

        [Test]
        public void Buffers_AdvanceOneStepShiftsPreviousToCurrent()
        {
            var previous = new CarState(1, new float3(0f, 0f, 0f), quaternion.identity);
            var current = new CarState(1, new float3(1f, 0f, 0f), quaternion.identity);
            var completed = new CarState(1, new float3(2f, 0f, 0f), quaternion.identity);

            RenderInterpolator.AdvanceVisualBuffers(ref previous, ref current, completed);

            Assert.AreEqual(1f, previous.Position3.x, Tolerance1E4, "previous ← old current");
            Assert.AreEqual(2f, current.Position3.x, Tolerance1E4, "current ← completed step");
        }

        [Test]
        public void Buffers_MultiStepFrameKeepsOnlyFinalTwo()
        {
            var steps = new CarState[5];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new CarState(1, new float3(i, 0f, 0f), quaternion.identity);

            var previous = steps[0];
            var current = steps[1];

            // A 3-step frame: advance 3 times, then interpolate.
            for (int i = 2; i <= 4; i++)
                RenderInterpolator.AdvanceVisualBuffers(ref previous, ref current, steps[i]);

            Assert.AreEqual(3f, previous.Position3.x, Tolerance1E4, "previous holds step 3");
            Assert.AreEqual(4f, current.Position3.x, Tolerance1E4, "current holds step 4");
            CarState visual = RenderInterpolator.Interpolate(previous, current, 0.5f);
            Assert.AreEqual(3.5f, visual.Position3.x, Tolerance1E4,
                "interpolates only the final two completed states (snappiness)");
        }

        // =================================================================================
        // AC-2.6: α ∈ [0, 1), never leads ahead
        // =================================================================================

        [Test]
        public void AC26_AlphaAlwaysInRangeZeroToOne()
        {
            float[] remainders = { 0f, 0.1f * FixedDt, 0.5f * FixedDt, 0.99f * FixedDt };
            foreach (float remainder in remainders)
            {
                float alpha = RenderInterpolator.ComputeAlpha(remainder);
                Assert.GreaterOrEqual(alpha, 0f);
                Assert.Less(alpha, 1f);
            }
        }

        [Test]
        public void AC26_VisualNeverLeadsAheadOfCurrentState()
        {
            var previous = new CarState(1, new float3(0f, 0f, 0f), quaternion.identity);
            var current = new CarState(1, new float3(10f, 0f, 0f), quaternion.identity);

            // Every alpha in [0, 1): visual position lies ON or BETWEEN previous and current.
            foreach (float alpha in new[] { 0f, 0.1f, 0.5f, 0.99f })
            {
                CarState visual = RenderInterpolator.Interpolate(previous, current, alpha);
                Assert.GreaterOrEqual(visual.Position3.x, 0f - Tolerance1E4, "never behind previous");
                Assert.LessOrEqual(visual.Position3.x, 10f + Tolerance1E4, "never leads beyond current");
            }
        }

        [Test]
        public void AC26_ZeroVelocityYieldsIdenticalPositions()
        {
            var stationary = new CarState(1, new float3(4f, 0f, 0f), quaternion.identity);

            CarState visual = RenderInterpolator.Interpolate(stationary, stationary, 0.5f);

            Assert.AreEqual(4f, visual.Position3.x, Tolerance1E4);
            Assert.AreEqual(0f, visual.Position3.y, Tolerance1E4);
            Assert.AreEqual(0f, visual.Position3.z, Tolerance1E4);
        }
    }
}
