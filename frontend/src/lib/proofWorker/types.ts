/** Serializable V1 witness inputs sent to the proof worker. */
export interface V1WitnessParams {
  traitAttestationId: number;
  stealthPrivKeyBytes: number[];
  externalNullifier: string;
}

/** Serializable V2 circuit inputs sent to the proof worker. */
export interface V2WitnessParams {
  stealthPrivKeyBytes: number[];
  schemaIdField: string;
  issuerPkX: string;
  nonceField: string;
  externalNullifierStr: string;
}

export interface Groth16ProofResult {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  publicSignals: string[];
}

export type ProofWorkerStage = "preparing-witness" | "generating-proof";

export type WorkerRequest =
  | {
      id: string;
      type: "generate-v1";
      payload: V1WitnessParams;
    }
  | {
      id: string;
      type: "generate-v2";
      payload: V2WitnessParams;
    }
  | {
      id: string;
      type: "cancel";
    };

export type WorkerResponse =
  | {
      id: string;
      type: "progress";
      stage: ProofWorkerStage;
      percent: number;
    }
  | {
      id: string;
      type: "success";
      result: Groth16ProofResult;
    }
  | {
      id: string;
      type: "error";
      message: string;
    };
