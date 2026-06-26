/**
 * In-app help links — recovery and protocol notes live in README.md on GitHub.
 */

const DEFAULT_REPO = "https://github.com/collinsadi/opauque-stellar/blob/main";

function docsBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_DOCS_BASE_URL as string | undefined;
  if (fromEnv?.trim()) return fromEnv.replace(/\/$/, "");
  return DEFAULT_REPO;
}

export type DocId =
  | "user-recovery"
  | "ghost-threat-model"
  | "payment-link-format"
  | "wasm-scanner-upgrade";

const DOC_PATHS: Record<DocId, string> = {
  "user-recovery": "README.md#recovery",
  "ghost-threat-model": "README.md#privacy",
  "payment-link-format": "README.md#payment-links",
  "wasm-scanner-upgrade": "frontend/README.md#wasm-scanner-upgrades",
};

export function getDocUrl(doc: DocId): string {
  return `${docsBaseUrl()}/${DOC_PATHS[doc]}`;
}

export function getUserRecoverySectionUrl(
  section:
    | "payment-link"
    | "manual-ghost"
    | "signature-keys"
    | "browser-session"
    | "ghost-backup"
    | "device-migration"
    | "what-to-backup",
): string {
  const anchors: Record<typeof section, string> = {
    "what-to-backup": "recovery",
    "signature-keys": "recovery",
    "browser-session": "recovery",
    "payment-link": "recovery",
    "manual-ghost": "recovery",
    "ghost-backup": "recovery",
    "device-migration": "recovery",
  };
  return `${docsBaseUrl()}/README.md#${anchors[section]}`;
}
