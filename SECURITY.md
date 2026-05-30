# Security Policy

## Reporting a vulnerability

**Please do not** open public GitHub issues for security vulnerabilities.

Report them through a **[private GitHub security advisory](https://github.com/collinsadi/opaque/security/advisories/new)** on this repository.

We aim to acknowledge security reports within **5 business days**.

## Reporting abuse or sanctions concerns

Open a **[GitHub issue](https://github.com/collinsadi/opaque/issues)** with a clear title (for example, `Abuse report:` or `Sanctions concern:`) and enough detail for us to investigate. Do not include sensitive personal data in public issues when a private advisory is more appropriate.

The reference wallet also surfaces an in-app summary at `/abuse-policy` (see `frontend/src/components/AbusePolicyPage.tsx`).

## Supported versions

Security fixes are applied to the latest code on the `main` branch. When we tag a release, notes appear on the [GitHub Releases](https://github.com/collinsadi/opaque/releases) page.

## Scope

- Soroban contracts in `contracts/`
- Reference frontend in `frontend/`
- Scanner WASM in `scanner/`
- Deployment manifests and CI verification scripts

Out of scope: third-party wallets, Stellar network consensus, and self-hosted forks unless they use official deployment credentials we operate.
