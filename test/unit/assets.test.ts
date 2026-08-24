import { describe, expect, it } from "vitest";

import {
  canonicalTokenKey,
  isClassicAddress,
  isIssuedCurrency,
  issuedAssetsEqual,
} from "../../src/domain/assets.js";

const ISSUER = "rszenFJoDdiGjyezQc8pME9KWDQH43Tswh";
const DROP_CURRENCY = "44524F5000000000000000000000000000000000";

describe("XRPL asset identity", () => {
  it("uses the exact network, issuer, and currency tuple", () => {
    expect(canonicalTokenKey({ network: "mainnet", issuer: ISSUER, currency: DROP_CURRENCY })).toBe(
      `mainnet:${ISSUER}:${DROP_CURRENCY}`,
    );
  });

  it("preserves and validates hexadecimal issued currencies", () => {
    expect(isIssuedCurrency(DROP_CURRENCY)).toBe(true);
    expect(isIssuedCurrency(DROP_CURRENCY.toLowerCase())).toBe(true);
    expect(isIssuedCurrency("USD")).toBe(true);
    expect(isIssuedCurrency("XRP")).toBe(false);
    expect(isIssuedCurrency("0000000000000000000000000000000000000000")).toBe(false);
    expect(isIssuedCurrency("too-long-for-a-standard-code")).toBe(false);
  });

  it("delegates classic address validation to xrpl.js", () => {
    expect(isClassicAddress(ISSUER)).toBe(true);
    expect(isClassicAddress("rNotARealAddress")).toBe(false);
  });

  it("compares issued assets without display symbols", () => {
    const drop = { type: "issued" as const, issuer: ISSUER, currency: DROP_CURRENCY };
    expect(issuedAssetsEqual(drop, { ...drop })).toBe(true);
    expect(issuedAssetsEqual(drop, { ...drop, currency: "USD" })).toBe(false);
  });
});
