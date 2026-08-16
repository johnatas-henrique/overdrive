using System;
using System.Collections.Generic;
using NUnit.Framework;
using Overdrive.Simulation;

namespace Overdrive.Content.Tests
{
    /// <summary>
    /// Story 005 (Startup, Catalog &amp; Fatal Errors) — engine-free orchestrator tests:
    /// catalog retry bound, fatal classification, startup success, focus deferral, stage latch.
    /// </summary>
    public class StartupErrorTests
    {
        private sealed class FakeCatalog : ICatalogInitializer
        {
            public int InitializeCount;
            public readonly Queue<CatalogInitResult> Results = new Queue<CatalogInitResult>();

            public FakeCatalog(params CatalogInitResult[] results)
            {
                foreach (var r in results)
                    Results.Enqueue(r);
            }

            public void Initialize(Action<CatalogInitResult> onComplete)
            {
                InitializeCount++;
                onComplete(Results.Count > 0 ? Results.Dequeue() : new CatalogInitResult(true, string.Empty));
            }
        }

        private sealed class FakeShared : ISharedLoader
        {
            public int LoadCount;
            public readonly Queue<SharedLoadResult> Results = new Queue<SharedLoadResult>();

            public FakeShared(params SharedLoadResult[] results)
            {
                foreach (var r in results)
                    Results.Enqueue(r);
            }

            public void LoadShared(Action<SharedLoadResult> onComplete)
            {
                LoadCount++;
                onComplete(Results.Count > 0 ? Results.Dequeue() : new SharedLoadResult(true, string.Empty));
            }
        }

        private sealed class FakeFatal : IFatalErrorHandler
        {
            public readonly List<(string Reason, ContentErrorType Type)> Calls = new List<(string, ContentErrorType)>();

            public void Fatal(string reason, ContentErrorType type) => Calls.Add((reason, type));
        }

        private sealed class FakeFocus : IFocusSeam
        {
            public bool IsFocused { get; set; } = true;

            public event Action<bool> FocusChanged;

            public void SetFocused(bool focused)
            {
                IsFocused = focused;
                FocusChanged?.Invoke(focused);
            }
        }

        private sealed class Probe
        {
            public FakeCatalog Catalog;
            public FakeShared Shared;
            public FakeFatal Fatal;
            public FakeFocus Focus;
            public StartupOrchestrator Orchestrator;
            public int StartupCompleteCount;
            public int FatalCount;
            public string LastFatalReason;
            public ContentErrorType LastFatalType;

            public Probe(FakeCatalog catalog, FakeShared shared)
            {
                Catalog = catalog;
                Shared = shared;
                Fatal = new FakeFatal();
                Focus = new FakeFocus();
                Orchestrator = new StartupOrchestrator(catalog, shared, Fatal, Focus);
                Orchestrator.StartupComplete += () => StartupCompleteCount++;
                Orchestrator.Fatal += (reason, type) =>
                {
                    FatalCount++;
                    LastFatalReason = reason;
                    LastFatalType = type;
                };
            }
        }

        /// <summary>Probe for the manual (deferred-completion) catalog used by focus tests; the shared seam may be any loader.</summary>
        private sealed class ManualProbe
        {
            public ManualCatalog Catalog;
            public ISharedLoader Shared;
            public FakeFatal Fatal;
            public FakeFocus Focus;
            public StartupOrchestrator Orchestrator;
            public int StartupCompleteCount;
            public int FatalCount;
            public ContentErrorType LastFatalType;

            public ManualProbe(ManualCatalog catalog, ISharedLoader shared)
            {
                Catalog = catalog;
                Shared = shared;
                Fatal = new FakeFatal();
                Focus = new FakeFocus();
                Orchestrator = new StartupOrchestrator(catalog, shared, Fatal, Focus);
                Orchestrator.StartupComplete += () => StartupCompleteCount++;
                Orchestrator.Fatal += (reason, type) =>
                {
                    FatalCount++;
                    LastFatalType = type;
                };
            }
        }

        // ─── AC-EC1: catalog retry once, then Fatal(Catalog) ──────────────────────────

        [Test]
        public void AC_EC1_CatalogFailsTwice_FatalCatalog()
        {
            var p = new Probe(
                new FakeCatalog(new CatalogInitResult(false, "boom"), new CatalogInitResult(false, "boom2")),
                new FakeShared());

            p.Orchestrator.Run();

            Assert.That(p.Catalog.InitializeCount, Is.EqualTo(2), "Catalog retried exactly once (max 2 attempts).");
            Assert.That(p.Shared.LoadCount, Is.EqualTo(0), "Shared never loads after catalog failure.");
            Assert.That(p.FatalCount, Is.EqualTo(1), "Fatal fired exactly once.");
            Assert.That(p.LastFatalType, Is.EqualTo(ContentErrorType.Catalog), "Catalog fatal classified as Catalog.");
            Assert.That(p.LastFatalReason, Does.Contain("catalog"), "Catalog fatal reason carries the catalog context.");
            Assert.That(p.Fatal.Calls.Count, Is.EqualTo(1), "The fatal handler received exactly one call.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(0), "Startup never completes after fatal.");
        }

        [Test]
        public void AC_EC1_CatalogFailsThenRetrySucceeds_ProceedsToOneSharedLoad()
        {
            var p = new Probe(
                new FakeCatalog(new CatalogInitResult(false, "first"), new CatalogInitResult(true, string.Empty)),
                new FakeShared(new SharedLoadResult(true, string.Empty)));

            p.Orchestrator.Run();

            Assert.That(p.Catalog.InitializeCount, Is.EqualTo(2), "Retry ran once after first failure.");
            Assert.That(p.Shared.LoadCount, Is.EqualTo(1), "Exactly ONE Shared load after retry success.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1), "Startup completed.");
            Assert.That(p.FatalCount, Is.EqualTo(0), "No fatal.");
        }

        [Test]
        public void AC_EC1_CatalogSucceedsFirstTry_NoRetry()
        {
            var p = new Probe(
                new FakeCatalog(new CatalogInitResult(true, string.Empty)),
                new FakeShared(new SharedLoadResult(true, string.Empty)));

            p.Orchestrator.Run();

            Assert.That(p.Catalog.InitializeCount, Is.EqualTo(1), "No retry on first success.");
            Assert.That(p.Shared.LoadCount, Is.EqualTo(1));
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1));
        }

        // ─── AC-EC10: Shared failure is fatal with Shared type ───────────────────────

        [Test]
        public void AC_EC10_SharedFails_FatalShared()
        {
            var p = new Probe(
                new FakeCatalog(new CatalogInitResult(true, string.Empty)),
                new FakeShared(new SharedLoadResult(false, "shared corrupt")));

            p.Orchestrator.Run();

            Assert.That(p.Shared.LoadCount, Is.EqualTo(1), "Shared loaded once.");
            Assert.That(p.FatalCount, Is.EqualTo(1));
            Assert.That(p.LastFatalType, Is.EqualTo(ContentErrorType.Shared), "Shared failure classified as Shared (NOT Catalog).");
            Assert.That(p.LastFatalReason, Does.Contain("shared corrupt"));
            Assert.That(p.StartupCompleteCount, Is.EqualTo(0));
        }

        // ─── Startup success: Shared retained + completion ───────────────────────────

        [Test]
        public void StartupSuccess_CatalogAndShared_Completes()
        {
            var p = new Probe(
                new FakeCatalog(new CatalogInitResult(true, string.Empty)),
                new FakeShared(new SharedLoadResult(true, string.Empty)));

            p.Orchestrator.Run();

            Assert.That(p.StartupCompleteCount, Is.EqualTo(1));
            Assert.That(p.FatalCount, Is.EqualTo(0));
            Assert.That(p.Shared.LoadCount, Is.EqualTo(1), "Shared loaded exactly once (retained by the loader seam).");
        }

        // ─── Fatal exactly-once: terminal + late callbacks ignored ───────────────────

        [Test]
        public void Fatal_ExactlyOnce_LateCallbackIgnored()
        {
            var catalog = new FakeCatalog(new CatalogInitResult(false, "a"), new CatalogInitResult(false, "b"));
            var p = new Probe(catalog, new FakeShared());
            p.Orchestrator.Run();

            // After the terminal fatal, a late/duplicate catalog completion is ignored.
            catalog.Results.Enqueue(new CatalogInitResult(true, string.Empty));
            // (The orchestrator owns no handle to re-drive — the latch is proven by Run() idempotency:)
            p.Orchestrator.Run();

            Assert.That(p.Catalog.InitializeCount, Is.EqualTo(2), "Run() after terminal does not start a new attempt.");
            Assert.That(p.FatalCount, Is.EqualTo(1), "Fatal exactly once.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(0));
        }

        [Test]
        public void Fatal_HandlerReceives_ExactlyOneCall()
        {
            var p = new Probe(
                new FakeCatalog(new CatalogInitResult(false, "a"), new CatalogInitResult(false, "b")),
                new FakeShared());

            p.Orchestrator.Run();

            Assert.That(p.Fatal.Calls.Count, Is.EqualTo(1), "The IFatalErrorHandler port received exactly one invocation.");
        }

        // ─── Stage latch: duplicate callbacks for a consumed stage are ignored ────────

        [Test]
        public void StageLatch_DuplicateCatalogCallbackIgnored()
        {
            var catalog = new FakeCatalog(new CatalogInitResult(true, string.Empty));
            var shared = new FakeShared(new SharedLoadResult(true, string.Empty));
            var p = new Probe(catalog, shared);

            p.Orchestrator.Run();
            // A duplicate catalog completion arriving after the stage advanced to Shared is
            // ignored (the latch consumed the first result). The FakeCatalog already advanced;
            // this proves the orchestrator did not re-enter the catalog stage.
            p.Orchestrator.Run();

            Assert.That(p.Catalog.InitializeCount, Is.EqualTo(1), "No second catalog attempt after completion.");
            Assert.That(p.Shared.LoadCount, Is.EqualTo(1), "Shared loaded exactly once.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1));
        }

        // ─── AC-EC7: focus deferral — buffered completion consumed once on re-focus ───

        [Test]
        public void AC_EC7_FocusLostDuringCatalog_BuffersAndResumes_NoReInit()
        {
            // Deferred catalog: the adapter fires the completion only when the orchestrator
            // is ready to consume it (focus returned) — the fake fires immediately, so we
            // simulate the race by losing focus BEFORE Run() and firing the callback manually.
            var catalog = new ManualCatalog();
            var shared = new FakeShared(new SharedLoadResult(true, string.Empty));
            var p = new ManualProbe(catalog, shared);
            p.Focus.SetFocused(false);

            p.Orchestrator.Run();
            Assert.That(catalog.CompletionsDelivered, Is.EqualTo(0), "Startup deferred while unfocused.");

            catalog.DeliverNow(new CatalogInitResult(true, string.Empty));
            Assert.That(p.StartupCompleteCount, Is.EqualTo(0), "Completion buffered while unfocused (no advance).");

            p.Focus.SetFocused(true);
            Assert.That(p.Catalog.InitializeCount, Is.EqualTo(1), "No re-init on focus return — buffered result consumed.");
            Assert.That(shared.LoadCount, Is.EqualTo(1), "Advanced to the Shared stage once.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1), "Startup completed after the buffered result was consumed.");
        }

        [Test]
        public void AC_EC7_FocusLossDuringRetry_NoExtraInit()
        {
            var catalog = new ManualCatalog();
            var shared = new ManualShared();
            var p = new ManualProbe(catalog, shared);
            p.Orchestrator.Run();
            catalog.DeliverNow(new CatalogInitResult(false, "first"));

            // Retry in flight; focus is lost.
            p.Focus.SetFocused(false);
            catalog.DeliverNow(new CatalogInitResult(false, "second"));
            Assert.That(p.FatalCount, Is.EqualTo(0), "Fatal buffered while unfocused.");

            p.Focus.SetFocused(true);
            Assert.That(p.Catalog.InitializeCount, Is.EqualTo(2), "Retry bound holds (max 2 attempts).");
            Assert.That(p.FatalCount, Is.EqualTo(1), "Fatal delivered once after re-focus.");
            Assert.That(p.LastFatalType, Is.EqualTo(ContentErrorType.Catalog));
        }

        [Test]
        public void AC_EC7_RepeatedBackgroundForeground_SingleConsumption()
        {
            var catalog = new ManualCatalog();
            var shared = new FakeShared(new SharedLoadResult(true, string.Empty));
            var p = new ManualProbe(catalog, shared);
            p.Focus.SetFocused(false);
            p.Orchestrator.Run();

            catalog.DeliverNow(new CatalogInitResult(true, string.Empty));
            p.Focus.SetFocused(true);   // consume the buffered success → Shared stage starts
            p.Focus.SetFocused(false);  // background again
            p.Focus.SetFocused(true);   // foreground again — no buffered result remains
            p.Focus.SetFocused(false);
            p.Focus.SetFocused(true);

            Assert.That(shared.LoadCount, Is.EqualTo(1), "Shared loaded exactly once across focus churn.");
            Assert.That(p.Catalog.InitializeCount, Is.EqualTo(1));
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1));
        }

        // ─── Run() idempotency ────────────────────────────────────────────────────────

        [Test]
        public void Run_SecondCall_NoOp()
        {
            var p = new Probe(
                new FakeCatalog(new CatalogInitResult(true, string.Empty)),
                new FakeShared(new SharedLoadResult(true, string.Empty)));

            p.Orchestrator.Run();
            p.Orchestrator.Run();

            Assert.That(p.Catalog.InitializeCount, Is.EqualTo(1), "Second Run() is a no-op.");
            Assert.That(p.Shared.LoadCount, Is.EqualTo(1));
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1));
        }

        [Test]
        public void Run_SecondCall_WhileStageInFlight_NoDoubleInit()
        {
            var catalog = new ManualCatalog();
            var p = new ManualProbe(catalog, new FakeShared(new SharedLoadResult(true, string.Empty)));
            p.Orchestrator.Run(); // catalog in flight (no completion delivered yet)

            p.Orchestrator.Run(); // duplicate Run while a stage is in flight

            Assert.That(catalog.InitializeCount, Is.EqualTo(1), "Run() while in flight does not start a second attempt.");
            catalog.DeliverNow(new CatalogInitResult(true, string.Empty));
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1), "The single in-flight attempt completes normally.");
        }

        // ─── AC-EC7: initial-unfocused state is honored (IsFocused sampled at Run) ───

        [Test]
        public void AC_EC7_InitialUnfocused_BuffersUntilFirstFocus()
        {
            var catalog = new ManualCatalog();
            var shared = new FakeShared(new SharedLoadResult(true, string.Empty));
            var p = new ManualProbe(catalog, shared);
            p.Focus.IsFocused = false; // App starts backgrounded — no FocusChanged event has fired.

            p.Orchestrator.Run();
            catalog.DeliverNow(new CatalogInitResult(true, string.Empty));
            Assert.That(p.StartupCompleteCount, Is.EqualTo(0), "Buffered while initially unfocused (IsFocused sampled at Run).");
            Assert.That(shared.LoadCount, Is.EqualTo(0), "No stage advancement while initially unfocused.");

            p.Focus.SetFocused(true);
            Assert.That(shared.LoadCount, Is.EqualTo(1), "Advanced after the first re-focus.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1));
        }

        // ─── AC-EC7: Shared-stage in-flight focus loss ───────────────────────────────

        [Test]
        public void AC_EC7_FocusLostDuringShared_BuffersSharedCompletion()
        {
            var catalog = new ManualCatalog();
            var shared = new ManualShared();
            var p = new ManualProbe(catalog, shared);
            p.Orchestrator.Run();
            catalog.DeliverNow(new CatalogInitResult(true, string.Empty)); // → Shared stage
            Assert.That(shared.LoadCount, Is.EqualTo(1));

            p.Focus.SetFocused(false);
            shared.DeliverNow(new SharedLoadResult(true, string.Empty));
            Assert.That(p.StartupCompleteCount, Is.EqualTo(0), "Shared completion buffered while unfocused.");

            p.Focus.SetFocused(true);
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1), "Startup completed after re-focus consumed the buffered Shared result.");
            Assert.That(p.FatalCount, Is.EqualTo(0));
        }

        // ─── Buffer latch: duplicate result while unfocused does NOT overwrite ───────

        [Test]
        public void BufferLatch_DuplicateWhileUnfocused_FirstWins()
        {
            var catalog = new ManualCatalog();
            var shared = new FakeShared(new SharedLoadResult(true, string.Empty));
            var p = new ManualProbe(catalog, shared);
            p.Focus.SetFocused(false);
            p.Orchestrator.Run();

            catalog.DeliverNow(new CatalogInitResult(true, string.Empty)); // buffered first
            catalog.DeliverNow(new CatalogInitResult(false, "late failure")); // duplicate — must NOT overwrite

            p.Focus.SetFocused(true);
            Assert.That(shared.LoadCount, Is.EqualTo(1), "The FIRST (success) buffered result was consumed — the late failure did not replace it.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1), "Startup completed from the original result.");
            Assert.That(p.FatalCount, Is.EqualTo(0));
        }

        // ─── Buffer latch (SHARED stage): duplicate Shared result while unfocused ────

        [Test]
        public void BufferLatch_SharedDuplicateWhileUnfocused_FirstWins()
        {
            var catalog = new ManualCatalog();
            var shared = new ManualShared();
            var p = new ManualProbe(catalog, shared);
            p.Orchestrator.Run();
            catalog.DeliverNow(new CatalogInitResult(true, string.Empty)); // → Shared stage

            p.Focus.SetFocused(false);
            shared.DeliverNow(new SharedLoadResult(true, string.Empty));      // buffered first
            shared.DeliverNow(new SharedLoadResult(false, "late failure"));   // duplicate — must NOT overwrite

            p.Focus.SetFocused(true);
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1), "The FIRST (success) Shared result was consumed — the late failure did not replace it.");
            Assert.That(p.FatalCount, Is.EqualTo(0));
            Assert.That(shared.LoadCount, Is.EqualTo(1), "Shared loaded exactly once.");
        }

        // ─── Fatal exactly-once: a replayed late callback after terminal is ignored ──

        [Test]
        public void Fatal_ReplayedLateCallback_StillExactlyOnce()
        {
            var catalog = new ManualCatalog();
            var p = new ManualProbe(catalog, new FakeShared());
            p.Orchestrator.Run();

            catalog.DeliverNow(new CatalogInitResult(false, "first"));   // retry starts
            catalog.DeliverNow(new CatalogInitResult(false, "second"));  // fatal fires (terminal)
            Assert.That(p.FatalCount, Is.EqualTo(1));

            // A replayed late callback (same token) after the terminal must be ignored.
            catalog.DeliverNow(new CatalogInitResult(true, string.Empty));
            Assert.That(p.FatalCount, Is.EqualTo(1), "No second Fatal from a replayed callback.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(0), "No startup from a replayed callback after terminal.");
        }

        // ─── SafePublish: a subscriber throw never corrupts the terminal ──────────────

        [Test]
        public void SubscriberThrow_StartupComplete_StillTerminal()
        {
            var p = new Probe(
                new FakeCatalog(new CatalogInitResult(true, string.Empty)),
                new FakeShared(new SharedLoadResult(true, string.Empty)));
            p.Orchestrator.StartupComplete += () => throw new InvalidOperationException("subscriber boom");

            Assert.DoesNotThrow(() => p.Orchestrator.Run(),
                "A throwing subscriber must not propagate into the Addressables dispatch.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1), "The SafePublish still invoked the counting subscriber.");
            Assert.That(p.Shared.LoadCount, Is.EqualTo(1));
        }

        [Test]
        public void SubscriberThrow_Fatal_StillDeliveredToPort()
        {
            var p = new Probe(
                new FakeCatalog(new CatalogInitResult(false, "a"), new CatalogInitResult(false, "b")),
                new FakeShared());
            p.Orchestrator.Fatal += (_, _) => throw new InvalidOperationException("subscriber boom");

            Assert.DoesNotThrow(() => p.Orchestrator.Run(),
                "A throwing Fatal subscriber must not propagate.");
            Assert.That(p.Fatal.Calls.Count, Is.EqualTo(1), "The IFatalErrorHandler port received the fatal BEFORE the event.");
            Assert.That(p.FatalCount, Is.EqualTo(1));
        }

        // ─── Stage latch: duplicate completion for the SAME stage is ignored ──────────

        [Test]
        public void StageLatch_DuplicateManualCallback_Ignored()
        {
            var catalog = new ManualCatalog();
            var shared = new FakeShared(new SharedLoadResult(true, string.Empty));
            var p = new ManualProbe(catalog, shared);
            p.Orchestrator.Run();

            catalog.DeliverNow(new CatalogInitResult(true, string.Empty)); // consumed → Shared starts
            catalog.DeliverNow(new CatalogInitResult(true, string.Empty)); // duplicate — the fake re-delivers; the orchestrator must ignore it

            Assert.That(catalog.InitializeCount, Is.EqualTo(1), "No re-entry into the catalog stage.");
            Assert.That(shared.LoadCount, Is.EqualTo(1), "Shared loaded exactly once.");
            Assert.That(p.StartupCompleteCount, Is.EqualTo(1));
        }

        // ─── Manual (deferred-completion) fakes for focus tests ──────────────────────

        private sealed class ManualCatalog : ICatalogInitializer
        {
            private Action<CatalogInitResult> _pending;
            private Action<CatalogInitResult> _lastCallback;

            public int InitializeCount;

            public int CompletionsDelivered;

            public void Initialize(Action<CatalogInitResult> onComplete)
            {
                InitializeCount++;
                _pending = onComplete;
            }

            public void DeliverNow(CatalogInitResult result)
            {
                CompletionsDelivered++;
                if (_pending != null)
                {
                    var cb = _pending;
                    _pending = null;
                    _lastCallback = cb;
                    cb(result);
                    return;
                }

                // Simulate a duplicate/late completion from the adapter: re-invoke the SAME
                // callback (same captured token) — the orchestrator's stage latch must ignore it.
                _lastCallback?.Invoke(result);
            }
        }

        private sealed class ManualShared : ISharedLoader
        {
            private Action<SharedLoadResult> _pending;
            private Action<SharedLoadResult> _lastCallback;

            public int LoadCount;

            public void LoadShared(Action<SharedLoadResult> onComplete)
            {
                LoadCount++;
                _pending = onComplete;
            }

            public void DeliverNow(SharedLoadResult result)
            {
                if (_pending != null)
                {
                    var cb = _pending;
                    _pending = null;
                    _lastCallback = cb;
                    cb(result);
                    return;
                }

                // Simulate a duplicate/late completion from the adapter: re-invoke the SAME
                // callback — the orchestrator's buffer latch must ignore the overwrite.
                _lastCallback?.Invoke(result);
            }
        }
    }
}
