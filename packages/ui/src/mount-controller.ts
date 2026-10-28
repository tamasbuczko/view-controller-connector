import type { MediaPublication, Session } from "@vcc/core";
import { parsePairUri } from "@vcc/core";

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
      <input data-code placeholder="SESSION KÓD" maxlength="8"
        style="text-transform:uppercase;font:inherit;padding:.6rem;margin-top:.5rem;width:100%;box-sizing:border-box;font-family:var(--font-mono)" />
      <textarea data-uri placeholder="vcc://pair?... (opcionális)" rows="3"
        style="margin-top:.5rem;width:100%;box-sizing:border-box;font-family:var(--font-mono);font-size:.75rem"></textarea>
      <button type="button" class="vcc-btn" data-act="join-code" style="margin-top:.75rem">Kóddal</button>
      <button type="button" class="vcc-btn secondary" data-act="join-uri" style="margin-top:.5rem;margin-left:.35rem">Pair URI</button>
    </div>
    <div data-body></div>
  `;

  const body = root.querySelector("[data-body]") as HTMLElement;
  const statusEl = root.querySelector("[data-status]") as HTMLElement;

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

  root.querySelector("[data-act=join-code]")?.addEventListener("click", () => {
    void (async () => {
      const code = (
        root.querySelector("[data-code]") as HTMLInputElement
      ).value.trim();
      await session.prepare();
      await session.joinWithCode(code, "controller");
      statusEl.textContent = `Kapcsolódva · ${session.peerId}`;
      enableActions();
    })();
  });

  root.querySelector("[data-act=join-uri]")?.addEventListener("click", () => {
    void (async () => {
      const raw = (
        root.querySelector("[data-uri]") as HTMLTextAreaElement
      ).value.trim();
      const payload = parsePairUri(raw);
      if (!payload) {
        statusEl.textContent = "Érvénytelen pair URI";
        return;
      }
      await session.prepare();
      await session.joinWithPairToken(payload);
      statusEl.textContent = `Kapcsolódva (pair) · ${session.peerId}`;
      enableActions();
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
      publication = await session.publishMedia({
        kind: "camera",
        label: "cam-1",
      });
      const preview = body.querySelector(
        "[data-preview]",
      ) as HTMLVideoElement | null;
      if (preview && publication.stream) preview.srcObject = publication.stream;
      (body.querySelector("[data-act=cam-stop]") as HTMLButtonElement).disabled =
        false;
      (body.querySelector("[data-act=cam-start]") as HTMLButtonElement).disabled =
        true;
      statusEl.textContent = `LIVE · ${publication.id}`;
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
    for (const off of unsubs) off();
    el.innerHTML = "";
  };
}
