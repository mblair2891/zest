/* Summex offline-first PWA. Cache app shell + last navigations.
   Location menu/floor/tickets live in IndexedDB / POS persist (primed online). */
const SHELL = "summex-shell-v1";
const RUNTIME = "summex-runtime-v1";

const PRECACHE = [
  "/station",
  "/app",
  "/dashboard",
  "/login",
  "/favicon.svg",
  "/icon-180.png",
  "/icon-192.png",
  "/icon-512.png",
  "/station.webmanifest",
  "/__grok/manifest.webmanifest",
  "/__grok/icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, RUNTIME]);
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

function isGet(req) {
  return req.method === "GET";
}

function isApi(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  );
}

function isSession(url) {
  return url.pathname.startsWith("/api/auth/get-session");
}

function isAsset(url) {
  return /\.(js|css|woff2?|png|jpg|jpeg|svg|gif|webp|ico|webmanifest)$/i.test(
    url.pathname,
  );
}

function isNavigate(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}

async function cacheHtmlAssets(res) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return;
    const html = await res.clone().text();
    const found = new Set();
    const re = /(?:src|href)="(\/[^"]+\.(?:js|css)[^"]*)"/g;
    let m;
    while ((m = re.exec(html))) found.add(m[1]);
    const runtime = await caches.open(RUNTIME);
    await Promise.all([...found].map((u) => runtime.add(u).catch(() => undefined)));
  } catch {
    /* ignore */
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(req, res.clone()).catch(() => undefined);
      cacheHtmlAssets(res).catch(() => undefined);
    }
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    const byUrl = await cache.match(new URL(req.url).pathname);
    if (byUrl) return byUrl;
    throw new Error("offline");
  }
}

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) {
    fetch(req)
      .then((res) => {
        if (res && res.ok) cache.put(req, res.clone());
      })
      .catch(() => undefined);
    return hit;
  }
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone()).catch(() => undefined);
  return res;
}

async function navigationFallback() {
  const shell = await caches.open(SHELL);
  const runtime = await caches.open(RUNTIME);
  for (const url of ["/station", "/app", "/dashboard", "/login", "/"]) {
    const hit = (await runtime.match(url)) || (await shell.match(url));
    if (hit) return hit;
  }
  return new Response("Offline. Open this device once while online to prime it.", {
    status: 503,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "CACHE_POS" || !data.url) return;
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(SHELL);
        const res = await fetch(data.url, { credentials: "same-origin" });
        if (res && res.ok) await cache.put(data.url, res);
      } catch {
        /* offline */
      }
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (!isGet(req)) return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.searchParams.get("install") === "1") return;

  if (isSession(url)) {
    event.respondWith(
      networkFirst(req, RUNTIME).catch(() =>
        caches.match(req).then(
          (h) =>
            h ||
            new Response(JSON.stringify({ user: null, session: null }), {
              headers: { "content-type": "application/json" },
            }),
        ),
      ),
    );
    return;
  }

  if (isApi(url)) return;

  if (isAsset(url)) {
    event.respondWith(cacheFirst(req, RUNTIME));
    return;
  }

  if (isNavigate(req)) {
    event.respondWith(
      networkFirst(req, SHELL).catch(() => navigationFallback()),
    );
  }
});
