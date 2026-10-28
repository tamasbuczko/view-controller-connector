import type { ConnectionMode, Session, TopologySnapshot } from "@vcc/core";

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
  root.className = "vcc-observer vcc-observer-layout";

  const header = document.createElement("header");
  header.innerHTML = `<div class="vcc-brand" style="font-size:2rem">VCC</div>
    <div style="opacity:.75">${opts?.title ?? "Observer"}</div>`;

  const statusWrap = document.createElement("div");
  statusWrap.className = "vcc-status-wrap";
  statusWrap.innerHTML = `<div class="vcc-status-line" data-live-line></div>`;

  const modeEl = document.createElement("div");
  modeEl.className = "vcc-panel";
  modeEl.innerHTML = `<div class="vcc-live">MODE</div>
    <select data-mode style="font:inherit;padding:.5rem;margin-top:.5rem;width:100%;max-width:220px">
      <option value="1-1">1-1</option>
      <option value="1-n">1-n</option>
      <option value="n-1">n-1</option>
      <option value="n-n" selected>n-n</option>
    </select>`;

  const codeEl = document.createElement("div");
  codeEl.className = "vcc-panel";
  codeEl.innerHTML = `<div class="vcc-live">SESSION</div><div class="vcc-code" data-code>—</div>
    <button type="button" class="vcc-btn" data-act="activate" style="margin-top:1rem">Aktiválás</button>
    <button type="button" class="vcc-btn secondary" data-act="copy" style="margin-top:1rem;margin-left:.5rem">Kód másolása</button>
    <button type="button" class="vcc-btn secondary" data-act="mint-view" style="margin-top:1rem;margin-left:.5rem">QR (első View)</button>
    <button type="button" class="vcc-btn secondary" data-act="mint-group" style="margin-top:1rem;margin-left:.5rem">QR (cameras group)</button>
    <button type="button" class="vcc-btn secondary" data-act="hide-qr" style="margin-top:1rem;margin-left:.5rem">QR elrejt</button>`;

  const qrEl = document.createElement("div");
  qrEl.className = "vcc-panel";
  qrEl.hidden = true;
  qrEl.innerHTML = `<div class="vcc-live">PAIRING QR</div>
    <pre data-uri style="white-space:pre-wrap;word-break:break-all;font-family:var(--font-mono);font-size:.75rem"></pre>
    <button type="button" class="vcc-btn secondary" data-act="copy-uri" style="margin-top:.5rem">URI másolása</button>
    <p style="opacity:.65;font-size:.85rem;margin:.5rem 0 0">Illeszd a Controller „pair URI” mezőjébe (QR lib a demóban opcionális).</p>`;

  const left = document.createElement("div");
  left.style.cssText = "display:grid;gap:1.25rem";

  const topoEl = document.createElement("div");
  topoEl.className = "vcc-panel";
  topoEl.innerHTML = `<div class="vcc-live">TOPOLOGY</div><div data-topo-list style="display:grid;gap:.5rem;margin-top:.75rem"></div><pre data-topo style="white-space:pre-wrap;font-family:var(--font-mono);font-size:.75rem;opacity:.65;margin-top:.75rem">—</pre>`;

  const statusEl = document.createElement("div");
  statusEl.style.opacity = "0.7";
  statusEl.textContent = `status: ${session.status}`;
  statusWrap.append(statusEl);

  left.append(modeEl, codeEl, qrEl);
  root.append(header, statusWrap, left, topoEl);
  el.append(root);

  let lastTarget: { type: "view"; viewId: string } | { type: "group"; groupId: string } | null =
    null;

  const unsubs = [
    session.on("status", (s) => {
      statusEl.textContent = `status: ${s}`;
      const line = statusWrap.querySelector("[data-live-line]");
      line?.classList.toggle("is-live", s === "active");
    }),
    session.on("topology", (t) => renderTopo(t)),
    session.on("peerJoined", () => {
      /* topology refresh animates peers */
    }),
    session.on("pairingQr", (e) => {
      if (!e.visible) {
        qrEl.hidden = true;
        return;
      }
      qrEl.hidden = false;
      const uriNode = qrEl.querySelector("[data-uri]");
      if (uriNode) uriNode.textContent = e.payload.uri;
    }),
    session.on("error", (e) => {
      statusEl.textContent = `error: ${e.code} — ${e.message}`;
    }),
  ];

  function renderTopo(t: TopologySnapshot): void {
    const pre = topoEl.querySelector("[data-topo]");
    if (pre) pre.textContent = JSON.stringify(t, null, 2);
    const list = topoEl.querySelector("[data-topo-list]");
    if (!list) return;
    list.innerHTML = "";
    for (const p of t.peers) {
      const row = document.createElement("div");
      row.className = "vcc-peer";
      row.style.cssText =
        "display:flex;justify-content:space-between;gap:.5rem;border-bottom:1px solid var(--vcc-line);padding:.35rem 0";
      row.innerHTML = `<span>${p.role}</span><span style="font-family:var(--font-mono);font-size:.8rem;color:var(--vcc-signal)">${p.id.slice(0, 8)}</span>`;
      list.append(row);
    }
  }

  qrEl.querySelector("[data-act=copy-uri]")?.addEventListener("click", () => {
    const uri = qrEl.querySelector("[data-uri]")?.textContent ?? "";
    if (uri) void navigator.clipboard.writeText(uri);
  });

  codeEl.querySelector("[data-act=activate]")?.addEventListener("click", () => {
    void (async () => {
      const mode = (modeEl.querySelector("[data-mode]") as HTMLSelectElement)
        .value as ConnectionMode;
      await session.prepare();
      const { sessionCode } = await session.createAndActivate({ mode });
      const codeNode = codeEl.querySelector("[data-code]");
      if (codeNode) codeNode.textContent = sessionCode;
      renderTopo(session.getTopology());
    })();
  });

  codeEl.querySelector("[data-act=copy]")?.addEventListener("click", () => {
    const code = codeEl.querySelector("[data-code]")?.textContent ?? "";
    if (code && code !== "—") void navigator.clipboard.writeText(code);
  });

  codeEl.querySelector("[data-act=mint-view]")?.addEventListener("click", () => {
    const topo = session.getTopology();
    const view = topo.peers.find((p) => p.role === "view");
    if (!view) {
      statusEl.textContent = "Nincs View a sessionben — előbb joinoljon egy View.";
      return;
    }
    lastTarget = { type: "view", viewId: view.id };
    session.showPairingQr(lastTarget);
  });

  codeEl
    .querySelector("[data-act=mint-group]")
    ?.addEventListener("click", () => {
      void (async () => {
        const topo = session.getTopology();
        const views = topo.peers.filter((p) => p.role === "view").map((p) => p.id);
        if (views.length < 1) {
          statusEl.textContent = "Legalább 1 View kell a grouphoz.";
          return;
        }
        await session.defineGroup("cameras", views);
        lastTarget = { type: "group", groupId: "cameras" };
        session.showPairingQr(lastTarget);
      })();
    });

  codeEl.querySelector("[data-act=hide-qr]")?.addEventListener("click", () => {
    if (lastTarget) session.hidePairingQr(lastTarget);
    else qrEl.hidden = true;
  });

  return () => {
    for (const off of unsubs) off();
    el.innerHTML = "";
  };
}
