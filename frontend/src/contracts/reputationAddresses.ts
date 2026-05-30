/**
 * Reputation / Groth16 program IDs (must match `deployedAddresses` on-chain targets).
 * Replace after deploy; strings must be valid Stellar contract IDs (C…) or accounts (G…).
 */

import { deployedAddresses } from "./deployedAddresses";

export const reputationAddresses = {
  network: deployedAddresses.network,
  /** @deprecated */
  cluster: deployedAddresses.network,
  groth16Verifier: deployedAddresses.groth16Verifier,
  reputationVerifier: deployedAddresses.reputationVerifier,
  admin: "" as const,
} as const;

export type ReputationAddresses = typeof reputationAddresses;
