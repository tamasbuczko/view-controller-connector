import type { Session } from "@vcc/core";

export type Unmount = () => void;

export interface ViewUiOpts {
  title?: string;
  /** Extra DOM for host content (e.g. scoreboard). */
  contentEl?: HTMLElement;
}

export function mountView(
  el: HTMLElement,
  session: Session,
  opts?: ViewUiOpts,
): Unmount {
  el.innerHTML = "";
  el.dataset.theme = "vcc-demo";

  const root = document.createElement("div");
  root.className = "vcc-view";
  root.style.cssText =
    "display:grid;gap:1.25rem;padding:1.5rem;max-width:720px;margin:0 auto;";

  const header = document.createElement("header");
  header.innerHTML = `<div class="vcc-brand" style="font-size:2rem">VCC</div>
    <div style="opacity:.75">${opts?.title ?? "View"}</div>`;

  const joinEl = document.createElement("div");
  joinEl.className = "vcc-panel";
  joinEl.innerHTML = `<div class="vcc-live">JOIN</div>
    <input data-code placeholder="SESSION KÓD" maxlength="8"
      style="text-transform:uppercase;font:inherit;padding:.6rem;margin-top:.5rem;width:100%;max-width:220px;font-family:var(--font-mono)" />
    <button type="button" class="vcc-btn" data-act="join" style="margin-top:.75rem">Csatlakozás</button>`;

  const qrEl = document.createElement("div");
  qrEl.className = "vcc-panel";
  qrEl.hidden = true;
  qrEl.innerHTML = `<div class="vcc-live">PAIRING QR (ez a View)</div>
    <button type="button" class="vcc-btn" data-act="show-qr" style="margin-top:.5rem">QR mutat</button>
    <button type="button" class="vcc-btn secondary" data-act="hide-qr" style="margin-top:.5rem;margin-left:.5rem">QR elrejt</button>
    <button type="button" class="vcc-btn secondary" data-act="copy-uri" style="margin-top:.5rem;margin-left:.5rem">URI másolása</button>
    <pre data-uri style="white-space:pre-wrap;word-break:break-all;font-family:var(--font-mono);font-size:.75rem;margin-top:.75rem"></pre>`;

  const statusEl = document.createElement("div");
  statusEl.style.opacity = "0.7";
  statusEl.textContent = `status: ${session.status}`;

  const contentHost = document.createElement("div");
  contentHost.className = "vcc-view-content";
  if (opts?.contentEl) contentHost.append(opts.contentEl);

  root.append(header, statusEl, joinEl, qrEl, contentHost);
  el.append(root);

  const unsubs = [
    session.on("status", (s) => {
      statusEl.textContent = `status: ${s}`;
    }),
    session.on("pairingQr", (e) => {
      const uriNode = qrEl.querySelector("[data-uri]");
      if (!e.visible) {
        if (uriNode) uriNode.textContent = "";
        return;
      }
      if (uriNode) uriNode.textContent = e.payload.uri;
    }),
    session.on("error", (e) => {
      statusEl.textContent = `error: ${e.code} — ${e.message}`;
    }),
  ];

  joinEl.querySelector("[data-act=join]")?.addEventListener("click", () => {
    void (async () => {
      const code = (
        joinEl.querySelector("[data-code]") as HTMLInputElement
      ).value.trim();
      await session.prepare();
      await session.joinWithCode(code, "view");
      qrEl.hidden = false;
      statusEl.textContent = `Kapcsolódva · peer ${session.peerId}`;
    })();
  });

  qrEl.querySelector("[data-act=show-qr]")?.addEventListener("click", () => {
    const id = session.peerId;
    if (!id) {
      statusEl.textContent = "Előbb csatlakozz View-ként.";
      return;
    }
    session.showPairingQr({ type: "view", viewId: id });
  });

  qrEl.querySelector("[data-act=hide-qr]")?.addEventListener("click", () => {
    const id = session.peerId;
    if (id) session.hidePairingQr({ type: "view", viewId: id });
  });

  qrEl.querySelector("[data-act=copy-uri]")?.addEventListener("click", () => {
    const uri = qrEl.querySelector("[data-uri]")?.textContent ?? "";
    if (uri) void navigator.clipboard.writeText(uri);
  });

  return () => {
    for (const off of unsubs) off();
    el.innerHTML = "";
  };
}
