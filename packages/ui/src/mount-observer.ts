import type { Session, TopologySnapshot } from "@vcc/core";

export type Unmount = () => void;

export interface ObserverUiOpts {
  title?: string;
}

export function mountObserver(
  el: HTMLElement,
  session: Session,
  opts?: ObserverUiOpts,
): Unmount {
  el.innerHTML = "";
  el.dataset.theme = "vcc-demo";

  const root = document.createElement("div");
  root.className = "vcc-observer";
  root.style.cssText =
    "display:grid;gap:1.25rem;padding:1.5rem;max-width:960px;margin:0 auto;";

  const header = document.createElement("header");
  header.innerHTML = `<div class="vcc-brand" style="font-size:2rem">VCC</div>
    <div style="opacity:.75">${opts?.title ?? "Observer"}</div>`;

  const codeEl = document.createElement("div");
  codeEl.className = "vcc-panel";
  codeEl.innerHTML = `<div class="vcc-live">SESSION</div><div class="vcc-code" data-code>—</div>
    <button type="button" class="vcc-btn" data-act="activate" style="margin-top:1rem">Aktiválás</button>
    <button type="button" class="vcc-btn secondary" data-act="copy" style="margin-top:1rem;margin-left:.5rem">Kód másolása</button>`;

  const topoEl = document.createElement("div");
  topoEl.className = "vcc-panel";
  topoEl.innerHTML = `<div class="vcc-live">TOPOLOGY</div><pre data-topo style="white-space:pre-wrap;font-family:var(--font-mono);font-size:.85rem">—</pre>`;

  const statusEl = document.createElement("div");
  statusEl.style.opacity = "0.7";
  statusEl.textContent = `status: ${session.status}`;

  root.append(header, statusEl, codeEl, topoEl);
  el.append(root);

  const unsubs = [
    session.on("status", (s) => {
      statusEl.textContent = `status: ${s}`;
    }),
    session.on("topology", (t) => renderTopo(t)),
    session.on("error", (e) => {
      statusEl.textContent = `error: ${e.code} — ${e.message}`;
    }),
  ];

  function renderTopo(t: TopologySnapshot): void {
    const pre = topoEl.querySelector("[data-topo]");
    if (pre) pre.textContent = JSON.stringify(t, null, 2);
  }

  codeEl.querySelector("[data-act=activate]")?.addEventListener("click", () => {
    void (async () => {
      await session.prepare();
      const { sessionCode } = await session.createAndActivate();
      const codeNode = codeEl.querySelector("[data-code]");
      if (codeNode) codeNode.textContent = sessionCode;
      renderTopo(session.getTopology());
    })();
  });

  codeEl.querySelector("[data-act=copy]")?.addEventListener("click", () => {
    const code = codeEl.querySelector("[data-code]")?.textContent ?? "";
    if (code && code !== "—") void navigator.clipboard.writeText(code);
  });

  return () => {
    for (const off of unsubs) off();
    el.innerHTML = "";
  };
}
