/**
 * Soroban contract IDs for Opaque programs.
 */

import { deployedAddresses } from "./deployedAddresses";

export type OpaqueProgramName =
  | "StealthAnnouncer"
  | "StealthRegistry"
  | "Groth16Verifier"
  | "ReputationVerifier"
  | "SchemaRegistry"
  | "AttestationEngineV2";

const programIds: Record<OpaqueProgramName, string> = {
  StealthAnnouncer: deployedAddresses.stealthAnnouncer,
  StealthRegistry: deployedAddresses.stealthRegistry,
  Groth16Verifier: deployedAddresses.groth16Verifier,
  ReputationVerifier: deployedAddresses.reputationVerifier,
  SchemaRegistry: deployedAddresses.schemaRegistry,
  AttestationEngineV2: deployedAddresses.attestationEngineV2,
};

export function getProgramId(name: OpaqueProgramName): string {
  return programIds[name];
}
