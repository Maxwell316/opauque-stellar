import { describe, expect, it } from "vitest";
import {
  balanceLineToAssetKey,
  horizonTrustlineBalancesToStroops,
} from "../stellarBalances";

describe("stellarBalances", () => {
  it("skips native balances and keys trustlines by code and issuer", () => {
    expect(balanceLineToAssetKey({ asset_type: "native" })).toBeNull();
    expect(
      balanceLineToAssetKey({
        asset_type: "credit_alphanum4",
        asset_code: "USDC",
        asset_issuer: "GISSUER",
      }),
    ).toBe("USDC:GISSUER");
  });

  it("converts positive trustline balances to stroops", () => {
    expect(
      horizonTrustlineBalancesToStroops([
        { asset_type: "native", balance: "12.0000000" },
        {
          asset_type: "credit_alphanum4",
          asset_code: "USDC",
          asset_issuer: "GISSUER",
          balance: "5.2500000",
        },
        {
          asset_type: "credit_alphanum12",
          asset_code: "CUSTOM",
          asset_issuer: "GCUSTOM",
          balance: "0.0000000",
        },
      ]),
    ).toEqual({ "USDC:GISSUER": 52_500_000n });
  });
});
