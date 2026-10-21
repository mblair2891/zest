/* Summex offline-first PWA. Cache app shell + last navigations.
   Location menu/floor/tickets live in IndexedDB / POS persist (primed online).
   A script or get-session body that is not one JSON / JavaScript value is not cached. */
const SHELL = "summex-shell-v3";
const RUNTIME = "summex-runtime-v3";
const SETUP_MSG = "The station could not read the setup response. Try pairing again.";

const PRECACHE = [
  "/station",
  "/app",
  "/dashboard",
  "/login",
  "/venue/food_hall",
  "/venue/restaurant",
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
        PRECACHE.map(async (url) => {
          try {
            const res = await fetch(url);
            if (!res.ok) return;
            const path = new URL(url, self.location.origin).pathname;
            const page = !/\.(png|svg|ico|webmanifest)$/i.test(path);
            const ct = (res.headers.get("content-type") || "").toLowerCase();
            if (page && !ct.includes("text/html")) {
              logSetup("precache", res.status, await res.clone().text());
              return;
            }
            await cache.put(url, res);
          } catch {
            /* ignore */
          }
        }),
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

function isCode(url, req) {
  const dest = req.destination;
  if (dest === "script" || dest === "worker" || dest === "style") return true;
  return /\.(js|mjs|css)$/i.test(url.pathname);
}

function isNavigate(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}

function sample(text) {
  return String(text || "").replace(/\s+/g, " ").slice(0, 240);
}

function logSetup(where, status, body) {
  console.error(`[setup] ${where} status=${status} body=${sample(body)}`);
}

function isSingleJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function codeHeadOk(head, contentType, ok) {
  if (!ok) return false;
  const ct = String(contentType || "").toLowerCase();
  if (ct.includes("text/html") || ct.includes("application/json") || ct.includes("text/json")) {
    return false;
  }
  const start = String(head || "").replace(/^\uFEFF/, "").trimStart();
  if (!start) return false;
  const c = start[0];
  if (c === "<" || c === "{" || c === "[") return false;
  return true;
}

async function responseHead(res) {
  const ct = res.headers.get("content-type") || "";
  if (!res.body) return { ct, head: "" };
  const reader = res.clone().body.getReader();
  let head = "";
  try {
    const { value } = await reader.read();
    if (value) head = new TextDecoder().decode(value.slice(0, 240));
  } catch {
    head = "";
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  return { ct, head };
}

function scriptFailure(req) {
  const css = req.destination === "style" || /\.css$/i.test(new URL(req.url).pathname);
  if (css) {
    return new Response(`/* ${SETUP_MSG} */\n`, {
      status: 200,
      headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response(`throw new Error(${JSON.stringify(SETUP_MSG)});\n`, {
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function sessionSignedOut() {
  return new Response(JSON.stringify({ user: null, session: null }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function cacheHtmlAssets(res) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return;
    const html = await res.clone().text();
    const found = new Set();
    const re = /(?:src|href)="(\/[^"]+\.(?:js|css|mjs)[^"]*)"/g;
    let m;
    while ((m = re.exec(html))) found.add(m[1]);
    const pre = /rel="modulepreload"[^>]*href="([^"]+)"/g;
    while ((m = pre.exec(html))) found.add(m[1]);
    const pre2 = /href="([^"]+)"[^>]*rel="modulepreload"/g;
    while ((m = pre2.exec(html))) found.add(m[1]);
    const runtime = await caches.open(RUNTIME);
    await Promise.all(
      [...found].map(async (u) => {
        try {
          const asset = await fetch(u);
          const head = await responseHead(asset);
          if (!codeHeadOk(head.head, head.ct, asset.ok)) {
            logSetup("script", asset.status, head.head);
            return;
          }
          await runtime.put(u, asset);
        } catch {
          /* ignore */
        }
      }),
    );
  } catch {
    /* ignore */
  }
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (res && res.ok && ct.includes("text/html")) {
      cache.put(req, res.clone()).catch(() => undefined);
      cacheHtmlAssets(res).catch(() => undefined);
      return res;
    }
    if (res && (ct.includes("json") || ct.includes("text/html"))) {
      const text = await res.clone().text();
      logSetup("navigation", res.status, text);
      return new Response(`<!doctype html><title>Summex</title><p>${SETUP_MSG}</p>`, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
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

async function guardedCode(req) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(req);
  if (hit) {
    const cached = await responseHead(hit);
    if (codeHeadOk(cached.head, cached.ct, hit.ok)) {
      fetch(req)
        .then(async (res) => {
          const next = await responseHead(res);
          if (codeHeadOk(next.head, next.ct, res.ok)) cache.put(req, res.clone());
          else logSetup("script", res.status, next.head);
        })
        .catch(() => undefined);
      return hit;
    }
    logSetup("cached-script", hit.status, cached.head);
    await cache.delete(req);
  }
  try {
    const res = await fetch(req);
    const head = await responseHead(res);
    if (!codeHeadOk(head.head, head.ct, res.ok)) {
      logSetup("script", res.status, head.head);
      return scriptFailure(req);
    }
    cache.put(req, res.clone()).catch(() => undefined);
    return res;
  } catch {
    logSetup("script", 0, req.url);
    return scriptFailure(req);
  }
}

async function sessionResponse(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const res = await fetch(req);
    const text = await res.text();
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("json")) {
      logSetup("get-session", res.status, text);
      return sessionSignedOut();
    }
    if (!isSingleJson(text)) {
      logSetup("get-session", res.status, text);
      return sessionSignedOut();
    }
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    const rebuilt = new Response(text, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
    if (res.ok) cache.put(req, rebuilt.clone()).catch(() => undefined);
    return rebuilt;
  } catch {
    logSetup("get-session", 0, "network failed");
    const hit = await cache.match(req);
    if (hit) {
      const text = await hit.clone().text();
      if (isSingleJson(text)) return hit;
    }
    return sessionSignedOut();
  }
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
        const ct = res.headers.get("content-type") || "";
        if (res && res.ok && ct.includes("text/html")) await cache.put(data.url, res);
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
    event.respondWith(sessionResponse(req));
    return;
  }

  if (isApi(url)) return;

  if (isCode(url, req)) {
    event.respondWith(guardedCode(req));
    return;
  }

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
