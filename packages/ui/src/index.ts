export { mountObserver } from "./mount-observer.js";
export type { ObserverUiOpts, Unmount } from "./mount-observer.js";
export { mountView } from "./mount-view.js";
export type { ViewUiOpts } from "./mount-view.js";

/** Stub — full shell in later demo-ux iteration. */
export function mountController(): () => void {
  console.warn("@vcc/ui mountController: not implemented yet");
  return () => undefined;
}
