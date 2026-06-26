import type { ISnapshotable } from "./isnapshotable";
import { SnapshotError } from "./snapshot-error";

/**
 * A complete snapshot of the entire game simulation at a single point in time.
 *
 * All data in this interface is JSON-serializable — plain objects, arrays, and
 * primitives only. No Maps, Sets, classes, or circular references.
 *
 * @example
 * ```typescript
 * const snapshot: FullGameSnapshot = {
 *   tick: 42,
 *   timestamp: 1719234567890,
 *   systems: {
 *     fuel: { state: { level: 85.3 }, hash: "a430d84680aabd0b" },
 *     physics: { state: { pos: { x: 10, y: 0, z: 5 } }, hash: "cbf29ce484222325" },
 *   },
 *   snapshotHash: "",
 * };
 * JSON.parse(JSON.stringify(snapshot)); // deep-equal to original
 * ```
 */
export interface FullGameSnapshot {
  /** Game tick at which this snapshot was captured. */
  readonly tick: number;

  /** `Date.now()` timestamp at capture time. */
  readonly timestamp: number;

  /**
   * Per-system snapshot data, keyed by `systemId`.
   * Each entry contains the system's serialized state and its FNV-1a hash.
   */
  readonly systems: Readonly<
    Record<
      string,
      { readonly state: Record<string, unknown>; readonly hash: string }
    >
  >;

  /**
   * SHA-256 hash of all systems' state combined.
   * Stub (`""`) in MVP — populated by Story 003.
   */
  readonly snapshotHash: string;
}

/**
 * Options for an on-demand snapshot.
 *
 * @example
 * ```typescript
 * // Force a snapshot regardless of frequency setting:
 * orchestrator.takeSnapshot({ force: true, tick: 42 });
 *
 * // With default tick (0):
 * orchestrator.takeSnapshot({ force: true });
 * ```
 */
export interface TakeSnapshotOptions {
  /** When `true`, bypass the `takeEveryNthTick` frequency check. */
  readonly force?: boolean;

  /** Game tick for the snapshot (defaults to `0` when omitted). */
  readonly tick?: number;
}

/**
 * Internal state machine for the snapshot orchestrator lifecycle.
 *
 * ```
 * [Uninitialized] --init()--> [Ready] --dispose()--> [Disposed]
 *     │                                                │
 *     └───── dispose() ────────────────────────────────┘
 * ```
 *
 * - **Uninitialized**: Only `dispose()` succeeds. All other operations throw.
 * - **Ready**: Normal operation — `register()` and `takeSnapshot()` work.
 * - **Disposed**: Only `dispose()` succeeds (idempotent no-op). All others throw.
 */
type SnapshotState = "Uninitialized" | "Ready" | "Disposed";

/**
 * Orchestrator for capturing full-game simulation snapshots.
 *
 * Manages a registry of {@link ISnapshotable} systems and coordinates snapshot
 * capture at configurable tick frequencies. Systems register themselves during
 * their own init phase, and the caller triggers snapshots at fixed points in
 * the game loop.
 *
 * **Not a singleton** — instantiate and inject via constructor.
 *
 * @example
 * ```typescript
 * // Create with default frequency (every tick):
 * const snapshots = new SimulationSnapshot();
 *
 * // Or with Nth-tick frequency:
 * const snapshots = new SimulationSnapshot(60);
 *
 * // Lifecycle:
 * snapshots.init();
 * snapshots.register(physicsSystem);
 * snapshots.register(fuelSystem);
 *
 * const s1 = snapshots.takeSnapshot(0);  // snapshot at tick 0
 * const s2 = snapshots.takeSnapshot(1);  // snapshot at tick 1
 *
 * snapshots.dispose();
 * // snapshots.takeSnapshot(2);  // throws SnapshotError
 * ```
 */
export class SimulationSnapshot {
  private state: SnapshotState = "Uninitialized";
  private readonly registry = new Map<string, ISnapshotable>();
  private readonly takeEveryNthTick: number;

  /**
   * @param takeEveryNthTick - Snapshot frequency control. A snapshot is taken
   *   every N ticks. Defaults to `1` (every tick). Use higher values (e.g.
   *   `60`) to reduce snapshot rate for bandwidth-sensitive scenarios.
   */
  constructor(takeEveryNthTick = 1) {
    this.takeEveryNthTick = takeEveryNthTick;
  }

  /**
   * Transition the orchestrator from Uninitialized to Ready state.
   *
   * - Calling `init()` when already **Ready** is a no-op.
   * - Calling `init()` after **Disposed** throws.
   *
   * @throws {SnapshotError} If called after `dispose()`.
   */
  init(): void {
    if (this.state === "Disposed") {
      throw new SnapshotError("Cannot init after dispose");
    }
    if (this.state === "Ready") {
      return; // double-init is a no-op
    }
    this.state = "Ready";
  }

  /**
   * Register a system for snapshot participation.
   *
   * The system's {@link ISnapshotable.systemId} becomes the key in the
   * snapshot's `systems` record. Duplicate registration (same `systemId`
   * twice) overwrites — deduplication guard is added in Story 004.
   *
   * @param system - The system to register.
   * @throws {SnapshotError} If called before `init()` or after `dispose()`.
   */
  register(system: ISnapshotable): void {
    if (this.state !== "Ready") {
      throw new SnapshotError("Not initialized");
    }
    this.registry.set(system.systemId, system);
  }

  /**
   * Capture a full-game snapshot of all registered systems.
   *
   * **Frequency check**: When called with a tick number and `force` is not set,
   * returns `null` for ticks that don't satisfy `tick % takeEveryNthTick === 0`.
   *
   * **On-demand**: Pass `{ force: true }` to bypass the frequency check entirely.
   *
   * @overload
   * Capture with a tick number (frequency check applies).
   *
   * @param tick - Current game tick.
   * @returns The snapshot, or `null` if frequency condition is not met.
   *
   * @overload
   * Capture with options (on-demand bypass available).
   *
   * @param options - Options including `force` flag and optional `tick`.
   * @returns The snapshot, or `null` if frequency condition is not met and
   *   `force` is not `true`.
   *
   * @throws {SnapshotError} If called before `init()` or after `dispose()`.
   */
  takeSnapshot(tick: number): FullGameSnapshot | null;
  takeSnapshot(options: TakeSnapshotOptions): FullGameSnapshot | null;
  takeSnapshot(
    tickOrOptions: number | TakeSnapshotOptions
  ): FullGameSnapshot | null {
    if (this.state !== "Ready") {
      throw new SnapshotError("Not initialized");
    }

    let tick: number;
    let force = false;

    if (typeof tickOrOptions === "number") {
      tick = tickOrOptions;
    } else {
      tick = tickOrOptions.tick ?? 0;
      force = tickOrOptions.force ?? false;
    }

    if (!force && tick % this.takeEveryNthTick !== 0) {
      return null;
    }

    const systems: Record<
      string,
      { state: Record<string, unknown>; hash: string }
    > = {};
    for (const [id, system] of this.registry) {
      const state = system.serialize();
      systems[id] = {
        state,
        hash: system.hash(),
      };
    }

    return {
      tick,
      timestamp: Date.now(),
      systems,
      snapshotHash: "",
    };
  }

  /**
   * Dispose the orchestrator, releasing all resources.
   *
   * Before clearing the registry, calls `serialize()` on every registered
   * system one final time (for potential recovery/graceful shutdown).
   *
   * **Idempotent** — calling `dispose()` multiple times is safe (no-op after
   * the first call). After disposal the orchestrator cannot be re-initialised.
   */
  dispose(): void {
    if (this.state === "Disposed") {
      return; // idempotent
    }

    // Final serialization on all registered systems before clearing
    for (const system of this.registry.values()) {
      system.serialize();
    }

    this.registry.clear();
    this.state = "Disposed";
  }
}
