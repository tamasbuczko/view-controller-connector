export { mountObserver } from "./mount-observer.js";
export type { ObserverUiOpts, Unmount } from "./mount-observer.js";

/** Stubs — full shells in next iteration (demo-ux). */
export function mountView(): () => void {
  console.warn("@vcc/ui mountView: not implemented yet");
  return () => undefined;
}

export function mountController(): () => void {
  console.warn("@vcc/ui mountController: not implemented yet");
  return () => undefined;
}
