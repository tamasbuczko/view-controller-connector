/**
 * Start signaling with LAN TLS (WSS). Loads certs from ./certs.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cert = resolve(root, "certs/lan-cert.pem");
const key = resolve(root, "certs/lan-key.pem");
if (!existsSync(cert) || !existsSync(key)) {
  console.error("Missing certs. Run: pnpm certs:lan");
  process.exit(1);
}

const lanIp = process.env.VCC_LAN_IP ?? "192.168.1.118";
const env = {
  ...process.env,
  VCC_SIGNALING_HOST: "0.0.0.0",
  VCC_SIGNALING_PORT: process.env.VCC_SIGNALING_PORT ?? "8787",
  VCC_PUBLIC_WS_URL: `wss://${lanIp}:8787`,
  VCC_ALLOWED_ORIGINS: [
    `https://${lanIp}:8443`,
    `https://127.0.0.1:8443`,
    `http://${lanIp}:8080`,
    "http://127.0.0.1:8080",
    "http://localhost:8080",
  ].join(","),
  VCC_TLS_CERT: cert,
  VCC_TLS_KEY: key,
};

const entry = join(root, "packages/signaling/src/server.ts");
const child = spawn("pnpm", ["exec", "tsx", entry], {
  cwd: join(root, "packages/signaling"),
  env,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code) => process.exit(code ?? 1));
