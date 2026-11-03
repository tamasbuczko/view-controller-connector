import type { Session } from "@vcc/core";
import { clearQrCanvas, renderQrCanvas } from "./qr.js";

export type Unmount = () => void;

export interface ViewUiOpts {
  title?: string;
  /** Extra DOM for host content (e.g. scoreboard). */
  contentEl?: HTMLElement;
  /** If set, join as View after mount (competition deep link). */
  autoJoinCode?: string;
  /**
   * Full-bleed venue display: after join, hide join/header chrome.
   * QR stays available via a slim edge control on video-ref.
   */
  kiosk?: boolean;
}

export function mountView(
  el: HTMLElement,
  session: Session,
  opts?: ViewUiOpts,
): Unmount {
  el.innerHTML = "";
  el.dataset.theme = "vcc-demo";

  const kiosk = Boolean(opts?.kiosk);
  const root = document.createElement("div");
  root.className = kiosk ? "vcc-view vcc-view--kiosk" : "vcc-view";
  root.style.cssText = kiosk
    ? "display:grid;gap:0;padding:0;max-width:none;margin:0;min-height:100vh;"
    : "display:grid;gap:1.25rem;padding:1.5rem;max-width:720px;margin:0 auto;";

  const header = document.createElement("header");
  header.dataset.chrome = "1";
  header.innerHTML = `<div class="vcc-brand" style="font-size:2rem">VCC</div>
    <div style="opacity:.75">${opts?.title ?? "View"}</div>`;

  const joinEl = document.createElement("div");
  joinEl.className = "vcc-panel";
  joinEl.dataset.chrome = "1";
  joinEl.innerHTML = `<div class="vcc-live">JOIN</div>
    <select data-sessions style="font:inherit;padding:.5rem;margin-top:.5rem;width:100%;max-width:280px;box-sizing:border-box">
      <option value="">— aktív sessionök —</option>
    </select>
    <button type="button" class="vcc-btn secondary" data-act="refresh-sessions" style="margin-top:.5rem">Lista frissítés</button>
    <input data-code placeholder="SESSION KÓD" maxlength="8"
      style="text-transform:uppercase;font:inherit;padding:.6rem;margin-top:.5rem;width:100%;max-width:220px;font-family:var(--font-mono)" />
    <button type="button" class="vcc-btn" data-act="join" style="margin-top:.75rem">Csatlakozás</button>`;

  const qrEl = document.createElement("div");
  qrEl.className = "vcc-panel";
  qrEl.hidden = true;
  qrEl.dataset.chrome = "qr";
  qrEl.innerHTML = `<div class="vcc-live">PAIRING QR (ez a View)</div>
    <button type="button" class="vcc-btn" data-act="show-qr" style="margin-top:.5rem">QR mutat</button>
    <button type="button" class="vcc-btn secondary" data-act="hide-qr" style="margin-top:.5rem;margin-left:.5rem">QR elrejt</button>
    <button type="button" class="vcc-btn secondary" data-act="copy-uri" style="margin-top:.5rem;margin-left:.5rem">URI másolása</button>
    <div data-qr-host></div>
    <pre data-uri style="white-space:pre-wrap;word-break:break-all;font-family:var(--font-mono);font-size:.75rem;margin-top:.75rem"></pre>`;

  const statusEl = document.createElement("div");
  statusEl.dataset.chrome = "1";
  statusEl.style.opacity = "0.7";
  statusEl.textContent = `status: ${session.status}`;

  const contentHost = document.createElement("div");
  contentHost.className = "vcc-view-content";
  if (opts?.contentEl) contentHost.append(opts.contentEl);

  const kioskBar = document.createElement("div");
  kioskBar.className = "vcc-kiosk-bar";
  kioskBar.hidden = true;
  kioskBar.innerHTML = `<button type="button" class="vcc-btn secondary" data-act="kiosk-qr">QR</button>
    <button type="button" class="vcc-btn secondary" data-act="kiosk-chrome">Beállítások</button>
    <span data-kiosk-status style="font-family:var(--font-mono);font-size:.75rem;opacity:.7"></span>`;

  root.append(header, statusEl, joinEl, qrEl, contentHost, kioskBar);
  el.append(root);

  function applyKioskChrome(connected: boolean): void {
    if (!kiosk) return;
    const hide = connected;
    root.querySelectorAll("[data-chrome='1']").forEach((n) => {
      (n as HTMLElement).hidden = hide;
    });
    kioskBar.hidden = !hide;
    contentHost.style.padding = hide ? "1rem 1.25rem 3.5rem" : "";
  }

  const codeInput = joinEl.querySelector("[data-code]") as HTMLInputElement;
  const sessionSelect = joinEl.querySelector(
    "[data-sessions]",
  ) as HTMLSelectElement;

  const unsubs = [
    session.on("status", (s) => {
      statusEl.textContent = `status: ${s}`;
    }),
    session.on("pairingQr", (e) => {
      const host = qrEl.querySelector("[data-qr-host]") as HTMLElement;
      const uriNode = qrEl.querySelector("[data-uri]");
      if (!e.visible) {
        if (uriNode) uriNode.textContent = "";
        clearQrCanvas(host);
        return;
      }
      if (uriNode) uriNode.textContent = e.payload.uri;
      if (e.payload.uri) {
        void renderQrCanvas(host, e.payload.uri).catch((err) => {
          statusEl.textContent = `QR render: ${err instanceof Error ? err.message : String(err)}`;
        });
      }
    }),
    session.on("error", (e) => {
      statusEl.textContent = `error: ${e.code} — ${e.message}`;
    }),
  ];

  async function refreshSessions(): Promise<void> {
    try {
      await session.prepare();
      const list = await session.listSessions();
      const prev = sessionSelect.value;
      sessionSelect.innerHTML =
        '<option value="">— aktív sessionök —</option>';
      for (const s of list) {
        const opt = document.createElement("option");
        opt.value = s.code;
        const peers = s.peerCounts;
        opt.textContent = `${s.code} · ${s.mode} · v${peers.view}/c${peers.controller}`;
        sessionSelect.append(opt);
      }
      if (prev) sessionSelect.value = prev;
    } catch (e) {
      statusEl.textContent = `session list: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  sessionSelect.addEventListener("change", () => {
    if (sessionSelect.value) codeInput.value = sessionSelect.value;
  });

  joinEl
    .querySelector("[data-act=refresh-sessions]")
    ?.addEventListener("click", () => {
      void refreshSessions();
    });

  void refreshSessions();

  async function joinView(code: string): Promise<void> {
    const trimmed = code.trim();
    if (!trimmed) throw new Error("üres session kód");
    codeInput.value = trimmed;
    await session.prepare();
    await session.joinWithCode(trimmed, "view");
    qrEl.hidden = kiosk;
    statusEl.textContent = `Kapcsolódva · peer ${session.peerId}`;
    const ks = kioskBar.querySelector("[data-kiosk-status]");
    if (ks) ks.textContent = session.peerId ?? "";
    applyKioskChrome(true);
  }

  joinEl.querySelector("[data-act=join]")?.addEventListener("click", () => {
    void joinView(codeInput.value).catch((e) => {
      statusEl.textContent = `error: ${e instanceof Error ? e.message : String(e)}`;
    });
  });

  if (opts?.autoJoinCode) {
    void joinView(opts.autoJoinCode).catch((e) => {
      statusEl.textContent = `auto-join: ${e instanceof Error ? e.message : String(e)}`;
    });
  }

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
    clearQrCanvas(qrEl.querySelector("[data-qr-host]") as HTMLElement);
  });

  qrEl.querySelector("[data-act=copy-uri]")?.addEventListener("click", () => {
    const uri = qrEl.querySelector("[data-uri]")?.textContent ?? "";
    if (uri) void navigator.clipboard.writeText(uri);
  });

  kioskBar.querySelector("[data-act=kiosk-qr]")?.addEventListener("click", () => {
    const id = session.peerId;
    if (!id) return;
    qrEl.hidden = !qrEl.hidden;
    if (!qrEl.hidden) {
      session.showPairingQr({ type: "view", viewId: id });
    }
  });

  kioskBar
    .querySelector("[data-act=kiosk-chrome]")
    ?.addEventListener("click", () => {
      applyKioskChrome(false);
      qrEl.hidden = false;
      kioskBar.hidden = true;
    });

  return () => {
    for (const off of unsubs) off();
    el.innerHTML = "";
  };
}
