import { bytesToBigInt } from "./fieldUtils";
import type { V1WitnessParams } from "./types";

const TREE_DEPTH = 20;

export async function buildV1Witness(params: V1WitnessParams): Promise<Record<string, unknown>> {
  const circomlib = await import("circomlibjs");
  const poseidon = await circomlib.buildPoseidon();
  const babyjub = await circomlib.buildBabyjub();
  const F = poseidon.F;

  const attestationId = BigInt(params.traitAttestationId);
  const extNullifier = BigInt(params.externalNullifier);
  const stealthPrivKeyBytes = new Uint8Array(params.stealthPrivKeyBytes);

  const stealthPriv = F.toObject(F.e(bytesToBigInt(stealthPrivKeyBytes)));
  const ephemeralPriv = F.toObject(F.e(stealthPriv + extNullifier + 1n));
  const stealthPub = babyjub.mulPointEscalar(babyjub.Base8, stealthPriv);
  const ephemeralPub = babyjub.mulPointEscalar(babyjub.Base8, ephemeralPriv);
  const sharedSecret = babyjub.mulPointEscalar(ephemeralPub, stealthPriv);

  const stealthPubX = F.toObject(stealthPub[0]);
  const stealthPubY = F.toObject(stealthPub[1]);
  const ephemeralPubX = F.toObject(ephemeralPub[0]);
  const ephemeralPubY = F.toObject(ephemeralPub[1]);
  const sharedX = F.toObject(sharedSecret[0]);
  const sharedY = F.toObject(sharedSecret[1]);

  const addressCommitment = F.toObject(poseidon([sharedX, sharedY, stealthPubX, stealthPubY]));
  const leaf = F.toObject(poseidon([addressCommitment, attestationId]));

  const zeroHashes: bigint[] = [];
  zeroHashes.push(F.toObject(poseidon([0n, 0n])));
  for (let i = 1; i < TREE_DEPTH; i++) {
    zeroHashes.push(F.toObject(poseidon([zeroHashes[i - 1], zeroHashes[i - 1]])));
  }

  const merklePathElements: string[] = [];
  const merklePathIndices: number[] = [];
  let current = leaf;
  for (let i = 0; i < TREE_DEPTH; i++) {
    merklePathElements.push(zeroHashes[i].toString());
    merklePathIndices.push(0);
    current = F.toObject(poseidon([current, zeroHashes[i]]));
  }

  return {
    merkle_root: current.toString(),
    attestation_id: attestationId.toString(),
    external_nullifier: extNullifier.toString(),
    stealth_private_key: stealthPriv.toString(),
    ephemeral_pubkey: [ephemeralPubX.toString(), ephemeralPubY.toString()],
    announcement_attestation_id: attestationId.toString(),
    merkle_path_elements: merklePathElements,
    merkle_path_indices: merklePathIndices,
  };
}
