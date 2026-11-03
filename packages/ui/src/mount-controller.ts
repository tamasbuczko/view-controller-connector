import type { MediaPublication, PairPayload, Session } from "@vcc/core";
import { parsePairUri } from "./parse-pair-uri.js";
import type { QrScanHandle } from "./qr-scan.js";

export type Unmount = () => void;

export interface ControllerUiOpts {
  title?: string;
  mode?: "score" | "camera";
}

export function mountController(
  el: HTMLElement,
  session: Session,
  opts?: ControllerUiOpts,
): Unmount {
  el.innerHTML = "";
  el.dataset.theme = "vcc-demo";
  const mode = opts?.mode ?? "score";

  const root = document.createElement("div");
  root.className = "vcc-controller";
  root.style.cssText =
    "display:grid;gap:1rem;padding:1.5rem;max-width:420px;margin:0 auto;";

  root.innerHTML = `
    <header>
      <div class="vcc-brand" style="font-size:1.75rem">VCC</div>
      <div style="opacity:.75">${opts?.title ?? (mode === "score" ? "Score Controller" : "Camera Controller")}</div>
    </header>
    <div style="opacity:.7" data-status>status: ${session.status}</div>
    <div class="vcc-panel">
      <div class="vcc-live">JOIN</div>
      <select data-sessions style="font:inherit;padding:.5rem;margin-top:.5rem;width:100%;box-sizing:border-box">
        <option value="">— aktív sessionök —</option>
      </select>
      <button type="button" class="vcc-btn secondary" data-act="refresh-sessions" style="margin-top:.5rem">Lista frissítés</button>
      <input data-code placeholder="SESSION KÓD" maxlength="8"
        style="text-transform:uppercase;font:inherit;padding:.6rem;margin-top:.5rem;width:100%;box-sizing:border-box;font-family:var(--font-mono)" />
      <textarea data-uri placeholder="vcc://pair?... (opcionális)" rows="3"
        style="margin-top:.5rem;width:100%;box-sizing:border-box;font-family:var(--font-mono);font-size:.75rem"></textarea>
      <button type="button" class="vcc-btn" data-act="join-code" style="margin-top:.75rem">Kóddal</button>
      <button type="button" class="vcc-btn secondary" data-act="join-uri" style="margin-top:.5rem;margin-left:.35rem">Pair URI</button>
      <button type="button" class="vcc-btn secondary" data-act="scan-qr" style="margin-top:.5rem;margin-left:.35rem">QR scan</button>
      <button type="button" class="vcc-btn secondary" data-act="stop-scan" hidden style="margin-top:.5rem;margin-left:.35rem">Scan stop</button>
      <div data-scan-host style="margin-top:.5rem"></div>
    </div>
    <div data-body></div>
  `;

  const body = root.querySelector("[data-body]") as HTMLElement;
  const statusEl = root.querySelector("[data-status]") as HTMLElement;
  const scanHost = root.querySelector("[data-scan-host]") as HTMLElement;
  const codeInput = root.querySelector("[data-code]") as HTMLInputElement;
  const uriInput = root.querySelector("[data-uri]") as HTMLTextAreaElement;
  const sessionSelect = root.querySelector(
    "[data-sessions]",
  ) as HTMLSelectElement;
  let scanHandle: QrScanHandle | null = null;

  if (mode === "score") {
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <button type="button" data-side="aka" style="background:#c43c22;color:#fff;border:0;padding:1.5rem;font-size:1.15rem;border-radius:2px">AKA +1</button>
        <button type="button" data-side="ao" style="background:#1d4f91;color:#fff;border:0;padding:1.5rem;font-size:1.15rem;border-radius:2px">AO +1</button>
      </div>
      <div data-score style="font-family:var(--font-display);font-size:2rem;margin-top:.75rem">0 — 0</div>
    `;
  } else {
    body.innerHTML = `
      <button type="button" class="vcc-btn" data-act="cam-start" disabled>Kamera start</button>
      <button type="button" class="vcc-btn secondary" data-act="cam-stop" disabled style="margin-left:.35rem">Stop</button>
      <video data-preview autoplay playsinline muted style="width:100%;margin-top:.75rem;background:#12140f;aspect-ratio:16/9;object-fit:cover"></video>
    `;
  }

  el.append(root);

  const state = { aka: 0, ao: 0 };
  let publication: MediaPublication | null = null;

  const unsubs = [
    session.on("status", (s) => {
      statusEl.textContent = `status: ${s}`;
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
        opt.textContent = `${s.code} · ${s.mode} · v${peers.view}/c${peers.controller}/o${peers.observer}`;
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

  root
    .querySelector("[data-act=refresh-sessions]")
    ?.addEventListener("click", () => {
      void refreshSessions();
    });

  void refreshSessions();

  root.querySelector("[data-act=join-code]")?.addEventListener("click", () => {
    void (async () => {
      const code = codeInput.value.trim();
      await session.prepare();
      await session.joinWithCode(code, "controller");
      statusEl.textContent = `Kapcsolódva · ${session.peerId}`;
      enableActions();
    })().catch((e) => {
      statusEl.textContent = `error: ${e instanceof Error ? e.message : String(e)}`;
    });
  });

  root.querySelector("[data-act=join-uri]")?.addEventListener("click", () => {
    void (async () => {
      const raw = uriInput.value.trim();
      const payload = parsePairUri(raw) as PairPayload | null;
      if (!payload) {
        statusEl.textContent = "Érvénytelen pair URI";
        return;
      }
      await session.prepare();
      await session.joinWithPairToken(payload);
      statusEl.textContent = `Kapcsolódva (pair) · ${session.peerId}`;
      enableActions();
    })().catch((e) => {
      statusEl.textContent = `error: ${e instanceof Error ? e.message : String(e)}`;
    });
  });

  root.querySelector("[data-act=scan-qr]")?.addEventListener("click", () => {
    void (async () => {
      try {
        await scanHandle?.stop();
        scanHandle = await import("./qr-scan.js").then((m) =>
          m.startQrScan(scanHost, (text) => {
            uriInput.value = text;
            const payload = parsePairUri(text);
            if (payload) {
              statusEl.textContent = "QR OK — Pair URI kitöltve";
            } else if (/^[A-Z0-9]{4,8}$/i.test(text.trim())) {
              codeInput.value = text.trim().toUpperCase();
              statusEl.textContent = "QR OK — session kód kitöltve";
            } else {
              statusEl.textContent = "QR beolvasva (nem pair URI / kód)";
            }
            void scanHandle?.stop().then(() => {
              scanHandle = null;
              (
                root.querySelector("[data-act=stop-scan]") as HTMLButtonElement
              ).hidden = true;
            });
          }),
        );
        (
          root.querySelector("[data-act=stop-scan]") as HTMLButtonElement
        ).hidden = false;
        statusEl.textContent = "QR scanner aktív";
      } catch (e) {
        statusEl.textContent = `QR scan: ${e instanceof Error ? e.message : String(e)} (HTTPS / permission?)`;
      }
    })();
  });

  root.querySelector("[data-act=stop-scan]")?.addEventListener("click", () => {
    void (async () => {
      await scanHandle?.stop();
      scanHandle = null;
      (
        root.querySelector("[data-act=stop-scan]") as HTMLButtonElement
      ).hidden = true;
      statusEl.textContent = "Scan stopped";
    })();
  });

  function enableActions(): void {
    body
      .querySelectorAll("[data-act=cam-start], [data-side]")
      .forEach((n) => ((n as HTMLButtonElement).disabled = false));
  }

  body.querySelectorAll("[data-side]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const side = btn.getAttribute("data-side") as "aka" | "ao";
      state[side] += 1;
      const score = body.querySelector("[data-score]");
      if (score) score.textContent = `${state.aka} — ${state.ao}`;
      void session.send({
        name: "score.updated",
        to: "*",
        payload: { ...state },
      });
    });
  });

  body.querySelector("[data-act=cam-start]")?.addEventListener("click", () => {
    void (async () => {
      try {
        publication = await session.publishMedia({
          kind: "camera",
          label: "cam-1",
        });
        const preview = body.querySelector(
          "[data-preview]",
        ) as HTMLVideoElement | null;
        if (preview && publication.stream)
          preview.srcObject = publication.stream;
        (
          body.querySelector("[data-act=cam-stop]") as HTMLButtonElement
        ).disabled = false;
        (
          body.querySelector("[data-act=cam-start]") as HTMLButtonElement
        ).disabled = true;
        statusEl.textContent = `LIVE · ${publication.id}`;
      } catch (e) {
        statusEl.textContent = `camera: ${e instanceof Error ? e.message : String(e)}`;
      }
    })();
  });

  body.querySelector("[data-act=cam-stop]")?.addEventListener("click", () => {
    void (async () => {
      await publication?.stop();
      publication = null;
      const preview = body.querySelector(
        "[data-preview]",
      ) as HTMLVideoElement | null;
      if (preview) preview.srcObject = null;
      (body.querySelector("[data-act=cam-start]") as HTMLButtonElement).disabled =
        false;
      (body.querySelector("[data-act=cam-stop]") as HTMLButtonElement).disabled =
        true;
      statusEl.textContent = "Stopped";
    })();
  });

  return () => {
    void scanHandle?.stop();
    for (const off of unsubs) off();
    el.innerHTML = "";
  };
}
