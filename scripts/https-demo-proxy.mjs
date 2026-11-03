/**
 * HTTPS reverse proxy → PHP demó (http://127.0.0.1:8080).
 * Phone getUserMedia needs secure context → use https://LAN:8443
 */
import { createServer } from "node:https";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import httpProxy from "http-proxy";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cert = join(root, "certs/lan-cert.pem");
const key = join(root, "certs/lan-key.pem");
if (!existsSync(cert) || !existsSync(key)) {
  console.error("Missing certs. Run: node scripts/gen-lan-certs.mjs");
  process.exit(1);
}

const PORT = Number(process.env.VCC_HTTPS_PORT ?? 8443);
const TARGET = process.env.VCC_PHP_TARGET ?? "http://127.0.0.1:8080";
const HOST = process.env.VCC_HTTPS_HOST ?? "0.0.0.0";

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  changeOrigin: true,
  xfwd: true,
});

proxy.on("proxyReq", (proxyReq) => {
  proxyReq.setHeader("X-Forwarded-Proto", "https");
});

proxy.on("error", (err, _req, res) => {
  console.error("[https-proxy]", err.message);
  if (res && !res.headersSent) {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end("Bad gateway — is PHP demó running on 8080?");
  }
});

const server = createServer(
  {
    key: readFileSync(key),
    cert: readFileSync(cert),
  },
  (req, res) => {
    proxy.web(req, res);
  },
);

server.listen(PORT, HOST, () => {
  console.log(`HTTPS demó proxy https://0.0.0.0:${PORT} → ${TARGET}`);
  console.log(`Telefon: https://192.168.1.118:${PORT} (fogadd el a self-signed figyelmeztetést)`);
});
