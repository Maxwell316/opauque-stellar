/**
 * ContractCostEstimator — Simulates a Soroban contract call and shows
 * the estimated resource fee BEFORE the user signs with Freighter.
 *
 * Supported methods: attest, verify (per acceptance criteria).
 */

import { useEffect, useState } from "react";
import { rpc, TransactionBuilder, Networks, BASE_FEE, Account } from "@stellar/stellar-sdk";
import { type SimulationResult, simulateAndDecode } from "../lib/sorobanErrors";

export interface ContractCostEstimatorProps {
  contractId: string;
  method: string;
  args: unknown[];
  rpcUrl: string;
  network: string;
}

type EstimateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; resourceFeeXLM: string; resourceFeeStroops: string; networkFeeXLM: string; totalXLM: string }
  | { status: "error"; message: string };

const STROOPS_PER_XLM = 10_000_000;

function stroopsToXLM(stroops: string | number): string {
  const n = typeof stroops === "string" ? parseFloat(stroops) : stroops;
  return (n / STROOPS_PER_XLM).toFixed(7);
}

function xlmToStroops(xlm: string): string {
  const n = parseFloat(xlm);
  return Math.round(n * STROOPS_PER_XLM).toString();
}

// Dummy source account used only for simulation — no real keypair needed.
const SIMULATION_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

export function ContractCostEstimator({
  contractId,
  method,
  args,
  rpcUrl,
  network,
}: ContractCostEstimatorProps) {
  const [state, setState] = useState<EstimateState>({ status: "idle" });

  useEffect(() => {
    if (!contractId || !method || !rpcUrl) return;

    let cancelled = false;

    const run = async () => {
      setState({ status: "loading" });

      try {
        const server = new rpc.Server(rpcUrl, {
          allowHttp: rpcUrl.startsWith("http://"),
        });

        // Resolve passphrase from network string
        const passphrase =
          network === "mainnet"
            ? Networks.PUBLIC
            : network === "testnet"
            ? Networks.TESTNET
            : network === "futurenet"
            ? Networks.FUTURENET
            : network; // allow raw passphrase

        // Build a dummy transaction envelope for simulation
        const sourceAccount = new Account(SIMULATION_SOURCE, "0");
        const txBuilder = new TransactionBuilder(sourceAccount, {
          fee: BASE_FEE,
          networkPassphrase: passphrase,
        });

        // Dynamically construct contract call operation
        const { Contract, nativeToScVal } = await import("@stellar/stellar-sdk");
        const contract = new Contract(contractId);

        const scArgs = args.map((a) => {
          if (typeof a === "string") return nativeToScVal(a, { type: "string" });
          if (typeof a === "number" || typeof a === "bigint") return nativeToScVal(a);
          if (a instanceof Uint8Array) return nativeToScVal(a, { type: "bytes" });
          return nativeToScVal(a);
        });

        txBuilder.addOperation(contract.call(method, ...scArgs));
        txBuilder.setTimeout(30);

        const tx = txBuilder.build();

        const result: SimulationResult = await simulateAndDecode(server, tx);

        if (cancelled) return;

        if (result.success && result.estimatedFee != null) {
          // estimatedFee is already in XLM from extractEstimatedFee
          const resourceFeeXLM = result.estimatedFee;
          const resourceFeeStroops = xlmToStroops(resourceFeeXLM);
          // Network (base) fee is BASE_FEE stroops = 100 stroops
          const networkFeeXLM = stroopsToXLM(parseInt(BASE_FEE, 10));
          const totalXLM = (
            parseFloat(resourceFeeXLM) + parseFloat(networkFeeXLM)
          ).toFixed(7);

          setState({
            status: "success",
            resourceFeeXLM,
            resourceFeeStroops,
            networkFeeXLM,
            totalXLM,
          });
        } else {
          setState({
            status: "error",
            message:
              result.error ??
              "Could not estimate — check contract ID and args",
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not estimate — check contract ID and args",
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [contractId, method, rpcUrl, network, JSON.stringify(args)]);

  if (state.status === "idle") return null;

  if (state.status === "loading") {
    return (
      <div
        className="flex items-center gap-2 text-xs text-mist py-2"
        aria-live="polite"
        aria-label="Estimating fees"
      >
        <span
          className="h-3.5 w-3.5 animate-spin rounded-full border border-ink-600 border-t-white"
          aria-hidden
        />
        Estimating fees…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-300"
        role="alert"
      >
        <span className="font-medium">Could not estimate fee</span>
        {state.message ? (
          <span className="block mt-0.5 text-amber-300/70">{state.message}</span>
        ) : null}
      </div>
    );
  }

  // success
  return (
    <div
      className="rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2.5 text-xs text-mist space-y-1"
      aria-label="Fee estimate"
    >
      <div className="font-medium text-white text-[11px] uppercase tracking-wide mb-1.5">
        Estimated Fees
      </div>
      <div className="flex justify-between">
        <span>Resource fee</span>
        <span className="text-white">
          {state.resourceFeeXLM} XLM
          <span className="text-mist/60 ml-1">({state.resourceFeeStroops} stroops)</span>
        </span>
      </div>
      <div className="flex justify-between">
        <span>Network fee</span>
        <span className="text-white">{state.networkFeeXLM} XLM</span>
      </div>
      <div className="flex justify-between border-t border-ink-700 pt-1 mt-1 font-medium">
        <span>Total estimated</span>
        <span className="text-white">{state.totalXLM} XLM</span>
      </div>
    </div>
  );
}
