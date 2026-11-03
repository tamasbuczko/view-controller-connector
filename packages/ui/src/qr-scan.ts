/**
 * Camera QR scanner using html5-qrcode via dynamic import (bundled by tsup).
 * Falls back gracefully when camera / secure context is unavailable.
 */

export type QrScanHandle = {
  stop: () => Promise<void>;
};

export async function startQrScan(
  host: HTMLElement,
  onCode: (text: string) => void,
): Promise<QrScanHandle> {
  const { Html5Qrcode } = await import("html5-qrcode");
  host.innerHTML = "";
  const region = document.createElement("div");
  region.id = `vcc-qr-scan-${Math.random().toString(36).slice(2, 9)}`;
  region.style.cssText = "width:100%;max-width:320px;margin:.5rem auto 0";
  host.append(region);

  const scanner = new Html5Qrcode(region.id);
  await scanner.start(
    { facingMode: "environment" },
    { fps: 8, qrbox: { width: 220, height: 220 } },
    (decoded) => {
      onCode(decoded);
    },
    () => {
      /* ignore frame miss */
    },
  );

  return {
    stop: async () => {
      try {
        if (scanner.isScanning) await scanner.stop();
      } catch {
        /* already stopped */
      }
      try {
        scanner.clear();
      } catch {
        /* ignore */
      }
      host.innerHTML = "";
    },
  };
}
