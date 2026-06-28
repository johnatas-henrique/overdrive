import type { SnapshotRestoreResult } from "./snapshot-error";
import { SnapshotError } from "./snapshot-error";
import type { ISnapshotable } from "./types";

// ---------------------------------------------------------------------------
// ISimulationSnapshot — public contract for the snapshot orchestrator
// ---------------------------------------------------------------------------

/**
 * Public interface for the simulation snapshot orchestrator.
 *
 * Defines the contract that consumers (Dev Tools, replay system, multiplayer
 * sync) use to register systems, capture snapshots, restore state, and query
 * registered systems and their hashes.
 *
 * @see TR-SSN-001 through TR-SSN-007
 * @see ADR-0017 — Simulation Snapshot
 * @see Control Manifest F33-F36
 */
export interface ISimulationSnapshot {
  /** Transition from Uninitialized to Ready state. */
  init(): void;

  /**
   * Register a system for snapshot participation.
   * @throws {SnapshotError} If systemId is already registered.
   */
  register(system: ISnapshotable): void;

  /**
   * Capture a full-game snapshot (with frequency check).
   * @returns The snapshot, or `null` if frequency condition is not met.
   */
  takeSnapshot(tick: number): FullGameSnapshot | null;

  /**
   * Capture a full-game snapshot (with options for on-demand).
   * @returns The snapshot, or `null` if frequency condition is not met
   *   and `force` is not `true`.
   */
  takeSnapshot(options: TakeSnapshotOptions): FullGameSnapshot | null;

  /**
   * Restore a full-game snapshot, returning per-system outcomes.
   */
  restoreSnapshot(snapshot: FullGameSnapshot): SnapshotRestoreResult;

  /**
   * Return all registered systems as a read-only array.
   * @throws {SnapshotError} If called before `init()` or after `dispose()`.
   */
  getRegisteredSystems(): ReadonlyArray<ISnapshotable>;

  /**
   * Return the current hash per systemId by calling each system's `hash()`.
   * @throws {SnapshotError} If called before `init()` or after `dispose()`.
   */
  getHashes(): Map<string, string>;

  /** Dispose the orchestrator, releasing all resources. */
  dispose(): void;
}

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
   * twice) throws {@link SnapshotError} — the check happens **before**
   * modifying the registry, ensuring no partial state.
   *
   * @param system - The system to register.
   * @throws {SnapshotError} If called before `init()` or after `dispose()`.
   * @throws {SnapshotError} If `system.systemId` is already registered.
   */
  register(system: ISnapshotable): void {
    if (this.state !== "Ready") {
      throw new SnapshotError("Not initialized");
    }
    if (this.registry.has(system.systemId)) {
      throw new SnapshotError(
        `System already registered: ${system.systemId}`,
        system.systemId,
        "SNAPSHOT_DUPLICATE_REGISTRATION"
      );
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
   * @remarks The caller guarantees this is called at fixed game loop points
   * after all systems have completed their update for the tick. Calling during
   * a system update may produce inconsistent state.
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
   * Restore a full-game snapshot, deserializing all registered systems.
   *
   * Iterates over the snapshot's `systems` map and calls `deserialize()`
   * on each matching registered system. Systems present in the snapshot
   * but not registered in this orchestrator are silently skipped (with a
   * warning logged). Systems registered but absent from the snapshot are
   * left unchanged. If a system's `deserialize()` throws, the error is
   * caught and logged — other systems continue to restore normally.
   *
   * @remarks The caller guarantees this is called at fixed game loop points
   * after all systems have completed their update for the tick. Calling during
   * a system update may produce inconsistent state.
   *
   * @param snapshot — The snapshot to restore from.
   * @returns A {@link SnapshotRestoreResult} describing per-system outcomes.
   * @throws {SnapshotError} If called before `init()` or after `dispose()`.
   */
  restoreSnapshot(snapshot: FullGameSnapshot): SnapshotRestoreResult {
    if (this.state !== "Ready") {
      throw new SnapshotError("Not initialized");
    }

    const result: SnapshotRestoreResult = { succeeded: [], failed: [] };

    for (const [systemId, systemData] of Object.entries(snapshot.systems)) {
      const system = this.registry.get(systemId);
      if (!system) {
        console.warn(
          `[Snapshot] System "${systemId}" found in snapshot but not in registry — skipping`
        );
        continue;
      }
      try {
        system.deserialize(systemData.state);
        result.succeeded.push(systemId);
      } catch (e) {
        const error = e instanceof Error ? e : new Error(String(e));
        console.warn(
          `[Snapshot] System "${systemId}" failed to deserialize: ${error.message}`
        );
        result.failed.push({ systemId, error });
      }
    }

    return result;
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

    // Final serialization on all registered systems before clearing.
    // Each system is isolated — a failure in one does not prevent
    // others from running, and registry.clear() always executes.
    for (const system of this.registry.values()) {
      try {
        system.serialize();
      } catch (error) {
        console.warn(
          `[Snapshot] System "${system.systemId}" failed to serialize during dispose: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    this.registry.clear();
    this.state = "Disposed";
  }

  /**
   * Return all registered systems as a read-only array.
   *
   * Provides a snapshot of the registry at the time of the call — the returned
   * array is a shallow copy; systems themselves are live references (their
   * state mutates as the simulation advances).
   *
   * @returns A read-only array of all registered {@link ISnapshotable} systems.
   * @throws {SnapshotError} If called before `init()` or after `dispose()`.
   *
   * @example
   * ```typescript
   * const systems = snapshot.getRegisteredSystems();
   * for (const sys of systems) {
   *   console.log(sys.systemId, sys.hash());
   * }
   * ```
   */
  getRegisteredSystems(): ReadonlyArray<ISnapshotable> {
    if (this.state !== "Ready") {
      throw new SnapshotError("Not initialized");
    }
    return Array.from(this.registry.values());
  }

  /**
   * Return the current FNV-1a hash per systemId.
   *
   * Calls each registered system's `hash()` method and collects the results
   * into a new `Map<string, string>`. The map is a fresh copy each call.
   *
   * @returns A map of `systemId → current hash string` for every registered
   *   system.
   * @throws {SnapshotError} If called before `init()` or after `dispose()`.
   *
   * @example
   * ```typescript
   * const hashes = snapshot.getHashes();
   * for (const [id, hash] of hashes) {
   *   console.log(`${id}: ${hash}`);
   * }
   * ```
   */
  getHashes(): Map<string, string> {
    if (this.state !== "Ready") {
      throw new SnapshotError("Not initialized");
    }
    const hashes = new Map<string, string>();
    for (const [id, system] of this.registry) {
      hashes.set(id, system.hash());
    }
    return hashes;
  }
}
