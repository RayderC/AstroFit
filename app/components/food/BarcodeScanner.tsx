"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/app/components/Icon";

// Live scanning needs camera access, which browsers only allow over HTTPS. Taking a photo works over plain
// HTTP too, so it's always offered. Phones with a built-in barcode reader (Android Chrome) use that;
// everything else, including iPhones, uses the ZXing library, loaded only when the scanner opens.

type Detector = { detect: (src: CanvasImageSource | ImageBitmap) => Promise<{ rawValue: string }[]> };
const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

async function nativeDetector(): Promise<Detector | null> {
  const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
  if (!BD) return null;
  try {
    const supported = (await BD.getSupportedFormats?.()) ?? FORMATS;
    const formats = FORMATS.filter(f => supported.includes(f));
    return formats.length ? new BD({ formats }) : null;
  } catch { return null; }
}

/** Only product barcodes are useful here, so anything else read by mistake is ignored. */
const productCode = (v: string) => (/^\d{6,14}$/.test(v.trim()) ? v.trim() : null);

export default function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const photo = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState<"starting" | "on" | "unavailable">("starting");
  const [why, setWhy] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const done = useRef(false);

  const found = (code: string) => {
    if (done.current) return;
    done.current = true;
    try { navigator.vibrate?.(80); } catch { /* ignore */ }
    onCode(code);
  };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopZxing: (() => void) | null = null;
    let raf = 0;
    let cancelled = false;

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setLive("unavailable");
        setWhy("Live scanning needs AstroFit to be opened over HTTPS. You can still take a photo of the barcode.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) {
        setLive("unavailable");
        setWhy((e as Error).name === "NotAllowedError" ? "Camera access was blocked. Allow it in the browser's site settings, or take a photo instead." : "Couldn't start the camera. Take a photo of the barcode instead.");
        return;
      }
      if (cancelled || !video.current) { stream.getTracks().forEach(t => t.stop()); return; }
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      setLive("on");

      const native = await nativeDetector();
      if (native) {
        const tick = async () => {
          if (cancelled || done.current || !video.current) return;
          try {
            if (video.current.readyState >= 2) {
              const hit = (await native.detect(video.current)).map(r => productCode(r.rawValue)).find(Boolean);
              if (hit) return found(hit);
            }
          } catch { /* a frame that couldn't be read */ }
          raf = window.setTimeout(tick, 150) as unknown as number;
        };
        tick();
        return;
      }
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { BarcodeFormat, DecodeHintType } = await import("@zxing/library");
      if (cancelled || !video.current) return;
      const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120 });
      const controls = await reader.decodeFromVideoElement(video.current, r => {
        const code = r ? productCode(r.getText()) : null;
        if (code) found(code);
      });
      stopZxing = () => controls.stop();
    })();

    return () => {
      cancelled = true;
      clearTimeout(raf);
      stopZxing?.();
      stream?.getTracks().forEach(t => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fromPhoto(file: File) {
    setBusy(true); setMsg("");
    try {
      const native = await nativeDetector();
      if (native) {
        const bmp = await createImageBitmap(file);
        const hit = (await native.detect(bmp)).map(r => productCode(r.rawValue)).find(Boolean);
        if (hit) return found(hit);
      }
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const url = URL.createObjectURL(file);
      try {
        const r = await new BrowserMultiFormatReader().decodeFromImageUrl(url);
        const code = productCode(r.getText());
        if (code) return found(code);
      } finally { URL.revokeObjectURL(url); }
      setMsg("No barcode found in that photo. Get closer so the barcode fills most of the picture, with good light.");
    } catch {
      setMsg("No barcode found in that photo. Get closer so the barcode fills most of the picture, with good light.");
    } finally { setBusy(false); }
  }

  return (
    <div className="scanner">
      {live !== "unavailable" && (
        <div className="scanner-view">
          <video ref={video} playsInline muted aria-label="Camera" />
          <div className="scanner-frame" aria-hidden />
          <p className="scanner-tip">{live === "starting" ? "Starting camera…" : "Point at the barcode. It scans on its own."}</p>
        </div>
      )}
      {live === "unavailable" && <p className="form-hint scanner-why">{why}</p>}

      <div className="scanner-alt">
        <input ref={photo} type="file" accept="image/*" capture="environment" hidden
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) fromPhoto(f); }} />
        <button type="button" className={live === "unavailable" ? "btn-primary" : "btn-secondary"} disabled={busy} onClick={() => photo.current?.click()}>
          <Icon name="camera" size={14} /> {busy ? "Reading photo…" : "Take a photo of the barcode"}
        </button>
        {msg && <p className="form-error">{msg}</p>}
        <form className="scanner-type" onSubmit={e => { e.preventDefault(); const c = productCode(typed); if (c) found(c); else setMsg("Type the 8 to 14 digits under the barcode."); }}>
          <input className="form-input" inputMode="numeric" placeholder="…or type the numbers" value={typed} onChange={e => setTyped(e.target.value.replace(/\D/g, "").slice(0, 14))} aria-label="Barcode number" />
          <button className="btn-secondary" disabled={typed.length < 6}>Look up</button>
        </form>
      </div>
    </div>
  );
}
