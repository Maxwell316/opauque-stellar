/**
 * proofWorker error formatting tests.
 */

import { describe, it, expect } from "vitest";
import {
  formatProofWorkerError,
  ProofGenerationCancelledError,
} from "../errors";

describe("formatProofWorkerError", () => {
  it("maps WASM memory errors to a user-friendly message", () => {
    const out = formatProofWorkerError("WebAssembly.RuntimeError: memory access out of bounds");
    expect(out).toContain("ran out of memory");
  });

  it("maps allocation failures to a user-friendly message", () => {
    const out = formatProofWorkerError("RangeError: Array buffer allocation failed");
    expect(out).toContain("ran out of memory");
  });

  it("maps circuit fetch failures to a user-friendly message", () => {
    const out = formatProofWorkerError("Failed to load /circuits/sa_final.zkey (404)");
    expect(out).toContain("Circuit files could not be loaded");
  });

  it("passes through other errors unchanged", () => {
    const msg = "Generated proof is invalid (is_valid=0).";
    expect(formatProofWorkerError(msg)).toBe(msg);
  });

  it("handles empty input", () => {
    expect(formatProofWorkerError("")).toContain("unknown error");
  });
});

describe("ProofGenerationCancelledError", () => {
  it("has a stable name for instanceof checks", () => {
    const err = new ProofGenerationCancelledError();
    expect(err.name).toBe("ProofGenerationCancelledError");
    expect(err.message).toContain("cancelled");
  });
});
