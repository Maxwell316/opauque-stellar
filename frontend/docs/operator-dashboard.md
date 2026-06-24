# Operator Dashboard

The `/operator` route exposes a protocol health dashboard restricted to authenticated operators.

## Configuration

Set the `VITE_OPERATOR_SECRET` environment variable at build time:

```bash
VITE_OPERATOR_SECRET=your-secret-here npm run build
```

The operator visits `/operator`, enters the secret in the auth form, and the value is stored in `localStorage` under the key `opauque_operator_secret`. Subsequent visits within the same browser skip the auth form.

> **Warning:** Because `VITE_OPERATOR_SECRET` is embedded in the client bundle at build time, it is visible to anyone who inspects the JavaScript. Do not use this for high-security access control. Its purpose is to prevent casual access, not to protect against a determined adversary who already has the built assets. For production deployments, serve the `/operator` route behind a reverse-proxy or VPN instead.

## Metrics shown

| Metric | Source |
|--------|--------|
| Announcements (24 h) | `ProtocolLogContext` entries with `source === "blockchain"` or message containing "announce" |
| Indexer lag | Simulated (0–5 ledgers). Replace `useMockIndexerLag` in `OperatorDashboard.tsx` with a real API call when an indexer health endpoint is available. |
| Proofs verified (24 h) | `ProtocolLogContext` entries mentioning "proof" |

## Connecting a real indexer

Replace the `useMockIndexerLag` hook body in `frontend/src/components/OperatorDashboard.tsx` with a fetch to your indexer's `/health` or `/status` endpoint:

```ts
const update = async () => {
  const res = await fetch("https://your-indexer/status");
  const json = await res.json();
  setLag(json.ledgersBehind ?? 0);
};
```

## Signing out

Click "Sign out of operator view" at the bottom of the dashboard. This removes the secret from `localStorage` and returns to the auth gate.
