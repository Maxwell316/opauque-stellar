# Deployments

**This folder is the on-chain address book for Opaque Stellar.**

When you run `npm run deploy:testnet`, the deploy script writes every Soroban contract ID, WASM hash, and network URL into `v1/testnet.json` (or `mainnet.json`). The frontend reads that file at build time — no hardcoded addresses in source code.

| File | Purpose |
|------|---------|
| `v1/testnet.json` | Testnet contract IDs + artifact hashes |
| `v1/mainnet.json` | Mainnet record (requires audit signoff to deploy) |
| `v1/<network>.previous.json` | Last known-good deployment used by rollback automation |
| `v1/<network>.previous.example.json` | Template for creating a previous deployment record |
| `v1/rpc-health.json` | Primary/fallback Horizon + Soroban RPC probe config |
| `manifest.schema.json` | JSON schema CI validates against |
| `security/mainnet-audit-findings.json` | Mainnet deploy gate (blocking findings) |

After deploying, commit the updated manifest so CI and other developers stay in sync.

Before editing an active manifest, copy the current known-good deployment to
`deployments/v1/<network>.previous.json`. That file is the rollback source of
truth if a bad deploy needs to be restored quickly.

## Endpoint Health

Run the same probe used by the scheduled GitHub Action:

```bash
npm run health:rpc
node scripts/probe-horizon-rpc.mjs --network testnet
```

The probe checks primary and fallback Horizon/RPC URLs from `v1/rpc-health.json`,
emits structured JSON logs with latency and errors, and posts the failure summary
to `OPS_ALERT_WEBHOOK_URL` when configured.

## Rollback

Use rollback only when the active deployment is breaking users and restoring the
previous manifest is safer than a forward fix:

```bash
cp deployments/v1/testnet.previous.example.json deployments/v1/testnet.previous.json
node scripts/rollback-deployment.mjs --network testnet --dry-run
node scripts/rollback-deployment.mjs --network testnet --execute --smoke
```

See `docs/runbooks/deployment-rollback.md` for the decision tree, dry-run output,
and post-rollback smoke-test checklist.
