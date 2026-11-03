import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  // Keep SDK as peer; bundle QR libs into the browser ESM build.
  external: ["@vcc/core"],
  noExternal: ["qrcode", "html5-qrcode"],
  splitting: false,
  platform: "browser",
});
