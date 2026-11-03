/**
 * Generate self-signed TLS certs for local LAN demó (gitignored under certs/).
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import selfsigned from "selfsigned";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "certs");
mkdirSync(dir, { recursive: true });

const lanIp = process.env.VCC_LAN_IP ?? "192.168.1.118";
const attrs = [{ name: "commonName", value: lanIp }];
const pems = selfsigned.generate(attrs, {
  days: 365,
  keySize: 2048,
  algorithm: "sha256",
  extensions: [
    {
      name: "subjectAltName",
      altNames: [
        { type: 2, value: "localhost" },
        { type: 2, value: lanIp },
        { type: 7, ip: "127.0.0.1" },
        { type: 7, ip: lanIp },
      ],
    },
  ],
});

writeFileSync(join(dir, "lan-key.pem"), pems.private, "utf8");
writeFileSync(join(dir, "lan-cert.pem"), pems.cert, "utf8");
console.log(`Wrote certs/lan-cert.pem + lan-key.pem (CN/SAN: ${lanIp}, localhost)`);
if (!existsSync(join(dir, "lan-cert.pem"))) process.exit(1);
