/**
 * Signaling for LAN gateway: bind localhost only, NO TLS
 * (TLS terminates at scripts/lan-https-gateway.mjs).
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const lanIp = process.env.VCC_LAN_IP ?? "192.168.1.118";

const env = {
  ...process.env,
  VCC_SIGNALING_HOST: "127.0.0.1",
  VCC_SIGNALING_PORT: "8787",
  // Advertised in pair payloads — clients connect via gateway
  VCC_PUBLIC_WS_URL: `wss://${lanIp}:8443`,
  VCC_ALLOWED_ORIGINS: [
    `https://${lanIp}:8443`,
    "https://127.0.0.1:8443",
    `http://${lanIp}:8080`,
    "http://127.0.0.1:8080",
  ].join(","),
  // Explicitly no TLS on this process
  VCC_TLS_CERT: "",
  VCC_TLS_KEY: "",
};

const entry = join(root, "packages/signaling/src/server.ts");
const child = spawn("pnpm", ["exec", "tsx", entry], {
  cwd: join(root, "packages/signaling"),
  env,
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 1));
