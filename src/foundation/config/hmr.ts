import type { ConfigManager } from "./configManager";

/**
 * Minimal hot context interface matching Vite's `import.meta.hot`.
 * Defined inline to keep Foundation layer zero-dependency.
 */
interface HotContext {
  accept(cb: () => void): void;
}

/**
 * Wire a config module's namespace to Vite HMR.
 *
 * Call this in the module scope of each config file at
 * `src/config/NAMESPACE.ts`. In production builds, Vite
 * dead-code eliminates the `import.meta.hot` block.
 *
 * @param cm - ConfigManager instance
 * @param namespace - Namespace to invalidate on HMR
 * @param hot - Optional hot context override (for testing).
 *   Defaults to `import.meta.hot` when omitted.
 *
 * @example
 * ```typescript
 * // src/config/teams.ts
 * import { cm } from "./singleton";
 * import { wireConfigHmr } from "../foundation/config/hmr";
 *
 * cm.register("teams", { macklen: { motor: 250 } });
 * wireConfigHmr(cm, "teams");
 * ```
 */
export function wireConfigHmr(
  cm: ConfigManager,
  namespace: string,
  hot?: HotContext | undefined
): void {
  const ctx = hot ?? import.meta.hot;
  if (ctx) {
    ctx.accept(() => {
      cm.invalidateNamespace(namespace);
    });
  }
}
