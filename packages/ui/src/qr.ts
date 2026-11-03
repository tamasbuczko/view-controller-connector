import QRCode from "qrcode";

/** Render a QR code for `text` into a canvas (creates one if missing). */
export async function renderQrCanvas(
  host: HTMLElement,
  text: string,
  opts?: { size?: number },
): Promise<HTMLCanvasElement> {
  const size = opts?.size ?? 220;
  let canvas = host.querySelector("canvas[data-vcc-qr]") as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.dataset.vccQr = "1";
    canvas.style.cssText = "display:block;margin:.75rem auto 0;background:#fff;border-radius:2px";
    host.append(canvas);
  }
  await QRCode.toCanvas(canvas, text, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#12140f", light: "#ffffff" },
  });
  return canvas;
}

export function clearQrCanvas(host: HTMLElement): void {
  host.querySelector("canvas[data-vcc-qr]")?.remove();
}
