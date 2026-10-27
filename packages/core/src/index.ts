export { createSession } from "./session.js";
export type { Session } from "./session.js";
export { VccClientError, toVccError } from "./errors.js";
export {
  shouldHideQrAfterPair,
  allowsPersistentQr,
  parsePairUri,
} from "./pairing.js";
export type * from "./types.js";
