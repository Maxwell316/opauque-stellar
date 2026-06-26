import { parseHorizonBalanceToStroops } from "./decimalParser";

export function balanceLineToAssetKey(balance: {
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
}): string | null {
  if (balance.asset_type === "native") return null;
  const code = balance.asset_code?.trim();
  const issuer = balance.asset_issuer?.trim();
  if (!code || !issuer) return null;
  return `${code}:${issuer}`;
}

export function horizonTrustlineBalancesToStroops(
  balances: Array<{
    asset_type?: string;
    asset_code?: string;
    asset_issuer?: string;
    balance?: string;
  }>,
): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  for (const balance of balances) {
    const key = balanceLineToAssetKey(balance);
    if (!key) continue;
    const amount = parseHorizonBalanceToStroops(balance.balance);
    if (amount > 0n) out[key] = amount;
  }
  return out;
}
