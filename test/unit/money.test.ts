import { describe, expect, it } from "vitest";

import { dropsToXrp, toCanonicalDecimal, xrpToDrops } from "../../src/domain/money.js";

describe("decimal-safe money helpers", () => {
  it("converts drops without binary floating-point loss", () => {
    expect(dropsToXrp("1")).toBe("0.000001");
    expect(dropsToXrp("123456789012345678901234")).toBe("123456789012345678.901234");
    expect(xrpToDrops("123456789012345678.901234")).toBe("123456789012345678901234");
  });

  it("canonicalizes decimal strings without rounding", () => {
    expect(toCanonicalDecimal("00012.3400")).toBe("12.34");
    expect(toCanonicalDecimal("1e-30")).toBe("0.000000000000000000000000000001");
  });

  it("rejects non-integer drops and sub-drop XRP values", () => {
    expect(() => dropsToXrp("1.5")).toThrow("integer string");
    expect(() => xrpToDrops("0.0000001")).toThrow("whole number of drops");
    expect(() => toCanonicalDecimal("Infinity")).toThrow("finite decimals");
  });
});
