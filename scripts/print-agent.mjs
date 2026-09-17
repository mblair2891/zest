#!/usr/bin/env node
/**
 * Summex local print agent — LAN ESC/POS (Star / Epson / generic).
 *
 * Browsers cannot open TCP 9100. Run this on the house hub or a paired station
 * (same LAN as printers):
 *
 *   node scripts/print-agent.mjs
 *
 * Listens on http://127.0.0.1:9105
 *   GET  /health
 *   POST /print   JSON { target, escposBase64, family, job }
 *
 * Subscribe to the venue job queue (QR / kiosk / online / dashboard test):
 *
 *   SUMMEX_PRINT_ORIGIN=https://app.summex.app \
 *   SUMMEX_LOCATION_ID=loc_xxx \
 *   SUMMEX_PRINT_AGENT_TOKEN=optional \
 *   node scripts/print-agent.mjs
 *
 * `target` is host or host:port (default port 9100).
 * POS never uses the OS print dialog for LAN printers.
 */
import http from "node:http";
import net from "node:net";

const PORT = Number(process.env.SUMMEX_PRINT_AGENT_PORT || 9105);
const HOST = process.env.SUMMEX_PRINT_AGENT_HOST || "127.0.0.1";
const VENUE_ORIGIN = String(process.env.SUMMEX_PRINT_ORIGIN || "").replace(/\/$/, "");
const VENUE_LOCATION_ID = String(process.env.SUMMEX_LOCATION_ID || "").trim();
const VENUE_TOKEN = String(process.env.SUMMEX_PRINT_AGENT_TOKEN || "").trim();
const VENUE_WORKER = String(process.env.SUMMEX_PRINT_WORKER_ID || "print-agent").trim() || "print-agent";
const VENUE_POLL_MS = Math.max(1500, Number(process.env.SUMMEX_PRINT_POLL_MS) || 2500);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function send(res, status, body) {
  cors(res);
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(json) });
  res.end(json);
}

function parseTarget(raw) {
  const s = String(raw ?? "").trim();
  if (!s) throw new Error("Printer target (IP) is required");
  const [host, portStr] = s.includes(":") ? s.split(":") : [s, "9100"];
  const port = Number(portStr) || 9100;
  return { host, port };
}

function writeSocket(host, port, buf) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host, port }, () => {
      sock.write(buf, (err) => {
        if (err) {
          sock.destroy();
          reject(err);
          return;
        }
        sock.end();
      });
    });
    sock.setTimeout(4000);
    sock.on("timeout", () => {
      sock.destroy();
      reject(new Error("Printer timed out"));
    });
    sock.on("error", reject);
    sock.on("close", () => resolve());
  });
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  if (req.method === "GET" && url.pathname === "/health") {
    send(res, 200, { ok: true, service: "summex-print-agent" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/print") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      send(res, 400, { ok: false, error: "Invalid JSON" });
      return;
    }
    try {
      const { host, port } = parseTarget(body.target);
      const b64 = String(body.escposBase64 ?? "");
      if (!b64) throw new Error("escposBase64 required");
      const buf = Buffer.from(b64, "base64");
      await writeSocket(host, port, buf);
      send(res, 200, { ok: true, bytes: buf.length, host, port });
    } catch (err) {
      send(res, 502, { ok: false, error: err instanceof Error ? err.message : "print failed" });
    }
    return;
  }
  send(res, 404, { ok: false, error: "Not found" });
});

async function venueJson(action, extra = {}) {
  const res = await fetch(`${VENUE_ORIGIN}/api/print/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      locationId: VENUE_LOCATION_ID,
      token: VENUE_TOKEN,
      workerId: VENUE_WORKER,
      ...extra,
    }),
  });
  if (!res.ok) throw new Error(`venue ${action} ${res.status}`);
  return res.json();
}

let venueBusy = false;
async function drainVenueQueue() {
  if (venueBusy || !VENUE_ORIGIN || !VENUE_LOCATION_ID) return;
  venueBusy = true;
  try {
    const claimed = await venueJson("claim");
    const job = claimed?.job;
    if (!job?.host || !job?.escposBase64) return;
    let ok = false;
    try {
      const buf = Buffer.from(String(job.escposBase64), "base64");
      const port = Number(job.port) > 0 ? Number(job.port) : 9100;
      await writeSocket(job.host, port, buf);
      ok = true;
    } catch (err) {
      console.error("venue print failed", err instanceof Error ? err.message : err);
    }
    await venueJson("complete", { jobId: job.id, ok });
  } catch (err) {
    console.error("venue queue", err instanceof Error ? err.message : err);
  } finally {
    venueBusy = false;
  }
}

server.listen(PORT, HOST, () => {
  console.log(`Summex print agent http://${HOST}:${PORT}  (POST /print)`);
  if (VENUE_ORIGIN && VENUE_LOCATION_ID) {
    console.log(`Subscribed to ${VENUE_ORIGIN} location ${VENUE_LOCATION_ID}`);
    drainVenueQueue();
    setInterval(() => {
      drainVenueQueue();
    }, VENUE_POLL_MS);
  }
});
