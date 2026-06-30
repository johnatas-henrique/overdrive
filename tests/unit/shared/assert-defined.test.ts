import { describe, expect, it } from "vitest";
import { defined } from "../../../src/shared/assert-defined";

describe("defined()", () => {
  it("should not throw for non-null values", () => {
    expect(() => defined("hello")).not.toThrow();
    expect(() => defined(0)).not.toThrow();
    expect(() => defined(false)).not.toThrow();
    expect(() => defined("")).not.toThrow();
  });

  it("should throw for null", () => {
    expect(() => defined(null)).toThrow("Expected non-null value");
  });

  it("should throw for undefined", () => {
    expect(() => defined(undefined)).toThrow("Expected non-null value");
  });

  it("should use custom message", () => {
    expect(() => defined(null, "custom msg")).toThrow("custom msg");
  });
});
