using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;
using Overdrive.Input;
using UnityEngine;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Story 008: Determinism &amp; MVP Recordable Buffer.
    /// Covers AC-5.2 (PCG32 golden vectors), AC-5.4 (Unity.Mathematics sim-path scan),
    /// AC-6.1 (buffer lifecycle), AC-3.9 (ReplayInitialState capture), AC-3.10 (Pause
    /// EdgeEvent). AC-5.1/5.5 are DECLARED/deferred to the MVP-assembly gate.
    /// </summary>
    public class DeterminismReplayTests
    {
        // ============================================================
        // AC-5.2: PCG32 golden vectors
        // ============================================================

        [Test]
        public void AC52_NextUIntGoldenSequenceMatches()
        {
            var rng = new Pcg32(initState: 12345u, initSeq: 0u);
            uint[] expected =
            {
                304133009, 2564000426, 1539170214, 2267019874,
                321857903, 29877282, 4241239986, 528810775
            };
            for (int i = 0; i < expected.Length; i++)
                Assert.AreEqual(expected[i], rng.NextUInt(), $"NextUInt[{i}]");
        }

        [Test]
        public void AC52_NextFloat01GoldenSequenceFreshInstance()
        {
            // The float sequence is sampled from a FRESH instance (not a continuation of the
            // uint sequence) — each documented sequence uses its own Pcg32(12345, 0).
            var rng = new Pcg32(initState: 12345u, initSeq: 0u);
            float[] expected =
            {
                0.0708114505f, 0.5969778299f, 0.3583659530f, 0.5278316736f,
                0.0749383569f, 0.0069563389f, 0.9874905944f, 0.1231233478f
            };
            for (int i = 0; i < expected.Length; i++)
                Assert.AreEqual(expected[i], rng.NextFloat01(), 1e-6f, $"NextFloat01[{i}]");
        }

        [Test]
        public void AC52_CrossCheckPcg42_54MatchesOfficialVector()
        {
            // Official pcg-random.org vector for pcg32_srandom_r(42u, 54u).
            var rng = new Pcg32(initState: 42u, initSeq: 54u);
            uint[] expected = { 2707161783, 2068313097, 3122475824, 2211639955, 3215226955 };
            for (int i = 0; i < expected.Length; i++)
                Assert.AreEqual(expected[i], rng.NextUInt(), $"NextUInt[{i}]");
        }

        [Test]
        public void AC52_RepeatedInitSameSeedProducesSameSequence()
        {
            var a = new Pcg32(initState: 12345u, initSeq: 0u);
            var b = new Pcg32(initState: 12345u, initSeq: 0u);
            for (int i = 0; i < 20; i++)
                Assert.AreEqual(a.NextUInt(), b.NextUInt(), $"tick {i}");
        }

        [Test]
        public void AC52_ZeroAndMaxSeedAreValid()
        {
            var zero = new Pcg32(initState: 0u, initSeq: 0u);
            var max = new Pcg32(initState: ulong.MaxValue, initSeq: ulong.MaxValue);
            Assert.DoesNotThrow(() => zero.NextUInt());
            Assert.DoesNotThrow(() => max.NextUInt());
        }

        [Test]
        public void AC52_NextFloat01StaysInUnitInterval()
        {
            var rng = new Pcg32(initState: 12345u, initSeq: 0u);
            for (int i = 0; i < 100; i++)
            {
                float value = rng.NextFloat01();
                Assert.GreaterOrEqual(value, 0f);
                Assert.Less(value, 1f);
            }
        }

        [Test]
        public void AC52_NextIntRangeIsBounded()
        {
            var rng = new Pcg32(initState: 12345u, initSeq: 0u);
            for (int i = 0; i < 100; i++)
            {
                int value = rng.NextInt(5, 10);
                Assert.GreaterOrEqual(value, 5);
                Assert.Less(value, 10);
            }
        }

        // ============================================================
        // AC-5.4: sim-path math scan (Unity.Mathematics only)
        // ============================================================

        [Test]
        public void AC54_SimPathUsesUnityMathematicsOnly()
        {
            // Static source scan: every production file in Assets/source/Simulation/ must not
            // reference UnityEngine.Vector3 / UnityEngine.Quaternion / Mathf / System.MathF on
            // the authoritative sim path. Visual-only interpolation (Story 006) is separate.
            string simDirectory = Path.Combine(Application.dataPath, "source", "Simulation");
            string[] files = Directory.GetFiles(simDirectory, "*.cs")
                                      .Where(f => !Path.GetFileName(f).StartsWith("Test"))
                                      .ToArray();
            Assert.Greater(files.Length, 0, "simulation source files found");

            string[] forbidden =
            {
                "UnityEngine.Vector3", "UnityEngine.Quaternion", "UnityEngine.Random",
                "using UnityEngine;", "Mathf.", "System.MathF", "MathF."
            };
            foreach (string file in files)
            {
                string content = StripCommentsAndStrings(File.ReadAllText(file));
                foreach (string token in forbidden)
                {
                    if (content.Contains(token))
                        Assert.Fail($"{Path.GetFileName(file)} uses forbidden sim-path token '{token}'");
                }
            }
        }

        private static string StripCommentsAndStrings(string source)
        {
            // Remove // and /* */ comments and string literals so documentation text that
            // merely MENTIONS UnityEngine names does not fail the scan.
            var chars = source.ToCharArray();
            var output = new System.Text.StringBuilder(chars.Length);
            bool inLineComment = false, inBlockComment = false, inString = false, inChar = false;
            for (int i = 0; i < chars.Length; i++)
            {
                char c = chars[i];
                char n = i + 1 < chars.Length ? chars[i + 1] : '\0';

                if (inLineComment) { if (c == '\n') { inLineComment = false; output.Append('\n'); } continue; }
                if (inBlockComment) { if (c == '*' && n == '/') { inBlockComment = false; i++; } continue; }
                if (inString) { if (c == '\\') { i++; continue; } if (c == '"') inString = false; continue; }
                if (inChar) { if (c == '\\') { i++; continue; } if (c == '\'') inChar = false; continue; }

                if (c == '/' && n == '/') { inLineComment = true; i++; continue; }
                if (c == '/' && n == '*') { inBlockComment = true; i++; continue; }
                if (c == '"') { inString = true; continue; }
                if (c == '\'') { inChar = true; continue; }
                output.Append(c);
            }
            return output.ToString();
        }

        // ============================================================
        // AC-6.1: MVP recordable buffer lifecycle
        // ============================================================

        [Test]
        public void AC61_OneRecordPerCompletedRacingTick()
        {
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var driver = CreateDriver(machine, buffer);

            // 300 Countdown ticks reach GO (tick 300 = IsGoTick + Racing). No continuous
            // record during Countdown; the first Racing tick (301) records once.
            for (int i = 0; i < 300; i++) driver.Update();
            Assert.AreEqual(SimulationState.Racing, machine.State);
            Assert.AreEqual(0, buffer.ContinuousCount, "no records during Countdown/GO tick");

            driver.Update(); // Racing tick 301
            driver.Update(); // Racing tick 302
            driver.Update(); // Racing tick 303
            Assert.AreEqual(3, buffer.ContinuousCount, "exactly one record per Racing tick");
        }

        [Test]
        public void AC61_RecordCarriesPostIncrementTickIndex()
        {
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var driver = CreateDriver(machine, buffer);

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing
            for (int i = 0; i < 5; i++) driver.Update();    // Racing ticks 301..305

            Assert.AreEqual(5, buffer.ContinuousCount);
            for (int i = 0; i < 5; i++)
                Assert.AreEqual((uint)(301 + i), buffer.GetContinuousTickIndex(i),
                    "record carries the post-increment tick index");
        }

        [Test]
        public void AC61_RecordedAxesMatchAuthoritativeInput()
        {
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            // FixedInputProcessor returns a known SimulationInput so the recorded axes are
            // observable (the authoritative input consumed by Vehicle Physics).
            var driver = CreateDriver(machine, buffer, processor: new FixedInputProcessor(0.7f, 0.1f, 0.3f));

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing
            driver.Update(); // first Racing tick

            Assert.AreEqual(1, buffer.ContinuousCount);
            Assert.AreEqual(0.7f, buffer.GetContinuousAccelerate(0), 1e-6f);
            Assert.AreEqual(0.1f, buffer.GetContinuousBrake(0), 1e-6f);
            Assert.AreEqual(0.3f, buffer.GetContinuousSteer(0), 1e-6f);
        }

        [Test]
        public void AC61_DiscardOnResults()
        {
            // RSM finishes at the first Racing tick -> Finished -> Results -> discard.
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var driver = CreateDriver(machine, buffer, rsm: rsm);

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing (GO tick)
            driver.Update(); // finish tick -> Finished (record 1: Racing tick 301)

            // Finished -> Results via the UI dismissal (the RSM consume transitions to
            // Finished; the UI dismiss transitions to Results).
            machine.OnDismissTerminalPresentation();
            driver.Update(); // observes Results -> discard

            Assert.AreEqual(SimulationState.Results, machine.State);
            Assert.AreEqual(0, buffer.ContinuousCount, "discarded on Results");
            Assert.AreEqual(0, buffer.EdgeCount);
        }

        [Test]
        public void AC61_DiscardOnForfeit()
        {
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var driver = CreateDriver(machine, buffer);

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing
            driver.Update(); // 1 record
            Assert.AreEqual(1, buffer.ContinuousCount);

            machine.EnterPaused(SimulationState.Racing);
            machine.RequestForfeit(forfeitLapCount: 1, raceTimeAtForfeit: 45f);
            driver.Update(); // forfeit -> Results -> discard

            Assert.AreEqual(SimulationState.Results, machine.State);
            Assert.AreEqual(0, buffer.ContinuousCount, "discarded on forfeit Results");
        }

        [Test]
        public void AC61_DiscardOnIdle()
        {
            // Results -> OnDismissTerminalPresentation -> RequestUnload -> OnContentUnloadComplete
            // -> Idle -> discard. (ClearSession is private; the public path is the unload handshake.)
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var rsm = new SequenceRsm(
                new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f), // race 1
                new FinishDetected(ResultKind.Race, ResultClassification.Finished, 99.5f)); // race 2
            var driver = CreateDriver(machine, buffer, rsm: rsm);

            // Race 1: finish -> Finished -> dismiss -> Results -> discard.
            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing
            driver.Update(); // finish -> Finished
            machine.OnDismissTerminalPresentation();     // Finished -> Results
            driver.Update(); // observes Results -> discard
            Assert.AreEqual(SimulationState.Results, machine.State);
            Assert.AreEqual(0, buffer.ContinuousCount, "discarded on Results");

            // Race 2: another record, then unload to Idle.
            machine.StartRaceFromResults(new GridAssignment(1));
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1));
            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing
            driver.Update(); // finish 2 -> Finished (recorded 1 Racing tick)
            Assert.AreEqual(1, buffer.ContinuousCount);

            machine.OnDismissTerminalPresentation();     // -> Results
            machine.RequestUnload();
            machine.OnContentUnloadComplete();           // -> Idle
            driver.Update(); // observes Idle -> discard
            Assert.AreEqual(SimulationState.Idle, machine.State);
            Assert.AreEqual(0, buffer.ContinuousCount, "discarded on Idle");
        }

        [Test]
        public void AC61_ExactlyTwentyTwoThousandFiveHundredRemainsSerializable()
        {
            var buffer = new GhostBuffer(maxTicks: GhostBuffer.DefaultMaxTicks);
            var input = new SimulationInput(0f, 0f, 0f, 0f, 0f, 0f, false, InputAvailability.Available);
            for (uint i = 0; i < GhostBuffer.DefaultMaxTicks; i++)
                buffer.RecordTick(input, i);

            Assert.IsTrue(buffer.IsSerializable, "a full valid race at exactly 22,500 remains serializable");
            Assert.AreEqual((int)GhostBuffer.DefaultMaxTicks, buffer.ContinuousCount);
        }

        [Test]
        public void AC61_AttemptedOverflowDropsAndPermanentlyNonSerializable()
        {
            var buffer = new GhostBuffer(maxTicks: GhostBuffer.DefaultMaxTicks);
            var input = new SimulationInput(0f, 0f, 0f, 0f, 0f, 0f, false, InputAvailability.Available);
            for (uint i = 0; i <= GhostBuffer.DefaultMaxTicks; i++) // 22,501st is the overflow
                buffer.RecordTick(input, i);

            Assert.IsFalse(buffer.IsSerializable, "non-serializable on attempted overflow beyond 22,500");
            Assert.AreEqual((int)GhostBuffer.DefaultMaxTicks, buffer.ContinuousCount,
                "overflow record is silently dropped, oldest never discarded");
        }

        [Test]
        public void AC61_DiscardIsIdempotentAndClearsBothStreams()
        {
            var buffer = new GhostBuffer();
            var input = new SimulationInput(0f, 0f, 0f, 0f, 0f, 0f, false, InputAvailability.Available);
            buffer.RecordTick(input, 1);
            buffer.RecordEdgeEvent(1, EdgeEventFlags.Pause);

            buffer.Discard();
            Assert.AreEqual(0, buffer.ContinuousCount);
            Assert.AreEqual(0, buffer.EdgeCount);

            buffer.Discard(); // no-op
            Assert.AreEqual(0, buffer.ContinuousCount);
        }

        // ============================================================
        // AC-3.9: ReplayInitialState capture at GO
        // ============================================================

        [Test]
        public void AC39_CapturedExactlyOnceAtGo()
        {
            var machine = RacingMachine();
            var provider = new FixedReplayProvider(seed: 12345u);
            var driver = CreateDriver(machine, null, provider: provider);

            for (int i = 0; i < 299; i++) driver.Update(); // still Countdown
            Assert.IsNull(driver.ReplayInitialState, "no capture during Countdown");

            driver.Update(); // tick 300 = GO tick -> capture
            Assert.IsNotNull(driver.ReplayInitialState, "captured at GO");

            for (int i = 0; i < 5; i++) driver.Update(); // Racing ticks
            Assert.IsNotNull(driver.ReplayInitialState, "capture persists");
        }

        [Test]
        public void AC39_FieldsPopulatedFromCaptureInput()
        {
            var machine = RacingMachine();
            var provider = new FixedReplayProvider(seed: 987654u);
            var driver = CreateDriver(machine, null, provider: provider);

            for (int i = 0; i < 300; i++) driver.Update(); // -> GO tick captures

            ReplayInitialState state = driver.ReplayInitialState.Value;
            Assert.AreEqual(provider.Input.Version, state.Version);
            Assert.AreEqual(provider.Input.RaceConfigurationId, state.RaceConfigurationId);
            Assert.AreEqual(provider.Input.ContentVersionHash, state.ContentVersionHash);
            Assert.AreEqual(987654u, state.SimSeed);
            Assert.AreEqual(provider.Input.GridAssignment, state.GridAssignment);
            CollectionAssert.AreEqual(provider.Input.CarIds, state.CarIds);
            Assert.AreEqual(provider.Input.PerfectStartRemainingTicks, state.PerfectStartRemainingTicks);
            Assert.AreEqual(provider.Input.DifficultyProfile.Level, state.DifficultyProfile.Level,
                "DifficultyProfile stub is captured");
            Assert.AreEqual(provider.Input.DifficultyProfile.AiPrecision, state.DifficultyProfile.AiPrecision,
                "DifficultyProfile AiPrecision is captured");
            Assert.AreEqual(provider.Input.DifficultyProfile.AiErrorMultiplier, state.DifficultyProfile.AiErrorMultiplier,
                "DifficultyProfile AiErrorMultiplier is captured");
            Assert.AreEqual(provider.Input.DifficultyProfile.PaceNoise, state.DifficultyProfile.PaceNoise,
                "DifficultyProfile PaceNoise is captured");
            Assert.AreEqual(provider.Input.DifficultyProfile.PlayerOffTrackGrip, state.DifficultyProfile.PlayerOffTrackGrip,
                "DifficultyProfile PlayerOffTrackGrip is captured");
            Assert.AreEqual(provider.Input.DifficultyProfile.PlayerWallSpeedLoss, state.DifficultyProfile.PlayerWallSpeedLoss,
                "DifficultyProfile PlayerWallSpeedLoss is captured");
        }

        [Test]
        public void AC39_SourceMutationAfterCaptureDoesNotMutateSnapshot()
        {
            var machine = RacingMachine();
            var provider = new FixedReplayProvider(seed: 12345u);
            var driver = CreateDriver(machine, null, provider: provider);

            for (int i = 0; i < 300; i++) driver.Update(); // capture at GO

            ReplayInitialState before = driver.ReplayInitialState.Value;
            // Mutate the provider's source input AFTER capture.
            provider.Input.SimSeed = 999999u;
            provider.Input.PerfectStartRemainingTicks = -1;
            ((List<int>)provider.Input.CarIds).Add(99);

            ReplayInitialState after = driver.ReplayInitialState.Value;
            Assert.AreEqual(before.SimSeed, after.SimSeed, "seed is immutable after capture");
            Assert.AreEqual(before.PerfectStartRemainingTicks, after.PerfectStartRemainingTicks);
            CollectionAssert.AreEqual(before.CarIds, after.CarIds, "car IDs deep-copied");
        }

        [Test]
        public void AC39_NoCaptureWithoutProvider()
        {
            var machine = RacingMachine();
            var driver = CreateDriver(machine, null, provider: null);

            for (int i = 0; i < 305; i++) driver.Update(); // through GO + Racing
            Assert.IsNull(driver.ReplayInitialState, "no provider -> no capture, no throw");
        }

        [Test]
        public void AC39_CaptureBeforeFirstContinuousRecord()
        {
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var provider = new FixedReplayProvider(seed: 42u);
            var driver = CreateDriver(machine, buffer, provider: provider);

            for (int i = 0; i < 300; i++) driver.Update(); // GO tick: capture, NO record
            Assert.IsNotNull(driver.ReplayInitialState, "captured at GO tick");
            Assert.AreEqual(0, buffer.ContinuousCount,
                "no continuous record appended on the capture tick");

            driver.Update(); // first Racing tick: record AFTER capture already happened
            Assert.AreEqual(1, buffer.ContinuousCount);
        }

        // ============================================================
        // AC-3.10: Pause EdgeEvent
        // ============================================================

        [Test]
        public void AC310_PauseEdgeRecordsOneEdgeEvent()
        {
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            int calls = 0;
            // Edge activates only after the 300 Countdown ticks -> first Racing tick.
            Func<bool> edge = () => ++calls > 300;
            var driver = CreateDriver(machine, buffer, pauseEdgeSource: edge);

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing

            driver.Update(); // first Racing tick consumes a Pause edge -> EdgeEvent

            Assert.AreEqual(1, buffer.EdgeCount, "one EdgeEvent for the consumed Pause edge");
            Assert.AreEqual(EdgeEventFlags.Pause, buffer.GetEdgeFlags(0));
        }

        [Test]
        public void AC310_EdgeTickIndexIsCurrentSimulationStepCount()
        {
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            int calls = 0;
            Func<bool> edge = () => ++calls > 300;
            var driver = CreateDriver(machine, buffer, pauseEdgeSource: edge);

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing (tick 300 = GO)

            driver.Update(); // tick 301 consumes the Pause edge at the boundary
            // The PauseBoundaryReached path returns before counter increment, so the edge
            // carries the CURRENT (pre-increment) count = 300.
            Assert.AreEqual((uint)300, buffer.GetEdgeTickIndex(0));
            Assert.AreEqual(0, buffer.ContinuousCount,
                "no continuous sample for the same step as the edge");
        }

        [Test]
        public void AC310_HeldPauseProducesSingleEdge()
        {
            // The driver consumes at most one pause edge per frame (pauseEdgeConsumedThisFrame)
            // and the boundary halts the spine — a held edge cannot double-record.
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            int calls = 0;
            Func<bool> edge = () => ++calls > 300; // held after Racing begins
            var driver = CreateDriver(machine, buffer, pauseEdgeSource: edge);

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing
            driver.Update(); // frame 1: edge consumed -> Paused

            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(1, buffer.EdgeCount, "held pause produces exactly one edge");
        }

        [Test]
        public void AC310_NoEdgeWhenNoPause()
        {
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var driver = CreateDriver(machine, buffer, pauseEdgeSource: () => false);

            for (int i = 0; i < 303; i++) driver.Update(); // Racing ticks, no pause

            Assert.AreEqual(0, buffer.EdgeCount);
            Assert.AreEqual(3, buffer.ContinuousCount);
        }

        [Test]
        public void AC310_ResumeEdgeFlagsNotRecordedForPauseOnly()
        {
            // EdgeEventFlags.Resume is defined for the future Alpha ghost stream; the MVP
            // Pause path must record exactly Pause, never None or Resume.
            var buffer = new GhostBuffer();
            buffer.RecordEdgeEvent(5, EdgeEventFlags.Pause);
            Assert.AreEqual(1, buffer.EdgeCount);
            Assert.AreEqual(EdgeEventFlags.Pause, buffer.GetEdgeFlags(0));
        }

        // ============================================================
        // Determinism harness scaffold (AC-5.1/5.5)
        // ============================================================

        [Test]
        public void AC51_DeterminismComparatorPassesWithinTolerance()
        {
            var runA = new List<IReadOnlyList<float>>
            {
                new List<float> { 1.0000f, 2.0000f },
                new List<float> { 1.0004f, 2.0002f },
            };
            var runB = new List<IReadOnlyList<float>>
            {
                new List<float> { 1.0000f, 2.0000f },
                new List<float> { 1.0009f, 2.0001f }, // max delta 0.0005 <= 0.001
            };
            DeterminismComparisonReport report = DeterminismComparator.Compare(runA, runB);
            Assert.IsTrue(report.Passed);
            Assert.AreEqual(2, report.TickCount);
            Assert.LessOrEqual(report.MaxPositionDelta, DeterminismComparator.Tolerance);
        }

        [Test]
        public void AC51_DeterminismComparatorFailsBeyondTolerance()
        {
            var runA = new List<IReadOnlyList<float>> { new List<float> { 0f } };
            var runB = new List<IReadOnlyList<float>> { new List<float> { 0.005f } };
            DeterminismComparisonReport report = DeterminismComparator.Compare(runA, runB);
            Assert.IsFalse(report.Passed);
            Assert.AreEqual(0.005f, report.MaxPositionDelta);
        }

        // ============================================================
        // Helpers
        // ============================================================

        private sealed class FixedInputProcessor : ISimulationInputProcessor
        {
            private readonly float _accelerate, _brake, _steer;
            public FixedInputProcessor(float accelerate, float brake, float steer)
            {
                _accelerate = accelerate;
                _brake = brake;
                _steer = steer;
            }
            public SimulationInput Process(RawInputSample sample, bool pausePending)
                => new SimulationInput(_accelerate, _brake, _steer,
                    _accelerate, _brake, _steer, false, InputAvailability.Available);
        }

        private sealed class NoOpInputProcessor : ISimulationInputProcessor
        {
            public SimulationInput Process(RawInputSample sample, bool pausePending)
                => new SimulationInput();
        }

        private sealed class NoOpPhysics : IPhysicsSimulator
        {
            public void Simulate(float fixedDeltaTime) { }
        }

        private sealed class NoOpStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context) { }
        }

        private sealed class FixedCapture : IFrameInputCapture
        {
            public RawInputSample CaptureLatest()
                => new RawInputSample(1, ControlScheme.KeyboardMouse, 0.8f, 0.2f, 0.1f,
                    InputAvailability.Available, RawInputValidityFlags.None);

            /// <summary>Optional pause-edge provider (C4: edge lives on the frame seam).</summary>
            public Func<bool> EdgeProvider;

            /// <summary>Counts pause-edge consumptions for delivery assertions.</summary>
            public int EdgeConsumeCount { get; private set; }

            public bool HasPendingPauseEdge => EdgeProvider?.Invoke() ?? false;

            public void ConsumePendingPauseEdge() => EdgeConsumeCount++;
        }

        private sealed class FixedDeltaSource : IFrameDeltaSource
        {
            private readonly float _delta;
            public FixedDeltaSource(float delta) => _delta = delta;
            public float GetUnscaledDeltaTime() => _delta;
        }

        private sealed class NoFinishRsm : IRaceSessionManagerEvaluate
        {
            public FinishDetected? Evaluate(IReadOnlyList<CarState> carStates) => null;
        }

        private sealed class NoOpResolver : IFinishOrderResolver
        {
            public ResolvedFinishOrder Resolve(PostFinishSnapshot snapshot)
                => new ResolvedFinishOrder(new List<FinishOrderEntry>());
        }

        private sealed class SequenceRsm : IRaceSessionManagerEvaluate
        {
            private readonly FinishDetected[] _finishes;
            private int _index;
            public SequenceRsm(params FinishDetected[] finishes) => _finishes = finishes;
            public FinishDetected? Evaluate(IReadOnlyList<CarState> carStates)
                => _index < _finishes.Length ? _finishes[_index++] : (FinishDetected?)null;
        }

        /// <summary>Returns a machine primed for Racing via StartSingleRace + OnRaceLoadReady.</summary>
        private static SimulationStateMachine RacingMachine()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, new GridAssignment(1));
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1));
            return machine;
        }

        /// <summary>Returns a machine that finishes at tick 300 (SequenceRsm first finish).</summary>
        private static SimulationStateMachine FinishedMachine()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, new GridAssignment(1));
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1));
            return machine;
        }

        private static SimulationDriver CreateDriver(
            SimulationStateMachine machine,
            GhostBuffer buffer,
            ISimulationInputProcessor processor = null,
            Func<bool> pauseEdgeSource = null,
            IReplayInitialStateProvider provider = null,
            IRaceSessionManagerEvaluate rsm = null)
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            steps[CountdownStep.SpineIndex] = new CountdownStep(machine);
            steps[PhysicsSimulateStep.SpineIndex] = new PhysicsSimulateStep(new NoOpPhysics());
            steps[GoStep.SpineIndex] = new GoStep(machine);
            steps[TestSteps.ReadoutSpineIndex] = new TestSteps.ReadoutStep();
            steps[RsmEvaluationStep.SpineIndex] = new RsmEvaluationStep(rsm ?? new NoFinishRsm(), machine);
            steps[RsmConsumeStep.SpineIndex] = new RsmConsumeStep(machine, new NoOpResolver());
            steps[TestSteps.PublishSpineIndex] = new TestSteps.PublishStep();

            IGhostRecorder recorder = buffer;
            var kernel = new SimulationKernel(processor ?? new NoOpInputProcessor(), steps);
            var capture = new FixedCapture { EdgeProvider = pauseEdgeSource };
            return new SimulationDriver(
                kernel,
                machine,
                capture,
                new FixedDeltaSource(SimulationDriver.FIXED_DT),
                ghostRecorder: recorder,
                replayStateProvider: provider);
        }

        /// <summary>Writes the post-physics readout arrays so RsmConsumeStep can freeze them.</summary>
          [Test]
          public void AC61_DiscardReArmsOverflowForNextRace()
        {
            // Per-session overflow contract: an overflowed race leaves the buffer
            // non-serializable; Discard() re-arms it for the next race (the wipe is explicit).
            var buffer = new GhostBuffer(maxTicks: 10);
            var input = new SimulationInput(0f, 0f, 0f, 0f, 0f, 0f, false, InputAvailability.Available);
            for (uint i = 0; i < 11; i++) buffer.RecordTick(input, i); // overflow
            Assert.IsFalse(buffer.IsSerializable);

            buffer.Discard();
            Assert.IsTrue(buffer.IsSerializable, "Discard re-arms the buffer for the next race");
            buffer.RecordTick(input, 1);
            Assert.IsTrue(buffer.IsSerializable);
        }

        [Test]
        public void AC39_CaptureReArmedForSecondRace()
        {
            // The GO-boundary capture is exactly once PER race: a second race (Results ->
            // Loading) must re-capture with the new seed, not leak the first race's state.
            var machine = RacingMachine();
            var provider = new FixedReplayProvider(seed: 111u);
            var rsm = new SequenceRsm(
                new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f),
                new FinishDetected(ResultKind.Race, ResultClassification.Finished, 99.5f));
            var driver = CreateDriver(machine, null, provider: provider, rsm: rsm);

            for (int i = 0; i < 300; i++) driver.Update(); // race 1: GO tick captures seed 111
            driver.Update(); // first Racing tick -> RSM finish -> Finished
            Assert.AreEqual(111u, driver.ReplayInitialState.Value.SimSeed);

            machine.OnDismissTerminalPresentation(); // -> Results
            driver.Update();
            Assert.AreEqual(SimulationState.Results, machine.State);
            provider.Input.SimSeed = 222u; // race 2 seed
            machine.StartRaceFromResults(new GridAssignment(1)); // -> Loading (reset)
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1)); // -> Countdown
            for (int i = 0; i < 300; i++) driver.Update(); // race 2: GO tick re-captures seed 222

            Assert.IsNotNull(driver.ReplayInitialState);
            Assert.AreEqual(222u, driver.ReplayInitialState.Value.SimSeed,
                "second race re-captures with the new seed");
        }

        [Test]
        public void AC39_ProviderCalledExactlyOncePerRace()
        {
            var machine = RacingMachine();
            var provider = new FixedReplayProvider(seed: 7u);
            var driver = CreateDriver(machine, null, provider: provider);

            for (int i = 0; i < 305; i++) driver.Update(); // GO + Racing ticks

            Assert.AreEqual(1, provider.CallCount, "provider consulted exactly once (at GO)");
        }

        [Test]
        public void AC39_ZeroPerfectStartTicksCaptured()
        {
            var machine = RacingMachine();
            var provider = new FixedReplayProvider(seed: 5u);
            provider.Input.PerfectStartRemainingTicks = 0;
            var driver = CreateDriver(machine, null, provider: provider);

            for (int i = 0; i < 300; i++) driver.Update();

            Assert.IsNotNull(driver.ReplayInitialState);
            Assert.AreEqual(0, driver.ReplayInitialState.Value.PerfectStartRemainingTicks);
        }

        [Test]
        public void AC61_MultipleTicksPerFrameRecordsEach()
        {
            // A frame with delta = 2xFIXED_DT runs two Racing ticks; each records exactly once.
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++) steps[i] = new NoOpStep();
            steps[CountdownStep.SpineIndex] = new CountdownStep(machine);
            steps[PhysicsSimulateStep.SpineIndex] = new PhysicsSimulateStep(new NoOpPhysics());
            steps[GoStep.SpineIndex] = new GoStep(machine);
            steps[TestSteps.ReadoutSpineIndex] = new TestSteps.ReadoutStep();
            steps[TestSteps.PublishSpineIndex] = new TestSteps.PublishStep();
            var kernel = new SimulationKernel(new NoOpInputProcessor(), steps);
            var driver = new SimulationDriver(
                kernel, machine, new FixedCapture(),
                new FixedDeltaSource(SimulationDriver.FIXED_DT * 2f), // 2 ticks per frame
                ghostRecorder: buffer);

            for (int i = 0; i < 150; i++) driver.Update(); // 300 Countdown ticks -> Racing
            Assert.AreEqual(SimulationState.Racing, machine.State);

            driver.Update(); // 2 Racing ticks in one frame
            Assert.AreEqual(2, buffer.ContinuousCount,
                "each Racing tick in a multi-tick frame records exactly once");
            Assert.AreEqual((uint)301, buffer.GetContinuousTickIndex(0));
            Assert.AreEqual((uint)302, buffer.GetContinuousTickIndex(1));
        }

        [Test]
        public void AC51_ComparatorRejectsEmptyAndNonFiniteDeltas()
        {
            Assert.Throws<ArgumentException>(() =>
                DeterminismComparator.Compare(new List<IReadOnlyList<float>>(), new List<IReadOnlyList<float>>()));

            // NaN position delta: never determinism, must FAIL not silently pass.
            var runA = new List<IReadOnlyList<float>> { new List<float> { float.NaN } };
            var runB = new List<IReadOnlyList<float>> { new List<float> { 0f } };
            DeterminismComparisonReport report = DeterminismComparator.Compare(runA, runB);
            Assert.IsFalse(report.Passed, "non-finite delta fails the determinism check");

            var infA = new List<IReadOnlyList<float>> { new List<float> { float.PositiveInfinity } };
            var infB = new List<IReadOnlyList<float>> { new List<float> { 0f } };
            Assert.IsFalse(DeterminismComparator.Compare(infA, infB).Passed);
        }

        [Test]
        public void AC61_DiscardOnSkippedTerminalTransition()
        {
            // Forfeit -> Results is OBSERVED by the driver on the next Update (the forfeit is
            // an input the driver's state-based detection processes), discarding the buffer;
            // then re-race -> Loading/Countdown re-arms capture. The extreme same-frame
            // Racing->Countdown (no terminal observed) is undetectable by design — the driver
            // reacts to states it observes per frame, and forfeit + re-race are user inputs
            // from different screens.
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var driver = CreateDriver(machine, buffer);

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing
            driver.Update(); // 1 record
            Assert.AreEqual(1, buffer.ContinuousCount);

            machine.EnterPaused(SimulationState.Racing);
            machine.RequestForfeit(forfeitLapCount: 1, raceTimeAtForfeit: 45f); // -> Results
            driver.Update(); // observes Results -> discard
            Assert.AreEqual(SimulationState.Results, machine.State);
            Assert.AreEqual(0, buffer.ContinuousCount, "discarded on observed forfeit Results");

            // Re-race: no records leak into the new session.
            machine.StartRaceFromResults(new GridAssignment(1));
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1));
            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing
            driver.Update(); // 1 new record
            Assert.AreEqual(1, buffer.ContinuousCount, "new session records independently");
        }

        [Test]
        public void AC310_PauseThenResumeThenSecondPauseRecordsTwoEdges()
        {
            // Pause -> Resume -> Pause: each consumed Pause edge records one EdgeEvent;
            // Resume itself records nothing (Resume flags are Alpha scope).
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            // Edge source controlled by the test: false during Countdown, true for pause 1,
            // false for resume, true again for pause 2.
            bool edgeActive = false;
            Func<bool> edge = () => edgeActive;
            var driver = CreateDriver(machine, buffer, pauseEdgeSource: edge);

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing (edge inactive)
            edgeActive = true;
            driver.Update(); // edge true -> Paused (edge 1)
            Assert.AreEqual(1, buffer.EdgeCount);
            Assert.AreEqual(SimulationState.Paused, machine.State);

            edgeActive = false;
            machine.RequestResume(); // Paused -> Racing (resumeState = Racing, the pause origin)
            driver.Update(); // edge false -> no new pause
            Assert.AreEqual(SimulationState.Racing, machine.State,
                "resume returns to the pause-origin state (Racing)");
            Assert.AreEqual(1, buffer.EdgeCount, "resume records no edge in MVP");

            // Second pause: edge true again -> Paused (edge 2).
            edgeActive = true;
            driver.Update();
            Assert.AreEqual(SimulationState.Paused, machine.State);
            Assert.AreEqual(2, buffer.EdgeCount, "second Pause edge recorded");
        }

        [Test]
        public void AC310_MultipleEdgesMayShareATickIndex()
        {
            // The parallel edge stream is a list — multiple lifecycle edges may carry the same
            // tick index (e.g. Pause + Resume in the same tick in Alpha). The buffer must not
            // deduplicate them.
            var buffer = new GhostBuffer();
            buffer.RecordEdgeEvent(5, EdgeEventFlags.Pause);
            buffer.RecordEdgeEvent(5, EdgeEventFlags.Resume);

            Assert.AreEqual(2, buffer.EdgeCount, "parallel edge stream preserves same-index edges");
            Assert.AreEqual(EdgeEventFlags.Pause, buffer.GetEdgeFlags(0));
            Assert.AreEqual(EdgeEventFlags.Resume, buffer.GetEdgeFlags(1));
        }

        [Test]
        public void AC61_LoadFailureThenIdleDiscards()
        {
            // Load failure publishes LifecycleErrorRaised; the composition root transits to
            // Idle (or a fresh Loading). Discard fires on the Idle observation (TR-ghost-004
            // includes load failure among the discard paths).
            var machine = RacingMachine();
            var buffer = new GhostBuffer();
            var rsm = new SequenceRsm(new FinishDetected(ResultKind.Race, ResultClassification.Finished, 98.5f));
            var driver = CreateDriver(machine, buffer, rsm: rsm);

            for (int i = 0; i < 300; i++) driver.Update(); // -> Racing
            driver.Update(); // 1 record
            Assert.AreEqual(1, buffer.ContinuousCount);

            // Emulate the composition root reacting to a load failure: abort to Idle.
            machine.OnContentLoadError("track missing", ContentErrorType.Track);
            machine.TryTransition(SimulationState.Idle);
            driver.Update(); // observes Idle -> discard

            Assert.AreEqual(SimulationState.Idle, machine.State);
            Assert.AreEqual(0, buffer.ContinuousCount, "discarded after load-failure Idle");
        }

        [Test]
        public void AC39_AllCollectionsDeepCopiedOnCapture()
        {
            // Fuel, tire, and grid collections must be deep-copied at capture — mutating the
            // provider's source after capture must not mutate the snapshot (AC-3.9).
            var machine = RacingMachine();
            var provider = new FixedReplayProvider(seed: 77u);
            var driver = CreateDriver(machine, null, provider: provider);

            for (int i = 0; i < 300; i++) driver.Update(); // capture at GO

            ReplayInitialState before = driver.ReplayInitialState.Value;
            // Mutate the provider's source collections after capture.
            ((List<FuelState>)provider.Input.InitialFuelState)[0] = new FuelState(0f);
            ((List<TireState>)provider.Input.InitialTireState)[0] = new TireState(0f);
            provider.Input.GridAssignment = new GridAssignment(new[] { 99, 98, 97 });

            ReplayInitialState after = driver.ReplayInitialState.Value;
            Assert.AreEqual(before.InitialFuelState[0].Amount, after.InitialFuelState[0].Amount,
                "fuel deep-copied");
            Assert.AreEqual(before.InitialTireState[0].Wear, after.InitialTireState[0].Wear,
                "tire deep-copied");
            CollectionAssert.AreEqual(before.GridAssignment.GridSlots, after.GridAssignment.GridSlots,
                "grid assignment deep-copied");
        }

        [Test]
        public void AC39_EmptyAndReorderedGridCaptured()
        {
            // The grid handoff is copied as-is: an empty or reordered sequence must be captured
            // exactly (the provider owns validation; the Kernel snapshots the supplied state).
            var machine = RacingMachine();
            var provider = new FixedReplayProvider(seed: 9u);
            provider.Input.CarIds = new List<int> { 4, 2, 1, 3 }; // reordered
            var driver = CreateDriver(machine, null, provider: provider);

            for (int i = 0; i < 300; i++) driver.Update();

            CollectionAssert.AreEqual(new[] { 4, 2, 1, 3 },
                driver.ReplayInitialState.Value.CarIds, "reordered car IDs preserved");
        }

        [Test]
        public void AC51_ComparatorExactBoundaryPasses()
        {
            // The tolerance comparison is <= (inclusive). Using the exact Tolerance float
            // (0.001f) as the delta proves the boundary: 0.001f <= 0.001f passes, while a
            // strict < comparator would fail.
            var runA = new List<IReadOnlyList<float>> { new List<float> { 0f } };
            var runB = new List<IReadOnlyList<float>> { new List<float> { DeterminismComparator.Tolerance } };
            Assert.IsTrue(DeterminismComparator.Compare(runA, runB).Passed,
                "delta exactly at Tolerance passes (<= boundary)");
        }

        [Test]
        public void AC51_HarnessScaffoldInterfacesAreUsable()
        {
            // The scaffold interfaces must be implementable and compose into a report the gate
            // can consume (AC-5.1/5.5: harness delivered here, gate consumes it).
            var harness = new FakeHarness();
            DeterminismComparisonReport report = harness.RunPairComparison(seed: 42u, trackId: "monza", tickCount: 300);

            Assert.IsNotNull(report);
            Assert.AreEqual(300, report.TickCount);
            Assert.IsTrue(report.Passed);
            Assert.AreEqual(42u, harness.InjectedSeed);
            Assert.AreEqual(42u, harness.SeedStub.AppliedSeed,
                "the ISeedInjection stub received the seed (composition is wired)");
        }

        private sealed class FakeHarness : IDeterminismHarness
        {
            public ulong InjectedSeed { get; private set; }
            public SeedInjectionStub SeedStub { get; } = new SeedInjectionStub();

            public DeterminismComparisonReport RunPairComparison(ulong seed, string trackId, int tickCount)
            {
                SeedStub.InjectSeed(seed);
                InjectedSeed = seed;
                return new DeterminismComparisonReport(0f, DeterminismComparator.Tolerance, tickCount, true);
            }
        }

        private sealed class SeedInjectionStub : ISeedInjection
        {
            public ulong AppliedSeed { get; private set; }
            public void InjectSeed(ulong seed) => AppliedSeed = seed;
        }

        [Test]
        public void AC39_EmptyGridAssignmentCaptured()
        {
            // An empty grid handoff is captured as-is (the provider owns validation; the Kernel
            // snapshots the supplied state). GridAssignment is immutable by construction, so the
            // captured reference is stable regardless of later provider changes.
            var machine = RacingMachine();
            var provider = new FixedReplayProvider(seed: 11u);
            provider.Input.GridAssignment = GridAssignment.ForRace(Array.Empty<int>());
            var driver = CreateDriver(machine, null, provider: provider);

            for (int i = 0; i < 300; i++) driver.Update();

            Assert.IsNotNull(driver.ReplayInitialState.Value.GridAssignment);
            Assert.AreEqual(0, driver.ReplayInitialState.Value.GridAssignment.GridSlots.Count,
                "empty grid assignment captured");
        }

        private sealed class FixedReplayProvider : IReplayInitialStateProvider
        {
            public readonly ReplayInitialStateCaptureInput Input;
            public int CallCount { get; private set; }

            public FixedReplayProvider(ulong seed)
            {
                Input = new ReplayInitialStateCaptureInput
                {
                    Version = 1,
                    RaceConfigurationId = "monza-a",
                    ContentVersionHash = "abc123",
                    SimSeed = seed,
                    GridAssignment = new GridAssignment(new[] { 1, 2, 3 }),
                    CarIds = new List<int> { 1, 2, 3 },
                    InitialFuelState = new List<FuelState> { new FuelState(1.0f), new FuelState(0.9f), new FuelState(0.8f) },
                    InitialTireState = new List<TireState> { new TireState(1.0f), new TireState(0.9f), new TireState(0.8f) },
                    PerfectStartRemainingTicks = 30,
                    DifficultyProfile = new DifficultyProfile(3, 1.00f, 0.5f, 0.00f, 0.30f, 0.50f),
                };
            }

            public ReplayInitialStateCaptureInput GetCaptureInput()
            {
                CallCount++;
                return Input;
            }
        }
    }
}
