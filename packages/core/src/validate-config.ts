import { VccClientError } from "./errors.js";
import type { ConnectionMode, VccConfig } from "./types.js";

const MODES: ConnectionMode[] = ["1-1", "1-n", "n-1", "n-n"];

export function validateConfig(config: VccConfig): void {
  if (!config.signaling?.url) {
    throw new VccClientError("CONFIG_INVALID", "signaling.url is required");
  }
  if (
    config.signaling.adapter !== "websocket" &&
    config.signaling.adapter !== "php-poll"
  ) {
    throw new VccClientError("CONFIG_INVALID", "signaling.adapter invalid");
  }
  if (config.signaling.adapter === "php-poll") {
    throw new VccClientError(
      "NOT_IMPLEMENTED",
      "php-poll signaling adapter is not implemented yet",
    );
  }
  if (!config.allowedModes?.length) {
    throw new VccClientError("CONFIG_INVALID", "allowedModes is required");
  }
  for (const m of config.allowedModes) {
    if (!MODES.includes(m)) {
      throw new VccClientError("CONFIG_INVALID", `invalid mode: ${m}`);
    }
  }
  if (!config.allowedModes.includes(config.defaultMode)) {
    throw new VccClientError(
      "CONFIG_INVALID",
      "defaultMode must be in allowedModes",
    );
  }
  if (!config.catalog || !Array.isArray(config.catalog)) {
    throw new VccClientError("CONFIG_INVALID", "catalog is required");
  }
  const names = new Set<string>();
  for (const entry of config.catalog) {
    if (!entry.name) {
      throw new VccClientError("CONFIG_INVALID", "catalog entry missing name");
    }
    if (names.has(entry.name)) {
      throw new VccClientError(
        "CONFIG_INVALID",
        `duplicate catalog name: ${entry.name}`,
      );
    }
    names.add(entry.name);
  }
  if (config.media?.transport === "sfu") {
    throw new VccClientError(
      "NOT_IMPLEMENTED",
      "SFU media transport is not implemented yet",
    );
  }
}
