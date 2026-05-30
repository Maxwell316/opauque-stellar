/**
 * Stealth Meta-Address Registry — resolve meta-address by Stellar account via Soroban.
 */

import { BASE_FEE, Contract, TransactionBuilder, nativeToScVal } from "@stellar/stellar-sdk";
import { REGISTRY_CONTRACT_ID, SCHEME_ID_SECP256K1 } from "./contracts";
import { getNetworkPassphrase } from "./chain";
import type { Hex } from "./stealth";
import { bytesToHex } from "./stealth";
import { getSorobanServer, u64ToScVal } from "./stellar";

/**
 * Resolves a Stellar account (G…) to its 66-byte stealth meta-address via the registry contract.
 */
export async function resolveMetaAddress(address: string): Promise<Hex | null> {
  try {
    const server = getSorobanServer();
    const passphrase = getNetworkPassphrase();
    const source = await server.getAccount(address);
    const contract = new Contract(REGISTRY_CONTRACT_ID);
    let tx = new TransactionBuilder(source, {
      fee: BASE_FEE,
      networkPassphrase: passphrase,
    })
      .addOperation(
        contract.call(
          "resolve",
          nativeToScVal(address, { type: "address" }),
          u64ToScVal(SCHEME_ID_SECP256K1),
        ),
      )
      .setTimeout(30)
      .build();
    tx = await server.prepareTransaction(tx);
    const sim = await server.simulateTransaction(tx);
    if (!("result" in sim) || !sim.result) return null;
    const retval = sim.result.retval;
    if (!retval) return null;
    const bytes = scValToBytes(retval);
    if (!bytes || bytes.length !== 66) return null;
    return ("0x" + bytesToHex(bytes)) as Hex;
  } catch {
    return null;
  }
}

function scValToBytes(val: unknown): Uint8Array | null {
  try {
    const v = val as { switch?: () => number; bytes?: () => Buffer };
    if (v.bytes) return Uint8Array.from(v.bytes());
  } catch {
    /* ignore */
  }
  return null;
}

export async function isRegistered(address: string): Promise<boolean> {
  const meta = await resolveMetaAddress(address);
  return meta != null && meta.length === 2 + 66 * 2;
}

export function getRegistryContractId(): string {
  return REGISTRY_CONTRACT_ID;
}
