import { isValidClassicAddress } from "xrpl";

export const XRPL_NETWORKS = ["mainnet", "testnet", "devnet"] as const;

export type XrplNetwork = (typeof XRPL_NETWORKS)[number];

export interface XrpAsset {
  readonly type: "xrp";
}

export interface IssuedAsset {
  readonly type: "issued";
  readonly issuer: string;
  readonly currency: string;
}

export type Asset = IssuedAsset | XrpAsset;

export interface TokenTuple {
  readonly network: XrplNetwork;
  readonly issuer: string;
  readonly currency: string;
}

const STANDARD_CURRENCY_PATTERN = /^[!-~]{3}$/;
const HEX_CURRENCY_PATTERN = /^[0-9A-Fa-f]{40}$/;
const ZERO_HEX_CURRENCY_PATTERN = /^0{40}$/;

export function isIssuedCurrency(currency: string): boolean {
  if (currency.toUpperCase() === "XRP") {
    return false;
  }

  if (HEX_CURRENCY_PATTERN.test(currency)) {
    return !ZERO_HEX_CURRENCY_PATTERN.test(currency);
  }

  return STANDARD_CURRENCY_PATTERN.test(currency);
}

export function isClassicAddress(address: string): boolean {
  return isValidClassicAddress(address);
}

export function canonicalTokenKey(token: TokenTuple): string {
  return `${token.network}:${token.issuer}:${token.currency}`;
}

export function issuedAssetsEqual(left: IssuedAsset, right: IssuedAsset): boolean {
  return left.issuer === right.issuer && left.currency === right.currency;
}
