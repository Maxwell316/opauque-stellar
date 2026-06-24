/**
 * Opaque Cash — Service Worker
 * Cache name: opauque-static-v1
 *
 * Strategy:
 * - Static assets (js, css, png, svg, woff2, ico): cache-first
 * - /api/ calls, Soroban RPC, Horizon, WASM integrity checks: network-only
 * - Everything else: network-first (falls back to cache if offline)
 *
 * On activate: old caches (any name not in CACHE_NAMES) are deleted.
 * On new SW activation: skipWaiting() + notify clients with { type: 'SW_UPDATED' }.
 */

const CACHE_NAME = "opauque-static-v1";
const CACHE_NAMES = [CACHE_NAME];

// Static asset extensions that should be served cache-first.
const STATIC_EXTENSIONS = [".js", ".css", ".png", ".svg", ".woff2", ".ico", ".webp", ".jpg", ".jpeg"];

// Patterns that must NEVER be cached — always go to the network.
const NETWORK_ONLY_PATTERNS = [
  "/api/",
  "soroban-rpc",
  "horizon.stellar.org",
  "stellar.org/rpc",
  "mainnet.sorobanrpc.com",
  // WASM module — bypass cache so integrity checks work correctly
  "/pkg/cryptography",
  ".wasm",
];

// Pre-cache a minimal shell on install.
// Vite produces hashed filenames so we only pre-cache root index here;
// all other assets are cached on first fetch via cache-first strategy.
const PRECACHE_URLS = ["/"];

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ---------------------------------------------------------------------------
// Activate — delete stale caches and claim clients
// ---------------------------------------------------------------------------

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !CACHE_NAMES.includes(key))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim())
      .then(() => notifyClients({ type: "SW_UPDATED" })),
  );
});

// ---------------------------------------------------------------------------
// Fetch
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Network-only: API, RPC, WASM
  if (isNetworkOnly(url, request)) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache-first for static assets (hashed filenames from Vite)
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first for everything else (navigation, unknown)
  event.respondWith(networkFirst(request));
});

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response("Offline", { status: 503, statusText: "Service Unavailable" });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNetworkOnly(url, request) {
  const fullUrl = url.href;
  const pathname = url.pathname;
  return NETWORK_ONLY_PATTERNS.some(
    (pattern) => fullUrl.includes(pattern) || pathname.includes(pattern),
  );
}

function isStaticAsset(url) {
  const pathname = url.pathname;
  return STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function notifyClients(message) {
  return self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      client.postMessage(message);
    }
  });
}
