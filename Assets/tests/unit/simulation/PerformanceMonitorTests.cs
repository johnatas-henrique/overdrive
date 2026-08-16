using NUnit.Framework;
using System;
using System.Collections.Generic;
using Overdrive.Input;

namespace Overdrive.Simulation.Tests
{
    /// <summary>
    /// Story 007 — Performance Monitor tests. Covers all 9 ACs (7.6, 7.6a, 7.7, 7.7a-f) plus the
    /// QA edge cases: threshold emission, state eligibility, pause request, timer reset/persist/re-arm,
    /// restore signal, and the performance-pause preservation exception.
    /// </summary>
    public class PerformanceMonitorTests
    {
        private const float ReducedThreshold = PerformanceMonitor.ReducedThresholdFps; // 30
        private const float PauseThreshold = PerformanceMonitor.PauseThresholdFps;     // 15
        private const float Threshold = PerformanceMonitor.ThresholdSeconds;           // 3

        private sealed class PauseRecorder
        {
            public int CallCount;

            public void Request()
            {
                CallCount++;
            }
        }

        /// <summary>Feeds N frames of constant FPS, appending emitted signals to the given list.</summary>
        private static void Feed(PerformanceMonitor monitor, List<PerformanceSignal> signals,
            SimulationState state, float fps, int frames)
        {
            Action<PerformanceSignal> handler = signals.Add;
            monitor.PerformanceStatusChanged += handler;
            try
            {
                float delta = 1f / fps;
                for (int i = 0; i < frames; i++)
                    monitor.Evaluate(delta, state);
            }
            finally
            {
                monitor.PerformanceStatusChanged -= handler;
            }
        }

        private static void Feed(PerformanceMonitor monitor, SimulationState state,
            float fps, int frames)
        {
            var discard = new List<PerformanceSignal>();
            Feed(monitor, discard, state, fps, frames);
        }

        [Test]
        public void AC76_BelowThirtyForThreePointOneSecondsEmitsReduced()
        {
            // Just past the 3-second boundary: 31 frames at 10 FPS = 3.1s. The EXACT 3.0s
            // boundary is float-unstable (30 x 0.1f rounds to 2.9999998 or 3.0000002), so the
            // deterministic coverage is the just-below (2.9s, no emit) and just-above (3.1s,
            // emit) pair.
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var signals = new List<PerformanceSignal>();
            Feed(monitor, signals, SimulationState.Racing, fps: 10f, frames: 31);

            Assert.AreEqual(1, signals.Count, "emission just past 3.0 seconds");
            Assert.AreEqual(PerformanceStatus.Reduced, signals[0].Status);
        }

        [Test]
        public void AC76_NoEventAtTwoPointNineSeconds()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var signals = new List<PerformanceSignal>();
            Feed(monitor, signals, SimulationState.Racing, fps: 10f, frames: 29); // 2.9s

            Assert.AreEqual(0, signals.Count, "no event at 2.9s (below the 3s boundary)");
        }

        [Test]
        public void AC76_FixedDtAndTimeScaleNeverChanged()
        {
            // The monitor has no access to FIXED_DT or Time.timeScale (engine-free, producer-
            // only). Structural invariant: its API surface exposes neither. Verify the constants
            // are untouched and the monitor exposes no time-scale mutation path.
            float fixedDtBefore = SimulationTickContext.FIXED_DT;

            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // pause requested
            monitor.OnStateChanged(SimulationState.Paused, SimulationState.Countdown); // resume
            monitor.Evaluate(1f / 60f, SimulationState.Countdown); // 60 FPS resume -> clear

            Assert.AreEqual(fixedDtBefore, SimulationTickContext.FIXED_DT,
                "FIXED_DT is never changed by the monitor");
        }

        // ---- AC-7.6: sustained <30 FPS 3s -> PerformanceReduced ----

        [Test]
        public void AC76_BelowThirtyForThreeSecondsEmitsReducedOnce()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var signals = new List<PerformanceSignal>();
            Feed(monitor, signals, SimulationState.Racing, fps: 20f, frames: 61); // 3.05s

            Assert.AreEqual(1, signals.Count, "exactly one Reduced emission");
            Assert.AreEqual(PerformanceStatus.Reduced, signals[0].Status);
            Assert.AreEqual(20f, signals[0].ObservedFps, 0.01f);
            Assert.IsTrue(monitor.IsReduced);
        }

        [Test]
        public void AC76_NoEventBeforeThreeContinuousSeconds()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var signals = new List<PerformanceSignal>();
            Feed(monitor, signals, SimulationState.Racing, fps: 20f, frames: 59); // 2.95s

            Assert.AreEqual(0, signals.Count, "no event before 3 continuous seconds");
            Assert.IsFalse(monitor.IsReduced);
        }

        [Test]
        public void AC76_FpsExactlyThirtyDoesNotQualify()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var signals = new List<PerformanceSignal>();
            Feed(monitor, signals, SimulationState.Racing, fps: ReducedThreshold, frames: 120);

            Assert.AreEqual(0, signals.Count, "FPS exactly 30 does not qualify as below 30");
            Assert.IsFalse(monitor.IsReduced);
            Assert.AreEqual(0f, monitor.Below30TimerSeconds, "below-30 timer stays 0 at exactly 30");
        }

        [Test]
        public void AC76_FrameAtOrAboveThirtyResetsBelow30Timer()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            // 2.5s below 30, then one frame at 30+ resets the below-30 timer.
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 50); // 2.5s
            Assert.Greater(monitor.Below30TimerSeconds, 0f);

            monitor.Evaluate(1f / 60f, SimulationState.Racing); // 60 FPS frame resets
            Assert.AreEqual(0f, monitor.Below30TimerSeconds, "frame >=30 resets below-30 timer");
        }

        [Test]
        public void AC76_CountdownAndRacingBothTrigger()
        {
            foreach (var state in new[] { SimulationState.Countdown, SimulationState.Racing })
            {
                var recorder = new PauseRecorder();
                var monitor = new PerformanceMonitor(recorder.Request);
                var signals = new List<PerformanceSignal>();
                Feed(monitor, signals, state, fps: 20f, frames: 61);
                Assert.AreEqual(1, signals.Count, $"{state} emits Reduced");
            }
        }

        // ---- AC-7.6a: ineligible states emit nothing, timers stay 0 ----

        [Test]
        public void AC76a_IneligibleStatesEmitNothingAndTimersStayZero()
        {
            foreach (var state in new[] { SimulationState.Idle, SimulationState.Loading,
                                          SimulationState.Paused, SimulationState.Finished,
                                          SimulationState.Results })
            {
                var recorder = new PauseRecorder();
                var monitor = new PerformanceMonitor(recorder.Request);
                var signals = new List<PerformanceSignal>();
                Feed(monitor, signals, state, fps: 10f, frames: 100); // way below 15 and 30

                Assert.AreEqual(0, signals.Count, $"{state} emits nothing");
                Assert.IsFalse(monitor.IsReduced);
                Assert.AreEqual(0f, monitor.Below30TimerSeconds, $"{state} below-30 stays 0");
                Assert.AreEqual(0f, monitor.Below15TimerSeconds, $"{state} below-15 stays 0");
                Assert.AreEqual(0f, monitor.RecoveryTimerSeconds, $"{state} recovery stays 0");
            }
        }

        [Test]
        public void AC76a_InvalidDeltaProducesNoEventOrTimer()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            monitor.Evaluate(0f, SimulationState.Racing);
            monitor.Evaluate(-1f, SimulationState.Racing);
            monitor.Evaluate(float.NaN, SimulationState.Racing);
            monitor.Evaluate(float.PositiveInfinity, SimulationState.Racing);

            Assert.AreEqual(0, recorder.CallCount);
            Assert.IsFalse(monitor.IsReduced);
            Assert.AreEqual(0f, monitor.Below30TimerSeconds);
        }

        // ---- AC-7.7: <15 FPS additional 3s -> pause request ----

        [Test]
        public void AC77_BelowFifteenAdditionalThreeSecondsRequestsPauseOnce()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            // 3s below 30 -> Reduced (below-15 timer starts at 0).
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);

            // Additional 3s below 15 -> pause request.
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // 3.1s

            Assert.AreEqual(1, recorder.CallCount, "exactly one pause request");
            Assert.IsTrue(monitor.IsPauseRequested);
        }

        [Test]
        public void AC77_NoPauseBeforeAdditionalThreeSeconds()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 29); // 2.9s additional

            Assert.AreEqual(0, recorder.CallCount, "no pause before additional 3s");
            Assert.IsFalse(monitor.IsPauseRequested);
        }

        [Test]
        public void AC77_FpsExactlyFifteenResetsBelow15Timer()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 20); // 2s below 15 accumulates
            Assert.Greater(monitor.Below15TimerSeconds, 0f, "below-15 accumulates below 15 FPS");

            // Exactly 15 FPS (frameDelta == 1/15) does NOT accumulate — the comparison is
            // frameDelta > 1/15 (strict), so it resets the timer (QA case AC-7.7).
            monitor.Evaluate(1f / PauseThreshold, SimulationState.Racing);
            Assert.AreEqual(0f, monitor.Below15TimerSeconds,
                "FPS exactly 15 resets below-15 timer (delta comparison is strict)");
        }

        [Test]
        public void AC77_NoDuplicatePauseWhileAlreadyPending()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // pause requested
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 60); // more <15 frames

            Assert.AreEqual(1, recorder.CallCount, "no duplicate pause while already pending");
        }

        // ---- AC-7.7a: resume + FPS>=30 -> timers reset, clears ----

        [Test]
        public void AC77a_ResumeAtOrAboveThirtyClearsAllTimers()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // pause requested

            monitor.OnStateChanged(SimulationState.Paused, SimulationState.Countdown); // resume
            monitor.Evaluate(1f / 60f, SimulationState.Countdown); // 60 FPS resume -> clear

            Assert.IsFalse(monitor.IsReduced, "reduced clears");
            Assert.IsFalse(monitor.IsPauseRequested, "pause request clears");
            Assert.AreEqual(0f, monitor.Below30TimerSeconds);
            Assert.AreEqual(0f, monitor.Below15TimerSeconds);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds);
        }

        [Test]
        public void AC77a_FpsExactlyThirtyOnResumeQualifies()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31);

            monitor.OnStateChanged(SimulationState.Paused, SimulationState.Countdown); // resume
            monitor.Evaluate(1f / ReducedThreshold, SimulationState.Countdown); // exactly 30 qualifies

            Assert.IsFalse(monitor.IsReduced);
            Assert.IsFalse(monitor.IsPauseRequested);
        }

        [Test]
        public void AC77b_TransitionFromCountdownResets()
        {
            // AC-7.7b reset works regardless of the origin active state (Countdown, not just
            // Racing): Reduced in Countdown -> Finished resets everything.
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            monitor.OnStateChanged(SimulationState.Idle, SimulationState.Countdown);
            Feed(monitor, SimulationState.Countdown, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Countdown, fps: 10f, frames: 31); // pause request
            Assert.IsTrue(monitor.IsReduced);

            monitor.OnStateChanged(SimulationState.Countdown, SimulationState.Finished);
            Assert.IsFalse(monitor.IsReduced);
            Assert.IsFalse(monitor.IsPauseRequested);
            Assert.AreEqual(0f, monitor.Below30TimerSeconds);
            Assert.AreEqual(0f, monitor.Below15TimerSeconds);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds);
        }

        [Test]
        public void AC77e_PostRecoveryPartialBelow30ThenAbove30Resets()
        {
            // After Restored (reduced false), a partial <30 accumulation followed by a >=30
            // frame resets the below-30 timer (independent second cycle, AC-7.7e).
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);  // Reduced
            Feed(monitor, SimulationState.Racing, fps: 60f, frames: 181); // Restored
            Assert.IsFalse(monitor.IsReduced);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 20); // partial 1.0s <30
            Assert.Greater(monitor.Below30TimerSeconds, 0f, "partial below-30 accumulates");

            monitor.Evaluate(1f / 60f, SimulationState.Racing); // >=30 frame resets
            Assert.AreEqual(0f, monitor.Below30TimerSeconds,
                ">=30 frame resets the below-30 timer after partial accumulation");
        }

        // ---- AC-7.7b: enter Finished/Results/Loading -> reset, clears ----

        [Test]
        public void AC77b_EnteringFinishedResultsLoadingResets()
        {
            foreach (var state in new[] { SimulationState.Finished, SimulationState.Results,
                                          SimulationState.Loading })
            {
                var recorder = new PauseRecorder();
                var monitor = new PerformanceMonitor(recorder.Request);

                Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced + timers
                Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // pause requested

                monitor.OnStateChanged(SimulationState.Racing, state);

                Assert.IsFalse(monitor.IsReduced, $"{state} reduced clears");
                Assert.IsFalse(monitor.IsPauseRequested, $"{state} pause request clears");
                Assert.AreEqual(0f, monitor.Below30TimerSeconds, $"{state} below-30 resets");
                Assert.AreEqual(0f, monitor.Below15TimerSeconds, $"{state} below-15 resets");
                Assert.AreEqual(0f, monitor.RecoveryTimerSeconds, $"{state} recovery resets");
            }
        }

        [Test]
        public void AC77b_TransitionFromPausedResets()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            // Reduced with timers; Paused WITHOUT a pending performance request (manual pause) —
            // the AC-7.6a branch resets on Paused entry. Then Finished also resets (idempotent).
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);
            monitor.OnStateChanged(SimulationState.Racing, SimulationState.Paused); // manual pause -> reset
            Assert.IsFalse(monitor.IsReduced);

            Feed(monitor, SimulationState.Paused, fps: 10f, frames: 100); // no re-arm in Paused
            Assert.AreEqual(0f, monitor.Below30TimerSeconds, "no re-arm while Paused after reset");

            monitor.OnStateChanged(SimulationState.Paused, SimulationState.Finished);
            Assert.IsFalse(monitor.IsReduced, "still clean after transition to Finished");
        }

        [Test]
        public void AC77b_SubsequentLowFpsInNonActiveStateDoesNotReArm()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            monitor.OnStateChanged(SimulationState.Idle, SimulationState.Racing);
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            monitor.OnStateChanged(SimulationState.Racing, SimulationState.Results); // reset

            // Frames below 15/30 in Results must not re-arm the timers.
            Feed(monitor, SimulationState.Results, fps: 10f, frames: 100);
            Assert.AreEqual(0f, monitor.Below30TimerSeconds);
            Assert.AreEqual(0f, monitor.Below15TimerSeconds);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds);
            Assert.IsFalse(monitor.IsReduced);
        }

        // ---- AC-7.7c: resume + FPS<30 -> persist, re-triggerable ----

        [Test]
        public void AC77c_ResumeBelowThirtyPersistsAndCanRetrigger()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // pause requested

            // Resume below 30: reduced persists AND the pause request clears so protection can
            // re-trigger (AC-7.7c). Resume frame at 20 FPS (>=15, <30): the frame is evaluated,
            // so it resets the below-15 timer (GDD "any frame at or above 15 FPS resets that
            // timer") while the below-30 timer and reduced state persist. The below-15
            // continuation-on-resume case (a <15 FPS resume frame) is covered by
            // AC77c_Below15ContinuesNotRestartsOnResume.
            monitor.OnStateChanged(SimulationState.Paused, SimulationState.Countdown); // resume <30
            monitor.Evaluate(1f / 20f, SimulationState.Countdown);

            Assert.IsTrue(monitor.IsReduced, "reduced persists");
            Assert.IsFalse(monitor.IsPauseRequested, "pause request clears so protection can re-arm");
            Assert.AreEqual(0f, monitor.Below15TimerSeconds,
                "resume frame >=15 FPS resets the below-15 timer (GDD rule)");
            Assert.Greater(monitor.Below30TimerSeconds, 0f,
                "below-30 timer persists on resume <30");
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds,
                "recovery timer is 0 (no >=30 frames since resume)");

            // Re-trigger: another 3s below 15 FPS issues a SECOND pause request.
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31);
            Assert.AreEqual(2, recorder.CallCount, "protection re-triggers a second pause request");
        }

        [Test]
        public void AC77c_Below15ContinuesNotRestartsOnResume()
        {
            // Mutation guard: the below-15 timer must CONTINUE its existing duration across a
            // <30 FPS resume, not restart from 0 (AC-7.7c "no timer accidentally reset on
            // resume"). Immediately after resume + ONE 10 FPS frame, the timer must exceed
            // its pre-resume value (a restart would show only ~0.1s).
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 20); // 2.0s below 15
            float below15Before = monitor.Below15TimerSeconds;
            Assert.Greater(below15Before, 1.5f, "pre-resume below-15 duration ~2.0s");

            monitor.OnStateChanged(SimulationState.Paused, SimulationState.Countdown); // resume <30
            monitor.Evaluate(1f / 10f, SimulationState.Countdown); // resume decision + one 10 FPS frame

            Assert.Greater(monitor.Below15TimerSeconds, below15Before + 0.05f,
                "below-15 continues across resume (a restart would show ~0.1s, mutant guard)");
        }

        [Test]
        public void AC77c_PerformancePausedPreservesTimers()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // pause requested

            // Paused entry with _pauseRequested=true -> timers PRESERVED (AC-7.7c exception).
            monitor.OnStateChanged(SimulationState.Racing, SimulationState.Paused);

            Assert.IsTrue(monitor.IsReduced, "reduced preserved across performance pause");
            Assert.Greater(monitor.Below30TimerSeconds, 0f, "below-30 preserved");
            Assert.Greater(monitor.Below15TimerSeconds, 0f, "below-15 preserved");
        }

        [Test]
        public void AC76a_NonPerformancePausedResetsTimers()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            // Reduced + timers, but pause NOT requested by this monitor (manual/focus pause).
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);
            // Simulate a non-performance Paused entry: the monitor did not request it.
            var manualPauseMonitor = new PerformanceMonitor(recorder.Request);
            manualPauseMonitor.OnStateChanged(SimulationState.Idle, SimulationState.Racing);
            Feed(manualPauseMonitor, SimulationState.Racing, fps: 20f, frames: 61);
            manualPauseMonitor.OnStateChanged(SimulationState.Racing, SimulationState.Paused); // no _pauseRequested

            Assert.IsFalse(manualPauseMonitor.IsReduced, "manual pause resets reduced");
            Assert.AreEqual(0f, manualPauseMonitor.Below30TimerSeconds);
            Assert.AreEqual(0f, manualPauseMonitor.Below15TimerSeconds);
        }

        // ---- AC-7.7d: while reduced, >=30 FPS 3s -> PerformanceRestored ----

        [Test]
        public void AC77d_AtOrAboveThirtyForThreeSecondsRestores()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var signals = new List<PerformanceSignal>();

            Feed(monitor, signals, SimulationState.Racing, fps: 20f, frames: 61);   // Reduced
            Feed(monitor, signals, SimulationState.Racing, fps: 60f, frames: 181);  // 3.02s recovery

            Assert.AreEqual(2, signals.Count, "Reduced then Restored");
            Assert.AreEqual(PerformanceStatus.Restored, signals[1].Status);
            Assert.AreEqual(60f, signals[1].ObservedFps, 0.01f);
            Assert.IsFalse(monitor.IsReduced, "reduced clears after restore");
            Assert.IsFalse(monitor.IsPauseRequested);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds);
        }

        [Test]
        public void AC77d_NoRestoreBeforeThreeSeconds()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var signals = new List<PerformanceSignal>();

            Feed(monitor, signals, SimulationState.Racing, fps: 20f, frames: 61);   // Reduced
            Feed(monitor, signals, SimulationState.Racing, fps: 60f, frames: 179);  // 2.98s

            Assert.AreEqual(1, signals.Count, "only Reduced, no restore before 3s");
            Assert.IsTrue(monitor.IsReduced);
        }

        [Test]
        public void AC77d_FrameBelowThirtyResetsRecoveryTimer()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 60f, frames: 120); // 2s recovery
            Assert.Greater(monitor.RecoveryTimerSeconds, 0f);

            monitor.Evaluate(1f / 20f, SimulationState.Racing); // 20 FPS frame (<30) resets recovery
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds, "frame <30 resets recovery timer");
        }

        [Test]
        public void AC77d_FpsExactlyThirtyQualifiesForRestore()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var signals = new List<PerformanceSignal>();

            Feed(monitor, signals, SimulationState.Racing, fps: 20f, frames: 61);   // Reduced
            Feed(monitor, signals, SimulationState.Racing, fps: ReducedThreshold, frames: 181);

            Assert.AreEqual(2, signals.Count, "exactly 30 qualifies for restore");
            Assert.AreEqual(PerformanceStatus.Restored, signals[1].Status);
        }

        // ---- AC-7.7e: after recovery, <30 FPS 3s -> re-arm, emit again ----

        [Test]
        public void AC77e_ReArmsAfterRecovery()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var signals = new List<PerformanceSignal>();

            Feed(monitor, signals, SimulationState.Racing, fps: 20f, frames: 61);  // Reduced
            Feed(monitor, signals, SimulationState.Racing, fps: 60f, frames: 181); // Restored
            Feed(monitor, signals, SimulationState.Racing, fps: 20f, frames: 61);  // re-arm

            // 1 Reduced + 1 Restored + 1 Reduced (re-armed)
            Assert.AreEqual(3, signals.Count);
            Assert.AreEqual(PerformanceStatus.Reduced, signals[0].Status);
            Assert.AreEqual(PerformanceStatus.Restored, signals[1].Status);
            Assert.AreEqual(PerformanceStatus.Reduced, signals[2].Status);
            Assert.IsTrue(monitor.IsReduced, "reduced active again");
        }

        [Test]
        public void AC77e_FpsExactlyThirtyDoesNotStartLowFpsTimer()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);
            Feed(monitor, SimulationState.Racing, fps: 60f, frames: 181); // Restored

            Feed(monitor, SimulationState.Racing, fps: ReducedThreshold, frames: 120); // exactly 30

            Assert.AreEqual(0f, monitor.Below30TimerSeconds, "exactly 30 does not start low-FPS timer");
        }

        [Test]
        public void AC77f_RecoveryTimerSeededIndependentlyResets()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            monitor.OnStateChanged(SimulationState.Idle, SimulationState.Racing);
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 60f, frames: 120); // 2s recovery accumulates
            Assert.Greater(monitor.RecoveryTimerSeconds, 0f, "recovery timer seeded independently");
            Assert.AreEqual(0f, monitor.Below30TimerSeconds, "below-30 resets on >=30 frames");

            monitor.OnStateChanged(SimulationState.Racing, SimulationState.Idle);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds, "recovery resets on Idle");
            Assert.IsFalse(monitor.IsReduced);
        }

        [Test]
        public void AC77f_Below30AndBelow15TimersSimultaneouslyReset()
        {
            // below-30 and below-15 accumulate together on <15 FPS frames while reduced; the
            // recovery timer is mutually exclusive by design (a frame is either <30 or >=30),
            // so it is seeded and reset independently (AC77f_RecoveryTimerSeededIndependentlyResets).
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            monitor.OnStateChanged(SimulationState.Idle, SimulationState.Racing);
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 35); // <15 -> both accumulate

            Assert.Greater(monitor.Below30TimerSeconds, 0f);
            Assert.Greater(monitor.Below15TimerSeconds, 0f);

            monitor.OnStateChanged(SimulationState.Racing, SimulationState.Idle);
            Assert.AreEqual(0f, monitor.Below30TimerSeconds);
            Assert.AreEqual(0f, monitor.Below15TimerSeconds);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds);
            Assert.IsFalse(monitor.IsReduced);
            Assert.IsFalse(monitor.IsPauseRequested);
        }

        [Test]
        public void AC76a_InvalidDeltaLeavesAllThreeTimersZero()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            monitor.Evaluate(0f, SimulationState.Racing);
            monitor.Evaluate(-1f, SimulationState.Racing);
            monitor.Evaluate(float.NaN, SimulationState.Racing);
            monitor.Evaluate(float.PositiveInfinity, SimulationState.Racing);

            Assert.AreEqual(0, recorder.CallCount);
            Assert.IsFalse(monitor.IsReduced);
            Assert.AreEqual(0f, monitor.Below30TimerSeconds);
            Assert.AreEqual(0f, monitor.Below15TimerSeconds);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds);
        }

        [Test]
        public void AC77a_InvalidResumeDeltaIsNoOp()
        {
            // The resume path must be safe on invalid deltas (zero, negative, NaN, infinity)
            // — no clear, no persist, no timer mutation (the resume frame's Evaluate guards).
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // pause requested
            Assert.IsTrue(monitor.IsReduced);

            monitor.OnStateChanged(SimulationState.Paused, SimulationState.Countdown); // resume
            monitor.Evaluate(0f, SimulationState.Countdown);
            monitor.Evaluate(-1f, SimulationState.Countdown);
            monitor.Evaluate(float.NaN, SimulationState.Countdown);
            monitor.Evaluate(float.PositiveInfinity, SimulationState.Countdown);

            Assert.IsTrue(monitor.IsReduced, "invalid resume delta does not clear");
            Assert.IsTrue(monitor.IsPauseRequested, "invalid resume delta does not clear the request");
            Assert.Greater(monitor.Below30TimerSeconds, 0f, "timers untouched by invalid resume delta");
        }

        // ---- AC-7.7f: enter Idle/Loading/Finished/Results with non-zero timers -> reset all ----

        [Test]
        public void AC77f_EnteringIdleResetsAllTimers()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            monitor.OnStateChanged(SimulationState.Idle, SimulationState.Racing); // enter active state (track last state)
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced + below-30 timer
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // pause requested + below-15

            monitor.OnStateChanged(SimulationState.Racing, SimulationState.Idle);

            Assert.IsFalse(monitor.IsReduced);
            Assert.IsFalse(monitor.IsPauseRequested);
            Assert.AreEqual(0f, monitor.Below30TimerSeconds);
            Assert.AreEqual(0f, monitor.Below15TimerSeconds);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds);
        }

        [Test]
        public void AC77f_ReEnteringRacingStartsClean()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31);
            monitor.OnStateChanged(SimulationState.Racing, SimulationState.Results); // reset
            monitor.OnStateChanged(SimulationState.Results, SimulationState.Racing);  // re-enter

            Assert.AreEqual(0f, monitor.Below30TimerSeconds, "re-entering Racing starts clean");
            Assert.IsFalse(monitor.IsReduced);
        }

        // ---- Driver integration: monitor wired into SimulationDriver.Update() ----

        private sealed class NoOpStep : ISimulationPipelineStep
        {
            public void Execute(SimulationTickContext context) { }
        }

        private sealed class NoOpPhysics : IPhysicsSimulator
        {
            public void Simulate(float fixedDeltaTime) { }
        }

        private sealed class NoOpInputProcessor : ISimulationInputProcessor
        {
            public SimulationInput Process(RawInputSample sample, bool pausePending)
                => new SimulationInput();
        }

        private sealed class FixedCapture : IFrameInputCapture
        {
            public RawInputSample CaptureLatest()
                => new RawInputSample(1, ControlScheme.KeyboardMouse, 0f, 0f, 0f,
                    InputAvailability.Available, RawInputValidityFlags.None);

            /// <summary>Optional pause-edge provider (C4: edge lives on the frame seam).</summary>
            public Func<bool> EdgeProvider;

            /// <summary>Counts pause-edge consumptions for delivery assertions.</summary>
            public int EdgeConsumeCount { get; private set; }

            public bool HasPendingPauseEdge => EdgeProvider?.Invoke() ?? false;

            public void ConsumePendingPauseEdge() => EdgeConsumeCount++;
        }

        private sealed class FixedDelta : IFrameDeltaSource
        {
            public float Delta;
            public FixedDelta(float delta) => Delta = delta;
            public float GetUnscaledDeltaTime() => Delta;
        }

        private static SimulationDriver CreateDriverWithMonitor(
            SimulationStateMachine machine,
            PerformanceMonitor monitor,
            FixedDelta deltaSource)
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            return new SimulationDriver(
                new SimulationKernel(new NoOpInputProcessor(), steps),
                machine,
                new FixedCapture(),
                deltaSource,
                performanceMonitor: monitor);
        }

        [Test]
        public void Driver_ForwardsMonitorReducedEvent()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, new GridAssignment(1)); // Idle -> Loading
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1)); // Loading -> Countdown
            Assert.AreEqual(SimulationState.Countdown, machine.State);

            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var driver = CreateDriverWithMonitor(machine, monitor, new FixedDelta(1f / 20f)); // 20 FPS
            var forwarded = new List<PerformanceSignal>();
            driver.PerformanceStatusChanged += forwarded.Add;

            // 3 seconds of 20 FPS frames = 60 Update() calls (1/20s each). The driver passes the
            // same delta to the monitor and forwards its event.
            for (int i = 0; i < 61; i++)
                driver.Update();

            Assert.AreEqual(1, forwarded.Count, "driver forwards the monitor's Reduced event");
            Assert.AreEqual(PerformanceStatus.Reduced, forwarded[0].Status);
            Assert.AreEqual(20f, forwarded[0].ObservedFps, 0.01f);
        }

        [Test]
        public void Driver_ForwardsMonitorRestoredEvent()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, new GridAssignment(1)); // Idle -> Loading
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1)); // Loading -> Countdown

            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var deltaSource = new FixedDelta(1f / 20f);
            var driver = CreateDriverWithMonitor(machine, monitor, deltaSource);
            var forwarded = new List<PerformanceSignal>();
            driver.PerformanceStatusChanged += forwarded.Add;

            // 3s of 20 FPS -> Reduced; then switch the SAME driver's clock to 60 FPS for 3s
            // -> Restored. One driver, one monitor subscription — no double-forwarding.
            for (int i = 0; i < 61; i++)
                driver.Update();
            Assert.AreEqual(1, forwarded.Count, "Reduced forwarded");

            deltaSource.Delta = 1f / 60f;
            for (int i = 0; i < 181; i++)
                driver.Update();

            Assert.AreEqual(2, forwarded.Count,
                $"Reduced then Restored forwarded — actual: {string.Join(",", forwarded.ConvertAll(s => s.Status.ToString()))}");
            Assert.AreEqual(PerformanceStatus.Reduced, forwarded[0].Status);
            Assert.AreEqual(PerformanceStatus.Restored, forwarded[1].Status);
        }

        private sealed class ResumeHook : IPreAccumulatorLifecycleHook
        {
            private readonly SimulationStateMachine _machine;
            private readonly float _resumeDelta;
            private readonly FixedDelta _deltaSource;
            private bool _resumed;

            public ResumeHook(SimulationStateMachine machine, float resumeDelta, FixedDelta deltaSource)
            {
                _machine = machine;
                _resumeDelta = resumeDelta;
                _deltaSource = deltaSource;
            }

            public void BeforeAccumulator(SimulationState stateBefore)
            {
                if (stateBefore == SimulationState.Paused && !_resumed)
                {
                    // The resume happens INSIDE the boundary hook so the driver observes
                    // Paused -> Countdown on the same frame (mirrors the ReadinessHook pattern).
                    _machine.RequestResume();
                    _deltaSource.Delta = _resumeDelta;
                    _resumed = true;
                }
            }
        }

        [Test]
        public void Driver_ResumeFrameReportsFpsToMonitor()
        {
            // Paused -> Countdown resume through the REAL driver path: a ResumeHook resumes
            // inside the pre-accumulator boundary so the driver observes the transition on the
            // same frame and reports it to the monitor, which clears at 60 FPS (AC-7.7a).
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, new GridAssignment(1)); // Idle -> Loading
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1)); // Loading -> Countdown

            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var deltaSource = new FixedDelta(1f / 20f);
            var resumeHook = new ResumeHook(machine, resumeDelta: 1f / 60f, deltaSource);
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            var driver = new SimulationDriver(
                new SimulationKernel(new NoOpInputProcessor(), steps),
                machine,
                new FixedCapture(),
                deltaSource,
                lifecycleHook: resumeHook,
                performanceMonitor: monitor);

            // Reduced + pause requested through the driver's per-frame evaluation (20 FPS).
            for (int i = 0; i < 61; i++)
                driver.Update(); // Reduced
            // Drive below 15 FPS for 3s to trigger the pause request.
            deltaSource.Delta = 1f / 10f;
            for (int i = 0; i < 31; i++)
                driver.Update(); // 3.1s below 15 -> pause request
            Assert.IsTrue(monitor.IsPauseRequested, "pause requested");

            // Enter Paused (Story 004 path). One Update() while Paused registers the state.
            machine.EnterPaused(SimulationState.Countdown);
            driver.Update(); // observes Paused; the ResumeHook fires on the NEXT frame

            // Next Update: the ResumeHook resumes inside the boundary -> the driver observes
            // Paused->Countdown and reports it; the monitor clears at 60 FPS (AC-7.7a).
            driver.Update();

            Assert.IsFalse(monitor.IsReduced, "monitor cleared by resume at 60 FPS through the driver");
            Assert.IsFalse(monitor.IsPauseRequested);
            Assert.AreEqual(SimulationState.Countdown, machine.State);
        }

        [Test]
        public void Driver_ResumeBelowThirtyPersistsThroughDriver()
        {
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, new GridAssignment(1));
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1)); // -> Countdown

            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var deltaSource = new FixedDelta(1f / 20f);
            var resumeHook = new ResumeHook(machine, resumeDelta: 1f / 20f, deltaSource); // <30 FPS
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            var driver = new SimulationDriver(
                new SimulationKernel(new NoOpInputProcessor(), steps),
                machine,
                new FixedCapture(),
                deltaSource,
                lifecycleHook: resumeHook,
                performanceMonitor: monitor);

            for (int i = 0; i < 61; i++)
                driver.Update(); // Reduced
            deltaSource.Delta = 1f / 10f;
            for (int i = 0; i < 31; i++)
                driver.Update(); // pause request

            machine.EnterPaused(SimulationState.Countdown);
            driver.Update(); // observes Paused
            driver.Update(); // ResumeHook resumes <30 -> monitor persists (AC-7.7c)

            Assert.IsTrue(monitor.IsReduced, "reduced persists through driver on resume <30");
            Assert.IsFalse(monitor.IsPauseRequested, "pause request clears so protection re-arms");
        }

        private static ISimulationPipelineStep[] CreateNoOpSteps()
        {
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            return steps;
        }
        [Test]
        public void Driver_NormalActiveFramesDoNotCallOnResume()
        {
            // Mutation guard for the resume latch: the monitor's resume processing must fire
            // ONLY on a real Paused->Countdown/Racing transition. If the resume latch were armed
            // on every active frame, a >=30 FPS frame would clear a reduced monitor that never
            // paused. Assert the reduced state SURVIVES normal active frames.
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, new GridAssignment(1));
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1)); // -> Countdown

            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var deltaSource = new FixedDelta(1f / 20f);
            var driver = CreateDriverWithMonitor(machine, monitor, deltaSource);

            // Reduced (no pause request — FPS never dropped below 15).
            for (int i = 0; i < 61; i++)
                driver.Update(); // 20 FPS -> Reduced
            Assert.IsTrue(monitor.IsReduced);
            Assert.IsFalse(monitor.IsPauseRequested, "no pause request in this scenario");

            // Normal active frames at 60 FPS: NO resume transition -> the resume latch must
            // NOT arm, so the reduced state must NOT clear via a bogus resume.
            deltaSource.Delta = 1f / 60f;
            for (int i = 0; i < 60; i++)
                driver.Update(); // 1s of >=30 FPS, no transition

            Assert.IsTrue(monitor.IsReduced,
                "reduced survives normal active frames — resume fired without a real transition (latch mutant)");
        }

        [Test]
        public void Driver_ResumeFromRacingClearsMonitor()
        {
            // AC-7.7a both resume states: Racing resume (not just Countdown). Reduced in Racing,
            // performance-paused, then resume at 60 FPS through the driver -> monitor clears.
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, new GridAssignment(1));
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1)); // -> Countdown

            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);
            var deltaSource = new FixedDelta(1f / 60f);
            var resumeHook = new ResumeHook(machine, resumeDelta: 1f / 60f, deltaSource);
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            steps[CountdownStep.SpineIndex] = new CountdownStep(machine);
            steps[GoStep.SpineIndex] = new GoStep(machine);
            var driver = new SimulationDriver(
                new SimulationKernel(new NoOpInputProcessor(), steps),
                machine,
                new FixedCapture(),
                deltaSource,
                lifecycleHook: resumeHook,
                performanceMonitor: monitor);

            // Advance to Racing (300 countdown ticks at 60 FPS).
            for (int i = 0; i < 301; i++)
                driver.Update();
            Assert.AreEqual(SimulationState.Racing, machine.State);

            // Reduced in Racing + pause request: drive below 15 FPS for 3s.
            deltaSource.Delta = 1f / 20f;
            for (int i = 0; i < 61; i++)
                driver.Update(); // Reduced
            deltaSource.Delta = 1f / 10f;
            for (int i = 0; i < 31; i++)
                driver.Update(); // pause request
            Assert.IsTrue(monitor.IsPauseRequested);

            // Performance-pause from Racing, then resume at 60 FPS through the driver.
            machine.EnterPaused(SimulationState.Racing);
            driver.Update(); // observes Paused
            driver.Update(); // ResumeHook resumes inside the boundary -> monitor clears at 60 FPS

            Assert.IsFalse(monitor.IsReduced,
                "Racing resume at 60 FPS clears the monitor through the driver (AC-7.7a)");
            Assert.IsFalse(monitor.IsPauseRequested);
            Assert.AreEqual(SimulationState.Racing, machine.State);
        }

        [Test]
        public void AC77b_PerformancePausedThenFinishedResets()
        {
            // AC-7.7b transition from performance-Paused (timers PRESERVED on Paused entry) then
            // Finished must reset everything.
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            monitor.OnStateChanged(SimulationState.Idle, SimulationState.Racing);
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31); // pause request
            monitor.OnStateChanged(SimulationState.Racing, SimulationState.Paused); // performance-paused: preserved
            Assert.IsTrue(monitor.IsReduced, "timers preserved on performance pause");
            Assert.Greater(monitor.Below15TimerSeconds, 0f);

            monitor.OnStateChanged(SimulationState.Paused, SimulationState.Finished);
            Assert.IsFalse(monitor.IsReduced, "Finished resets after performance pause");
            Assert.IsFalse(monitor.IsPauseRequested);
            Assert.AreEqual(0f, monitor.Below30TimerSeconds);
            Assert.AreEqual(0f, monitor.Below15TimerSeconds);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds);
        }

        [Test]
        public void AC77_FrameAboveFifteenResetsBelow15Timer()
        {
            // Distinct >15 FPS reset: a 20 FPS frame (>15, <30) resets the below-15 timer
            // while reduced (only <15 FPS accumulates it).
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61); // Reduced
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 20); // 2s below 15
            Assert.Greater(monitor.Below15TimerSeconds, 0f);

            monitor.Evaluate(1f / 20f, SimulationState.Racing); // 20 FPS (>15, <30) resets
            Assert.AreEqual(0f, monitor.Below15TimerSeconds,
                "frame above 15 FPS resets below-15 timer");
        }
        [Test]
        public void Driver_EndToEndPerformancePauseFlow()
        {
            // Full integration: monitor requestPause -> PendingPerformancePause=true -> the
            // CountdownStep (SpineIndex 3) consumes it on the next tick -> Paused transition.
            // This exercises the REAL wiring the composition root performs (the monitor never
            // touches the state machine directly — the requestPause Action does).
            var machine = new SimulationStateMachine();
            machine.StartSingleRace(RaceMode.Race, new GridAssignment(1));
            machine.OnRaceLoadReady(RaceMode.Race, new GridAssignment(1)); // -> Countdown

            // requestPause is the real production wiring: set the pending flag.
            var monitor = new PerformanceMonitor(() => machine.PendingPerformancePause = true);
            var deltaSource = new FixedDelta(1f / 20f);
            var steps = new ISimulationPipelineStep[SimulationKernel.StepCount];
            for (int i = 0; i < steps.Length; i++)
                steps[i] = new NoOpStep();
            steps[CountdownStep.SpineIndex] = new CountdownStep(machine); // consumes pause at 3
            steps[GoStep.SpineIndex] = new GoStep(machine);
            var driver = new SimulationDriver(
                new SimulationKernel(new NoOpInputProcessor(), steps),
                machine,
                new FixedCapture(),
                deltaSource,
                performanceMonitor: monitor);

            // Reduced (3s at 20 FPS) then below 15 FPS for 3s -> monitor requests the pause.
            // The requestPause fires inside an Update (Evaluate before the tick loop); the same
            // Update's first tick consumes the flag and enters Paused. So after the frames, the
            // machine must already be Paused and the flag consumed.
            for (int i = 0; i < 61; i++)
                driver.Update(); // Reduced
            deltaSource.Delta = 1f / 10f;
            for (int i = 0; i < 31; i++)
                driver.Update(); // below-15 3s -> requestPause fires, same-frame tick consumes

            Assert.AreEqual(SimulationState.Paused, machine.State,
                "monitor request -> pending flag -> CountdownStep consumed -> Paused");
            Assert.IsFalse(machine.PendingPerformancePause, "flag consumed exactly once");
        }

        [Test]
        public void AC77e_SecondPauseRequestAfterRecovery()
        {
            // After recovery, re-reduction + sustained <15 FPS issues a SECOND pause request
            // (independent cycle, AC-7.7e).
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);  // Reduced
            Feed(monitor, SimulationState.Racing, fps: 60f, frames: 181); // Restored
            Assert.AreEqual(0, recorder.CallCount, "no pause during recovery");

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);  // re-reduce
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31);  // below-15 3s
            Assert.AreEqual(1, recorder.CallCount, "first pause request of the new cycle");

            Feed(monitor, SimulationState.Racing, fps: 60f, frames: 181); // restore again
            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);  // re-reduce for cycle 2
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31);  // below-15 3s
            Assert.AreEqual(2, recorder.CallCount, "second pause request after second recovery");
        }

        [Test]
        public void AC77f_ReEnteringCountdownStartsClean()
        {
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            Feed(monitor, SimulationState.Racing, fps: 20f, frames: 61);
            Feed(monitor, SimulationState.Racing, fps: 10f, frames: 31);
            monitor.OnStateChanged(SimulationState.Racing, SimulationState.Results); // reset
            monitor.OnStateChanged(SimulationState.Results, SimulationState.Countdown); // re-enter

            Assert.AreEqual(0f, monitor.Below30TimerSeconds, "re-entering Countdown starts clean");
            Assert.AreEqual(0f, monitor.Below15TimerSeconds);
            Assert.AreEqual(0f, monitor.RecoveryTimerSeconds);
            Assert.IsFalse(monitor.IsReduced);
            Assert.IsFalse(monitor.IsPauseRequested);
        }

        [Test]
        public void AC77f_ActiveReEntryDoesNotReset()
        {
            // Mutation guard: re-entering an ACTIVE state (Countdown/Racing) must NOT reset —
            // only Idle/Loading/Finished/Results do (AC-7.7b/7.7f). A reduced monitor re-entering
            // Countdown from a non-reset path keeps its reduced state and timers.
            var recorder = new PauseRecorder();
            var monitor = new PerformanceMonitor(recorder.Request);

            monitor.OnStateChanged(SimulationState.Idle, SimulationState.Countdown);
            Feed(monitor, SimulationState.Countdown, fps: 20f, frames: 61); // Reduced
            float below30Before = monitor.Below30TimerSeconds;
            Assert.IsTrue(monitor.IsReduced);

            // Simulate a transition Countdown -> Racing (active -> active, no reset state).
            monitor.OnStateChanged(SimulationState.Countdown, SimulationState.Racing);
            Assert.IsTrue(monitor.IsReduced,
                "active re-entry does not clear the reduced state (mutant guard)");
            Assert.AreEqual(below30Before, monitor.Below30TimerSeconds,
                "timers survive an active->active transition");
        }
    }
}
