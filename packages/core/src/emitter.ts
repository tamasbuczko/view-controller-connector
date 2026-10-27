/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyHandler = (...args: any[]) => void;

/** Minimal typed event bus (no Node dependency in browser). */
export class Emitter<Events extends object> {
  private readonly map = new Map<keyof Events, Set<AnyHandler>>();

  on<E extends keyof Events>(event: E, handler: Events[E]): () => void {
    let set = this.map.get(event);
    if (!set) {
      set = new Set();
      this.map.set(event, set);
    }
    set.add(handler as AnyHandler);
    return () => this.off(event, handler);
  }

  off<E extends keyof Events>(event: E, handler: Events[E]): void {
    this.map.get(event)?.delete(handler as AnyHandler);
  }

  emit<E extends keyof Events>(
    event: E,
    ...args: Events[E] extends (...a: infer A) => unknown ? A : never
  ): void {
    const set = this.map.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      handler(...args);
    }
  }

  clear(): void {
    this.map.clear();
  }
}
