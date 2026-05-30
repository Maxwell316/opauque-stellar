// @ts-nocheck
/**
 * One-command Soroban deployment for Opaque Stellar.
 *
 * Builds all six contracts, deploys them to the target network, records the
 * resulting contract IDs / WASM hashes / ledger into the canonical manifest at
 * `deployments/v1/<network>.json`, and leaves it in a strict-verifiable state.
 *
 * Configuration (via root `.env` — see `.env.example`):
 *   STELLAR_NETWORK           testnet | mainnet            (or --network <net>)
 *   STELLAR_DEPLOYER          stellar-cli identity name    (preferred)
 *   STELLAR_DEPLOYER_SECRET   raw secret seed (S...)       (alternative)
 *   STELLAR_DEPLOYER_ADDRESS  G... address for the record  (optional)
 *
 * Usage:
 *   npm run deploy:testnet
 *   npm run deploy:mainnet
 *   node scripts/deploy-contracts.mjs --network testnet --dry-run
 *   node scripts/deploy-contracts.mjs --network testnet --skip-build
 *
 * Flags:
 *   --network <testnet|mainnet>   target network (default: $STELLAR_NETWORK or testnet)
 *   --dry-run                     build + plan only; do not deploy or write IDs
 *   --skip-build                  reuse existing target/ WASM (skip `stellar contract build`)
 *   --force                       bypass the mainnet audit-signoff gate (NOT recommended)
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

/**
 * Minimal, dependency-free loader for the root `.env` so `npm run deploy:*` works
 * with nothing but a populated `.env` file. Existing process env vars win, so CI
 * secrets and inline `STELLAR_NETWORK=… npm run deploy` overrides are respected.
 */
function loadDotEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return;
  for (const raw of readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key || key in process.env) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadDotEnv();

/** Deploy order: dependency-free contracts first (order is cosmetic — none have constructors). */
const PACKAGES = [
  { key: "stealthRegistry", pkg: "stealth-registry", wasm: "stealth_registry" },
  { key: "stealthAnnouncer", pkg: "stealth-announcer", wasm: "stealth_announcer" },
  { key: "groth16Verifier", pkg: "groth16-verifier", wasm: "groth16_verifier" },
  { key: "reputationVerifier", pkg: "reputation-verifier", wasm: "reputation_verifier" },
  { key: "schemaRegistry", pkg: "schema-registry", wasm: "schema_registry" },
  { key: "attestationEngineV2", pkg: "attestation-engine-v2", wasm: "attestation_engine_v2" },
];

const STELLAR_CONTRACT_ID = /C[A-Z2-7]{55}/g;

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });
}

async function latestLedger(rpcUrl) {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestLedger" }),
    });
    const json = await res.json();
    return json?.result?.sequence ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const network = arg("network", process.env.STELLAR_NETWORK || "testnet");
  const dryRun = flag("dry-run");
  const skipBuild = flag("skip-build");
  const force = flag("force");

  if (network !== "testnet" && network !== "mainnet") {
    fail(`Unsupported network "${network}". Use testnet or mainnet.`);
  }

  // Identity: prefer a configured stellar-cli identity name, fall back to a raw secret.
  const identity = process.env.STELLAR_DEPLOYER?.trim();
  const secret = process.env.STELLAR_DEPLOYER_SECRET?.trim();
  const source = identity || secret;
  if (!dryRun && !source) {
    fail(
      "No deployer configured. Set STELLAR_DEPLOYER (identity name) or " +
        "STELLAR_DEPLOYER_SECRET (S... seed) in your .env. See .env.example.",
    );
  }

  // Mainnet safety gate: require security-audit signoff unless explicitly forced.
  if (network === "mainnet" && !force) {
    try {
      sh("node", ["scripts/verify-security-audit.ts", "--network", "mainnet"], { stdio: "inherit" });
    } catch {
      fail(
        "Mainnet audit signoff check failed. Resolve blocking findings (see " +
          "deployments/security/mainnet-audit-findings.json) or pass --force to override.",
      );
    }
  }

  const manifestPath = join(ROOT, "deployments", "v1", `${network}.json`);
  if (!existsSync(manifestPath)) fail(`Missing manifest: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  console.log(`\nOpaque Stellar deploy → ${network}${dryRun ? " (dry run)" : ""}\n`);

  if (!skipBuild) {
    console.log("• Building contracts (stellar contract build)…");
    sh("stellar", ["contract", "build"], { stdio: "inherit" });
  }

  // Resolve deployer G-address for the record (best effort).
  let deployerAddress = process.env.STELLAR_DEPLOYER_ADDRESS?.trim() || null;
  if (!deployerAddress && identity) {
    try {
      deployerAddress = sh("stellar", ["keys", "address", identity]).trim();
    } catch {
      /* leave null; record can be filled manually */
    }
  }

  for (const { key, pkg, wasm } of PACKAGES) {
    const wasmPath = join(ROOT, "target", "wasm32v1-none", "release", `${wasm}.wasm`);
    if (!existsSync(wasmPath)) {
      fail(`WASM not found: ${wasmPath} (run without --skip-build first).`);
    }
    const wasmHash = sha256File(wasmPath);

    if (dryRun) {
      console.log(`• [dry-run] ${pkg}  wasmHash=${wasmHash}`);
      manifest.contracts[key].wasmHash = wasmHash;
      continue;
    }

    console.log(`• Deploying ${pkg}…`);
    const out = sh("stellar", [
      "contract",
      "deploy",
      "--wasm",
      wasmPath,
      "--source-account",
      source,
      "--network",
      network,
    ]);
    const matches = out.match(STELLAR_CONTRACT_ID);
    const id = matches ? matches[matches.length - 1] : null;
    if (!id) fail(`Could not parse contract ID from deploy output:\n${out}`);

    manifest.contracts[key].id = id;
    manifest.contracts[key].wasmHash = wasmHash;
    console.log(`  ↳ ${id}`);
  }

  if (dryRun) {
    console.log("\nDry run complete. No contracts deployed, manifest not written.\n");
    return;
  }

  manifest.deployedAt = new Date().toISOString();
  manifest.deploymentLedger = await latestLedger(manifest.rpcUrl);
  if (deployerAddress) {
    manifest.deployer = deployerAddress;
    if (manifest.admin == null) manifest.admin = deployerAddress;
  }
  manifest.deploymentStatus = "deployed";

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`\n✓ Updated ${manifestPath}`);

  console.log(
    [
      "\nNext steps:",
      `  1. Verify:  node scripts/verify-deployment-manifest.mjs --network ${network} --strict --check-wasm`,
      `  2. Point the frontend at the new IDs (they are read from the manifest automatically),`,
      `     or set VITE_${network.toUpperCase()}_*_CONTRACT overrides for local dev.`,
      "  3. Commit the updated manifest.",
      "",
    ].join("\n"),
  );
}

main().catch((err) => fail(err?.message ?? String(err)));
