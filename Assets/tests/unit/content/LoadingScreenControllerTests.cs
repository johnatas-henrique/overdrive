using System;
using System.Collections.Generic;
using System.Reflection;
using NUnit.Framework;
using Overdrive.Content;

namespace Overdrive.Content.Tests
{
    /// <summary>
    /// Unit tests for the engine-free <see cref="LoadingScreenController"/>
    /// (story 3-13 — AC-LS1..LS8, EC5, EC9). Fake presenter + fake clock +
    /// fake progress; no Unity references.
    /// </summary>
    public class LoadingScreenControllerTests
    {
        private const float MinDisplay = 0.5f;

        private sealed class FakeClock : IClock
        {
            public float Time { get; private set; }
            public void Advance(float seconds) => Time += seconds;
        }

        private sealed class FakeProgress : IRaceLoadProgress
        {
            private float _progress;
            public float Progress => _progress;
            public event Action<float> ProgressChanged;

            public void Emit(float value)
            {
                _progress = value;
                ProgressChanged?.Invoke(value);
            }
        }

        private sealed class FakePresenter : ILoadingScreenPresenter
        {
            public readonly List<float> ProgressValues = new List<float>();
            public int PreparingCount;
            public int CompleteCount;
            public readonly List<string> Errors = new List<string>();

            public void ShowProgress(float progress) => ProgressValues.Add(progress);
            public void ShowPreparing() => PreparingCount++;
            public void OnLoadComplete() => CompleteCount++;
            public void OnLoadError(string reason) => Errors.Add(reason);
            public bool InputBlocked => false; // UI-owned; the controller reports its own state
        }

        private sealed class ThrowingPresenter : ILoadingScreenPresenter
        {
            public readonly List<string> Errors = new List<string>(); // records OnLoadError WITHOUT throwing (observation seam)

            public void ShowProgress(float progress) => throw new InvalidOperationException("presenter boom");
            public void ShowPreparing() => throw new InvalidOperationException("presenter boom");
            public void OnLoadComplete() => throw new InvalidOperationException("presenter boom");
            public void OnLoadError(string reason) => Errors.Add(reason); // never throws — the observation point
            public bool InputBlocked => false;
        }

        private sealed class Harness
        {
            public FakeClock Clock = new FakeClock();
            public FakeProgress Progress = new FakeProgress();
            public FakePresenter Presenter = new FakePresenter();
            public LoadingScreenController Controller;

            public Harness(float minimum = MinDisplay)
            {
                Controller = new LoadingScreenController(Progress, Clock, Presenter, minimum);
            }
        }

        // ─── AC-LS1: BeginLoading emits ShowProgress(0) ────────────────────────────────

        [Test]
        public void AC_LS1_BeginLoading_EmitsProgressZero()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            Assert.That(h.Presenter.ProgressValues, Is.EqualTo(new[] { 0f }), "First presenter call is ShowProgress(0).");
        }

        [Test]
        public void AC_LS1_PreparingThenLoading_TransitionsToProgress()
        {
            var h = new Harness();
            h.Controller.BeginPreparing();
            Assert.That(h.Presenter.PreparingCount, Is.EqualTo(1));

            h.Controller.BeginLoading(); // catalog done → transition to the progress bar (same cycle)
            Assert.That(h.Presenter.ProgressValues, Is.EqualTo(new[] { 0f }),
                "BeginLoading after Preparing emits ShowProgress(0) in the same cycle.");
            Assert.That(h.Controller.InputBlocked, Is.True, "Still one continuous blocked cycle.");

            // The 0.5s minimum counts from the FIRST Begin* (catalog display included).
            h.Clock.Advance(0.5f);
            h.Controller.NotifyLoaded();
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(1), "First-launch cycle completes normally.");
        }

        // ─── AC-LS2: monotonic progress ───────────────────────────────────────────────

        [Test]
        public void AC_LS2_OutOfOrderProgress_ClampedMonotonic()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Progress.Emit(0.4f);
            h.Progress.Emit(0.2f); // regression — clamped, not emitted
            h.Progress.Emit(0.6f);
            Assert.That(h.Presenter.ProgressValues, Is.EqualTo(new[] { 0f, 0.4f, 0.6f }),
                "Progress never decreases; regressions are dropped.");
        }

        [Test]
        public void AC_LS2_EqualProgress_NotReemitted()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Progress.Emit(0.5f);
            h.Progress.Emit(0.5f);
            Assert.That(h.Presenter.ProgressValues.Count, Is.EqualTo(2), "0 then 0.5 — equal value not re-emitted.");
        }

        // ─── AC-LS3: minimum display 0.5s — Tick releases the boundary ────────────────

        [Test]
        public void AC_LS3_InstantLoad_HeldUntilHalfSecond()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Clock.Advance(0.1f);
            h.Controller.NotifyLoaded(); // elapsed 0.1 < 0.5 → pending

            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(0), "Not complete before the 0.5s bound.");
            Assert.That(h.Controller.InputBlocked, Is.True, "Still blocked while held.");

            h.Clock.Advance(0.3f); // elapsed 0.4
            h.Controller.Tick();
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(0), "Still under the bound.");

            h.Clock.Advance(0.1f); // elapsed 0.5
            h.Controller.Tick();
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(1), "Released exactly at the 0.5s bound.");
            Assert.That(h.Controller.InputBlocked, Is.False, "Unblocked at terminal.");
        }

        [Test]
        public void AC_LS3_CompletedFiresExactlyOnce()
        {
            var h = new Harness();
            int completed = 0;
            h.Controller.Completed += () => completed++;
            h.Controller.BeginLoading();
            h.Controller.NotifyLoaded(); // instant, < 0.5 → pending
            h.Clock.Advance(0.5f);
            h.Controller.Tick();
            h.Controller.Tick(); // repeated Tick after terminal
            Assert.That(completed, Is.EqualTo(1), "Completed fires exactly once.");
        }

        // ─── AC-LS4: load > 0.5s completes immediately ────────────────────────────────

        [Test]
        public void AC_LS4_SlowLoad_CompletesImmediatelyOnNotifyLoaded()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Clock.Advance(1.2f);
            h.Controller.NotifyLoaded();

            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(1), "Immediate completion when elapsed >= 0.5s.");
            Assert.That(h.Presenter.ProgressValues, Does.Contain(1f), "ShowProgress(1.0) emitted before completion.");
            Assert.That(h.Controller.ElapsedDisplay, Is.EqualTo(1.2f).Within(0.0001f));
        }

        [Test]
        public void AC_LS4_NotifyLoadedAfterPending_Ignored()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Controller.NotifyLoaded(); // pending
            h.Controller.NotifyLoaded(); // ignored — exactly-once per cycle
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(0), "Second NotifyLoaded while pending is ignored.");
            h.Clock.Advance(0.5f);
            h.Controller.Tick();
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(1), "The pending release still fires once.");
        }

        [Test]
        public void AC_LS4_DuplicateAfterMinimumElapsed_StillPending_OnlyTickReleases()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Controller.NotifyLoaded(); // pending at elapsed 0
            h.Clock.Advance(0.6f); // minimum elapsed — but the release is Tick-driven
            h.Controller.NotifyLoaded(); // duplicate: MUST be ignored even though elapsed passed
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(0),
                "A duplicate NotifyLoaded never completes — Tick is the only pending release.");
            h.Controller.Tick();
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(1), "Tick releases exactly once.");
        }

        // ─── AC-LS5: InputBlocked lifecycle ───────────────────────────────────────────

        [Test]
        public void AC_LS5_InputBlocked_FromBeginUntilTerminal()
        {
            var h = new Harness();
            Assert.That(h.Controller.InputBlocked, Is.False, "Idle — not blocked.");
            h.Controller.BeginLoading();
            Assert.That(h.Controller.InputBlocked, Is.True, "Blocked during loading.");
            h.Clock.Advance(0.5f);
            h.Controller.NotifyLoaded();
            Assert.That(h.Controller.InputBlocked, Is.False, "Unblocked at terminal-success.");
        }

        [Test]
        public void AC_LS5_InputBlocked_FromBeginPreparing()
        {
            var h = new Harness();
            h.Controller.BeginPreparing();
            Assert.That(h.Controller.InputBlocked, Is.True, "Blocked during the first-launch catalog phase.");
        }

        [Test]
        public void AC_LS5_InputBlocked_DisposeDoesNotUnblock()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Controller.Dispose();
            Assert.That(h.Controller.InputBlocked, Is.True,
                "Dispose never changes InputBlocked — blocking remains until terminal.");
            h.Clock.Advance(0.5f);
            h.Controller.NotifyLoaded();
            Assert.That(h.Controller.InputBlocked, Is.False, "Terminal unblocks.");
        }

        // ─── AC-LS6: first-launch Preparing ───────────────────────────────────────────

        [Test]
        public void AC_LS6_BeginPreparing_ShowsPreparing()
        {
            var h = new Harness();
            h.Controller.BeginPreparing();
            Assert.That(h.Presenter.PreparingCount, Is.EqualTo(1));
        }

        [Test]
        public void AC_LS6_PreparingThenError_NoProgressShown()
        {
            var h = new Harness();
            h.Controller.BeginPreparing();
            h.Controller.NotifyError("catalog failed");
            Assert.That(h.Presenter.ProgressValues, Is.Empty, "Catalog failure never shows a progress bar.");
            Assert.That(h.Presenter.Errors, Is.EqualTo(new[] { "catalog failed" }));
            Assert.That(h.Controller.InputBlocked, Is.False);
        }

        // ─── AC-LS8/EC9: non-fatal presentation failure never calls OnLoadError ───────

        [Test]
        public void AC_LS8_PresenterThrows_ProgressContinues_NoError()
        {
            var h = new Harness();
            var throwing = new ThrowingPresenter(); // SAME presenter is the observation point
            var controller = new LoadingScreenController(h.Progress, h.Clock, throwing, MinDisplay);
            var completed = 0;
            controller.Completed += () => completed++;

            Assert.DoesNotThrow(() => controller.BeginLoading(), "Presenter throw swallowed at BeginLoading.");
            Assert.DoesNotThrow(() => h.Progress.Emit(0.5f), "Presenter throw swallowed on progress.");
            h.Clock.Advance(0.5f);
            Assert.DoesNotThrow(() => controller.NotifyLoaded(), "Presenter throw swallowed at completion.");

            Assert.That(completed, Is.EqualTo(1), "Completion still fires despite presenter throws.");
            Assert.That(throwing.Errors, Is.Empty,
                "A presenter throw is never converted into OnLoadError (EC9) — observed on the SAME presenter.");
        }

        [Test]
        public void AC_EC9_NonFatalProgressHiccup_NeverCallsOnLoadError()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Progress.Emit(0.3f);
            h.Progress.Emit(0.1f); // hiccup — clamped, not an error
            Assert.That(h.Presenter.Errors, Is.Empty, "Progress regressions are not errors (EC9).");
        }

        [Test]
        public void AC_EC9_HappyPath_NeverEmitsError()
        {
            // The non-fatal contract: a happy cycle (progress 0 → 0.5 → 1.0 → complete)
            // NEVER emits OnLoadError — errors only appear via an explicit NotifyError.
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Progress.Emit(0.5f);
            h.Clock.Advance(0.5f);
            h.Controller.NotifyLoaded();

            Assert.That(h.Presenter.Errors, Is.Empty,
                "A complete happy cycle never calls OnLoadError (EC9).");
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(1));
        }

        [Test]
        public void AC_EC9_NotifyErrorOverridesPending()
        {
            // Error arriving while the min-display hold is active: the error wins —
            // OnLoadError is emitted, the pending release never fires, no Completed.
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Controller.NotifyLoaded(); // pending (elapsed 0 < 0.5)
            h.Controller.NotifyError("late failure");
            Assert.That(h.Presenter.Errors, Is.EqualTo(new[] { "late failure" }),
                "Error overrides the pending-complete state.");
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(0), "No Completed after an error.");
            h.Clock.Advance(0.5f);
            h.Controller.Tick();
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(0), "The pending release is cancelled by the error.");
            Assert.That(h.Controller.InputBlocked, Is.False);
        }

        // ─── AC-EC5: no cancellation API exists ───────────────────────────────────────

        [Test]
        public void AC_EC5_PublicApi_ExposesNoCancellationMethod()
        {
            var methods = typeof(LoadingScreenController).GetMethods(BindingFlags.Public | BindingFlags.Instance);
            foreach (var m in methods)
            {
                Assert.That(m.Name, Does.Not.Contain("Cancel"),
                    $"Public API must not expose a cancellation entry point (found {m.Name}).");
                Assert.That(m.Name, Does.Not.Contain("Abort"),
                    $"Public API must not expose an abort entry point (found {m.Name}).");
                Assert.That(m.Name, Does.Not.Contain("Stop"),
                    $"Public API must not expose a stop entry point (found {m.Name}).");
            }
        }

        [Test]
        public void AC_EC5_NoCancellationPath_BlockedUntilTerminal()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            Assert.That(h.Controller.InputBlocked, Is.True);
            // No player input can interrupt: the only exits are NotifyLoaded / NotifyError.
            h.Controller.NotifyError("aborted by system");
            Assert.That(h.Controller.InputBlocked, Is.False);
            Assert.That(h.Presenter.Errors.Count, Is.EqualTo(1));
        }

        // ─── Multi-cycle re-arm ───────────────────────────────────────────────────────

        [Test]
        public void MultiCycle_ReArmAfterTerminal_NewCycleWorks()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Clock.Advance(0.5f);
            h.Controller.NotifyLoaded();
            Assert.That(h.Controller.InputBlocked, Is.False);

            h.Clock.Advance(10f); // next race — a long time later
            h.Controller.BeginLoading(); // re-arm
            Assert.That(h.Controller.InputBlocked, Is.True, "Re-armed cycle blocks input.");
            Assert.That(h.Presenter.ProgressValues, Does.Contain(0f), "Re-arm emits ShowProgress(0).");

            h.Clock.Advance(0.6f);
            h.Controller.NotifyLoaded();
            Assert.That(h.Controller.InputBlocked, Is.False);
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(2), "Second cycle completes.");
        }

        [Test]
        public void MultiCycle_BeginWhileActive_NoOp()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Controller.BeginLoading(); // no-op — same-type re-entry
            h.Controller.BeginPreparing(); // no-op — Preparing after Loading is irrelevant
            Assert.That(h.Presenter.ProgressValues.Count, Is.EqualTo(1), "Only the first BeginLoading emitted progress.");
            Assert.That(h.Presenter.PreparingCount, Is.EqualTo(0), "BeginPreparing while loading is a no-op.");
        }

        // ─── Edge/reentrancy (gate R1) ───────────────────────────────────────────────

        [Test]
        public void Reentrancy_CompletedSubscriber_ReArmsNewCycle()
        {
            var h = new Harness();
            var rearmed = 0;
            h.Controller.Completed += () =>
            {
                h.Controller.BeginLoading(); // re-arm mid-event
                rearmed++;
            };

            h.Controller.BeginLoading();
            h.Clock.Advance(0.5f);
            h.Controller.NotifyLoaded();

            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(1), "First cycle completed.");
            Assert.That(rearmed, Is.EqualTo(1), "Subscriber re-armed.");
            Assert.That(h.Controller.InputBlocked, Is.True, "The re-armed cycle is active and blocked.");
            h.Clock.Advance(0.5f);
            h.Controller.NotifyLoaded();
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(2), "Re-armed cycle completes cleanly.");
        }

        [Test]
        public void ZeroMinimumDisplay_CompletesImmediately()
        {
            var h = new Harness(minimum: 0f);
            h.Controller.BeginLoading();
            h.Controller.NotifyLoaded(); // elapsed 0 >= 0
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(1), "Zero minimum completes immediately.");
            Assert.That(h.Controller.InputBlocked, Is.False);
        }

        [Test]
        public void NotifyLoadedDuringPreparing_CompletesWithoutBar()
        {
            // Defined behavior: the cycle is generic — Preparing is a visual phase.
            // A catalog-only cycle that never transitions to loading still completes
            // (ShowProgress(1.0) is emitted for completeness; the UI decides what to show).
            var h = new Harness();
            h.Controller.BeginPreparing();
            h.Clock.Advance(0.5f);
            h.Controller.NotifyLoaded();
            Assert.That(h.Presenter.CompleteCount, Is.EqualTo(1), "Preparing-only cycle completes.");
            Assert.That(h.Presenter.ProgressValues, Does.Contain(1f), "ShowProgress(1.0) emitted at completion.");
            Assert.That(h.Controller.InputBlocked, Is.False);
        }

        [Test]
        public void MultiCycle_PreparingOrigin_ReArmResetsPreparing()
        {
            var h = new Harness();
            h.Controller.BeginPreparing();
            h.Clock.Advance(0.5f);
            h.Controller.NotifyError("boom"); // terminal from a Preparing-origin cycle
            Assert.That(h.Presenter.PreparingCount, Is.EqualTo(1));

            h.Clock.Advance(10f);
            h.Controller.BeginPreparing(); // re-arm — _preparing must be reset
            Assert.That(h.Presenter.PreparingCount, Is.EqualTo(2), "Re-armed Preparing cycle shows Preparing again.");

            h.Controller.BeginLoading(); // transition — must work in the new cycle
            Assert.That(h.Presenter.ProgressValues, Does.Contain(0f), "Transition to progress works after Preparing re-arm.");
            h.Controller.BeginLoading(); // second BeginLoading after the transition → no-op
            Assert.That(h.Presenter.ProgressValues.Count, Is.EqualTo(1),
                "Second BeginLoading after the transition is a no-op (no duplicate ShowProgress(0)).");
            Assert.That(h.Controller.InputBlocked, Is.True);
        }

        // ─── Dispose ──────────────────────────────────────────────────────────────────

        [Test]
        public void Dispose_UnsubscribesProgress_NoFurtherEmission()
        {
            var h = new Harness();
            h.Controller.BeginLoading();
            h.Controller.Dispose();
            h.Progress.Emit(0.7f);
            Assert.That(h.Presenter.ProgressValues, Is.EqualTo(new[] { 0f }),
                "After Dispose, progress events are no longer forwarded.");
        }

        [Test]
        public void Ctor_NullArgs_Throw()
        {
            var clock = new FakeClock();
            var progress = new FakeProgress();
            var presenter = new FakePresenter();
            Assert.Throws<ArgumentNullException>(() => new LoadingScreenController(null, clock, presenter));
            Assert.Throws<ArgumentNullException>(() => new LoadingScreenController(progress, null, presenter));
            Assert.Throws<ArgumentNullException>(() => new LoadingScreenController(progress, clock, null));
            Assert.Throws<ArgumentOutOfRangeException>(() => new LoadingScreenController(progress, clock, presenter, -1f));
        }
    }
}
