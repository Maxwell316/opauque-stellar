import { buildPoseidon } from "circomlibjs";
import { bytesToFieldBigInt, stringToBigInt } from "./fieldUtils";
import type { V2WitnessParams } from "./types";

const MERKLE_DEPTH = 20;

export async function buildV2Witness(params: V2WitnessParams): Promise<Record<string, unknown>> {
  const stealthPrivKeyBytes = new Uint8Array(params.stealthPrivKeyBytes);
  const stealthPk = bytesToFieldBigInt(stealthPrivKeyBytes);

  const schemaId = stringToBigInt(params.schemaIdField);
  const issuerPkX = stringToBigInt(params.issuerPkX);
  const nonce = stringToBigInt(params.nonceField);
  const traitDataHash = 0n;
  const externalNullifier = stringToBigInt(params.externalNullifierStr.trim());

  const poseidon = await buildPoseidon();
  const F = poseidon.F;
  const ph = (inputs: bigint[]): bigint => F.toObject(poseidon(inputs)) as bigint;

  const leaf: bigint = ph([stealthPk, schemaId, issuerPkX, traitDataHash, nonce]);

  const zeroHashes: bigint[] = [0n];
  for (let i = 0; i < MERKLE_DEPTH; i++) {
    zeroHashes.push(ph([zeroHashes[i], zeroHashes[i]]));
  }

  const merklePath: bigint[] = [];
  const merklePathIndices: number[] = [];
  let current: bigint = leaf;
  for (let i = 0; i < MERKLE_DEPTH; i++) {
    merklePath.push(zeroHashes[i]);
    merklePathIndices.push(0);
    current = ph([current, zeroHashes[i]]);
  }
  const merkleRoot: bigint = current;
  const nullifierHash: bigint = ph([stealthPk, externalNullifier]);

  return {
    stealth_pk: stealthPk.toString(),
    schema_id: schemaId.toString(),
    issuer_pk_x: issuerPkX.toString(),
    trait_data_hash: traitDataHash.toString(),
    nonce: nonce.toString(),
    merkle_path: merklePath.map((h) => h.toString()),
    merkle_path_indices: merklePathIndices,
    merkle_root: merkleRoot.toString(),
    attestation_id: schemaId.toString(),
    external_nullifier: externalNullifier.toString(),
    nullifier_hash: nullifierHash.toString(),
  };
}
