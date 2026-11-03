<?php
declare(strict_types=1);
$id = isset($_GET['id']) ? (string) $_GET['id'] : '';
$config = require dirname(__DIR__) . '/config.php';
?><!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tatami desk</title>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500&family=IBM+Plex+Sans:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/assets/ui/theme.css" />
  <link rel="stylesheet" href="/comp/comp.css" />
</head>
<body class="comp" data-theme="vcc-demo">
  <div class="comp-wrap">
    <nav class="comp-nav">
      <a href="/comp/">← Tatamik</a>
    </nav>
    <h1 class="comp-brand" id="title">Tatami</h1>
    <p class="comp-sub" id="subtitle">Operátor desk</p>

    <div class="comp-desk">
      <section class="comp-panel">
        <h3>Küzdelmek</h3>
        <div id="bouts"></div>
        <div class="comp-actions">
          <button type="button" id="btn-start">Következő indítása</button>
          <button type="button" class="secondary" id="btn-complete">Meccs lezárása</button>
          <button type="button" class="secondary" id="btn-next">Következő meccs</button>
          <button type="button" class="secondary" id="btn-refresh">Frissítés</button>
        </div>
      </section>

      <section class="comp-panel">
        <h3>VCC session + eszközök</h3>
        <div class="comp-status" id="vcc-status">Observer: idle</div>
        <div class="comp-code" id="session-code">————</div>
        <div class="comp-actions">
          <button type="button" id="btn-session">Session indítás (n-n)</button>
          <button type="button" class="secondary" id="btn-copy">Kód másolása</button>
        </div>
        <div class="comp-links" id="device-links"></div>
        <p class="comp-status" style="margin-top:1rem">
          Checklist: scoreboard TV · score telefon · 2–4 cam telefon (QR a video-refen) · REC a video-refen
        </p>
      </section>
    </div>
    <p class="comp-status" id="status"></p>
  </div>

  <?php require dirname(__DIR__) . '/partials/importmap.php'; ?>
  <script>
    window.__VCC_CONFIG__ = <?= json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>;
    window.__COMP_TATAMI_ID__ = <?= json_encode($id, JSON_UNESCAPED_UNICODE) ?>;
  </script>
  <script type="module">
    import { createSession } from "/assets/core/index.js";

    const tatamiId = window.__COMP_TATAMI_ID__;
    const statusEl = document.getElementById("status");
    const boutsEl = document.getElementById("bouts");
    const codeEl = document.getElementById("session-code");
    const vccStatus = document.getElementById("vcc-status");
    const linksEl = document.getElementById("device-links");

    let state = null;
    let sessionCode = null;
    const observer = createSession(window.__VCC_CONFIG__);

    observer.on("status", (s) => {
      vccStatus.textContent = `Observer: ${s}${observer.peerId ? ` · ${observer.peerId}` : ""}`;
    });
    observer.on("error", (e) => {
      vccStatus.textContent = `error: ${e.code} — ${e.message}`;
    });

    function escapeHtml(s) {
      return String(s)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    function roleUrl(path) {
      const u = new URL(path, location.origin);
      if (sessionCode) u.searchParams.set("code", sessionCode);
      u.searchParams.set("tatami", tatamiId);
      return u.pathname + u.search;
    }

    function renderLinks() {
      if (!sessionCode) {
        linksEl.innerHTML = "<div class='comp-meta'>Indíts sessiont a deep linkekhez.</div>";
        return;
      }
      const items = [
        ["Scoreboard (TV)", "/view-scoreboard.php"],
        ["Video ref (laptop)", "/view-video.php"],
        ["Score controller", "/controller-score.php"],
        ["Camera controller", "/controller-camera.php"],
      ];
      linksEl.innerHTML = items
        .map(
          ([label, path]) =>
            `<a href="${roleUrl(path)}" target="_blank" rel="noopener">${escapeHtml(label)} → ${escapeHtml(roleUrl(path))}</a>`,
        )
        .join("");
    }

    function renderBouts() {
      if (!state) return;
      document.getElementById("title").textContent = state.tatami.name;
      document.getElementById("subtitle").textContent =
        `${state.event?.name ?? ""} · ${state.categories?.length ?? 0} kategória`;
      boutsEl.innerHTML = "";
      let lastCat = "";
      for (const b of state.bouts) {
        if (b._categoryName !== lastCat) {
          lastCat = b._categoryName;
          const h = document.createElement("div");
          h.className = "comp-meta";
          h.style.marginTop = "0.75rem";
          h.textContent = lastCat;
          boutsEl.append(h);
        }
        const row = document.createElement("div");
        row.className = "comp-bout";
        row.dataset.status = b.status;
        const score =
          b.score != null
            ? `${b.score.aka ?? 0}–${b.score.ao ?? 0}`
            : "—";
        row.innerHTML = `<div class="comp-row">
            <div class="comp-names">
              <span class="comp-aka">${escapeHtml(b.aka?.name ?? "AKA")}</span>
              vs
              <span class="comp-ao">${escapeHtml(b.ao?.name ?? "AO")}</span>
            </div>
            <span class="comp-badge">${escapeHtml(b.status)}</span>
          </div>
          <div class="comp-meta">#${b.order} · ${score}
            <button type="button" data-start="${escapeHtml(b.id)}" class="secondary" style="margin-left:.5rem;padding:.2rem .45rem;font-size:.75rem">Start</button>
          </div>`;
        boutsEl.append(row);
      }
      boutsEl.querySelectorAll("[data-start]").forEach((btn) => {
        btn.addEventListener("click", () => {
          void boutAction("start", { boutId: btn.getAttribute("data-start") });
        });
      });
    }

    async function load() {
      const res = await fetch(`/comp/api/tatami.php?id=${encodeURIComponent(tatamiId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "load failed");
      state = data;
      if (data.session?.sessionCode) {
        sessionCode = data.session.sessionCode;
        codeEl.textContent = sessionCode;
      }
      renderBouts();
      renderLinks();
      statusEl.textContent = "";
    }

    async function persistSession(code, sessionId) {
      await fetch("/comp/api/session.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tatamiId,
          sessionCode: code,
          sessionId: sessionId || "",
        }),
      });
    }

    async function boutAction(action, extra = {}) {
      statusEl.textContent = `${action}…`;
      const live = state?.liveBout;
      const body = {
        action,
        tatamiId,
        boutId: extra.boutId || live?.id || "",
        aka: live?.score?.aka ?? 0,
        ao: live?.score?.ao ?? 0,
        ...extra,
      };
      const res = await fetch("/comp/api/bout-action.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        statusEl.textContent = data.error || "action failed";
        return data;
      }
      await load();
      // Push competitors over VCC if observer is active and mesh peers exist —
      // scoreboard also polls host; still try send via a side-channel note in status.
      if (data.competitors) {
        statusEl.textContent = `Élő: ${data.competitors.aka?.name} vs ${data.competitors.ao?.name}`;
        try {
          // Observer has no PeerMesh — scoreboard polls /comp/api. Optional: broadcast nothing.
        } catch {
          /* ignore */
        }
      } else if (data.message) {
        statusEl.textContent = data.message;
      } else {
        statusEl.textContent = `${action} OK`;
      }
      return data;
    }

    document.getElementById("btn-session").onclick = async () => {
      try {
        vccStatus.textContent = "Observer: connecting…";
        await observer.prepare();
        const created = await observer.createAndActivate({ mode: "n-n" });
        sessionCode = created.sessionCode;
        codeEl.textContent = sessionCode;
        await persistSession(created.sessionCode, created.sessionId);
        renderLinks();
        statusEl.textContent = `Session ${sessionCode} aktív`;
      } catch (e) {
        statusEl.textContent = e instanceof Error ? e.message : String(e);
      }
    };

    document.getElementById("btn-copy").onclick = async () => {
      if (!sessionCode) return;
      await navigator.clipboard.writeText(sessionCode);
      statusEl.textContent = "Kód a vágólapon";
    };

    document.getElementById("btn-start").onclick = () => void boutAction("start");
    document.getElementById("btn-complete").onclick = () => void boutAction("complete");
    document.getElementById("btn-next").onclick = () => void boutAction("next");
    document.getElementById("btn-refresh").onclick = () => void load();

    if (!tatamiId) {
      statusEl.textContent = "Hiányzó tatami id";
    } else {
      load().catch((e) => {
        statusEl.textContent = String(e.message || e);
      });
    }

    // Light poll so score updates from phones show on desk queue
    setInterval(() => {
      void load().catch(() => {});
    }, 4000);
  </script>
</body>
</html>
