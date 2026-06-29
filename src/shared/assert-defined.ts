/**
 * Assertion function — narrows a nullable value to non-null.
 *
 * Use instead of `if (!x) return;` guards to avoid dead branches.
 * TypeScript infers non-null after the assertion via `asserts` keyword.
 *
 * @param value  — The value to assert as defined
 * @param msg    — Optional custom error message (default: "Expected non-null value")
 *
 * @throws  Error  If `value` is `null` or `undefined`
 *
 * @example
 * ```typescript
 * defined(someNullable);
 * someNullable; // TypeScript now knows it's non-null
 * ```
 *
 * @see TypeScript 3.7 Assertion Functions
 */
export function defined<T>(
  value: T | null | undefined,
  msg?: string
): asserts value is NonNullable<T> {
  if (value == null) {
    throw new Error(msg ?? "Expected non-null value");
  }
}
