/**
 * Single HTTPS entry for LAN phone testing:
 *   https://LAN:8443  → PHP demó (8080)
 *   wss://LAN:8443    → signaling WS (8787, localhost only)
 *
 * One self-signed cert accept covers page + WebSocket (Safari/iOS friendly).
 */
import { createServer } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import httpProxy from "http-proxy";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const certPath = join(root, "certs/lan-cert.pem");
const keyPath = join(root, "certs/lan-key.pem");
if (!existsSync(certPath) || !existsSync(keyPath)) {
  console.error("Missing certs. Run: pnpm certs:lan");
  process.exit(1);
}

const PORT = Number(process.env.VCC_HTTPS_PORT ?? 8443);
const HOST = process.env.VCC_HTTPS_HOST ?? "0.0.0.0";
const PHP = process.env.VCC_PHP_TARGET ?? "http://127.0.0.1:8080";
const SIG = process.env.VCC_SIG_TARGET ?? "http://127.0.0.1:8787";
const lanIp = process.env.VCC_LAN_IP ?? "192.168.1.118";

const proxy = httpProxy.createProxyServer({ xfwd: true, ws: true });

proxy.on("proxyReq", (proxyReq, req) => {
  // Keep the browser Host (e.g. 192.168.1.118:8443) — do not let PHP see 127.0.0.1.
  const originalHost = req.headers.host;
  if (originalHost) {
    proxyReq.setHeader("Host", originalHost);
    proxyReq.setHeader("X-Forwarded-Host", originalHost);
  }
  proxyReq.setHeader("X-Forwarded-Proto", "https");
  proxyReq.setHeader("X-Forwarded-Port", String(PORT));
});

proxy.on("error", (err, _req, res) => {
  console.error("[gateway]", err.message);
  if (res && typeof res.writeHead === "function" && !res.headersSent) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad gateway — PHP (8080) vagy signaling (8787) nem fut.");
  }
});

const server = createServer(
  {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  },
  (req, res) => {
    // changeOrigin:false — preserve Host so config.php builds wss://LAN:8443
    proxy.web(req, res, { target: PHP, changeOrigin: false });
  },
);

server.on("upgrade", (req, socket, head) => {
  // All WebSocket upgrades go to local signaling
  proxy.ws(req, socket, head, { target: SIG, changeOrigin: false });
});

server.listen(PORT, HOST, () => {
  console.log(`LAN HTTPS gateway on https://0.0.0.0:${PORT}`);
  console.log(`  HTTP  → ${PHP}`);
  console.log(`  WS    → ${SIG}`);
  console.log(`Telefon: https://${lanIp}:${PORT}`);
  console.log("(Fogadd el a cert figyelmeztetést egyszer, majd frissíts.)");
});
