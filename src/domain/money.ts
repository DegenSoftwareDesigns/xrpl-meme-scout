import { Decimal } from "decimal.js";

declare const decimalStringBrand: unique symbol;

export type DecimalString = string & { readonly [decimalStringBrand]: true };

const INTEGER_PATTERN = /^-?(?:0|[1-9]\d*)$/;
const PreciseDecimal = Decimal.clone({ precision: 100 });

export function toCanonicalDecimal(value: string): DecimalString {
  const decimal = new PreciseDecimal(value);

  if (!decimal.isFinite()) {
    throw new Error("Monetary values must be finite decimals.");
  }

  return decimal.toFixed() as DecimalString;
}

export function dropsToXrp(drops: string): DecimalString {
  if (!INTEGER_PATTERN.test(drops)) {
    throw new Error("Drops must be represented as an integer string.");
  }

  return new PreciseDecimal(drops).dividedBy(1_000_000).toFixed() as DecimalString;
}

export function xrpToDrops(xrp: string): string {
  const drops = new PreciseDecimal(xrp).times(1_000_000);

  if (!drops.isInteger()) {
    throw new Error("XRP values must resolve to a whole number of drops.");
  }

  return drops.toFixed(0);
}
