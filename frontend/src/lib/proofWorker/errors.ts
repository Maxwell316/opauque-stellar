export class ProofGenerationCancelledError extends Error {
  constructor(message = "Proof generation was cancelled.") {
    super(message);
    this.name = "ProofGenerationCancelledError";
  }
}

const MEMORY_ERROR_PATTERN =
  /out of memory|allocation failed|cannot enlarge memory|memory access out of bounds|array buffer allocation failed|reached wasm memory limit/i;

const ARTIFACT_ERROR_PATTERN =
  /fetch|404|networkerror|failed to load/i;

/**
 * Map raw worker / snarkjs errors to user-facing messages.
 */
export function formatProofWorkerError(raw: string): string {
  if (MEMORY_ERROR_PATTERN.test(raw)) {
    return (
      "Proof generation ran out of memory. Close other browser tabs and try again, " +
      "or use a device with more available RAM."
    );
  }
  if (ARTIFACT_ERROR_PATTERN.test(raw)) {
    return (
      "Circuit files could not be loaded. Ensure circuit artifacts are present in " +
      "frontend/public/circuits/ and refresh the page."
    );
  }
  return raw || "An unknown error occurred during proof generation.";
}
