import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "../..");
const dest = join(root, "public/assets");
mkdirSync(dest, { recursive: true });

const coreDist = join(repo, "packages/core/dist");
const uiDist = join(repo, "packages/ui/dist");

if (!existsSync(join(coreDist, "index.js"))) {
  console.error("Missing @vcc/core build. Run: pnpm --filter @vcc/core build");
  process.exit(1);
}

cpSync(coreDist, join(dest, "core"), { recursive: true });
if (existsSync(uiDist)) {
  cpSync(uiDist, join(dest, "ui"), { recursive: true });
}
console.log("Demo assets copied to public/assets");
