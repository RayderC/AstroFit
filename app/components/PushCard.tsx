"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { disablePush, enablePush, pushState, type PushState } from "@/lib/pushClient";

export default function PushCard() {
  const [state, setState] = useState<PushState>("loading");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.matchMedia("(display-mode: standalone)").matches);
    pushState().then(setState);
  }, []);

  async function run(action: () => Promise<void>, after?: PushState, done = "") {
    setBusy(true); setMsg("");
    try {
      await action();
      if (after) setState(after);
      setMsg(done);
    } catch (x) { setMsg((x as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="card section">
      <div className="card-title" style={{ marginBottom: 6 }}>Notifications</div>
      <div className="settings-row">
        <div>
          <div className="settings-label">Rest timer on this device</div>
          <div className="settings-hint">
            {state === "unsupported"
              ? "Not available in this browser. It needs HTTPS and the installed app."
              : "Tells you when rest is over, even with the screen off or another app open."}
          </div>
          {ios && state !== "on" && <div className="settings-hint">On iPhone, add AstroFit to your Home Screen first, then turn this on from there.</div>}
        </div>
        {(state === "off" || state === "on") && (
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" disabled={busy}
              onClick={() => run(async () => {
                // A test needs this device signed up first, so turning on is part of it.
                if (state === "off") { await enablePush(); setState("on"); }
                await api("/api/push/test", { method: "POST" });
              }, undefined, "Test sent. It should show up in a few seconds, even if you switch apps.")}>Send test</button>
            <button className={state === "on" ? "btn-secondary btn-sm" : "btn-primary btn-sm"} disabled={busy}
              onClick={() => state === "on" ? run(disablePush, "off") : run(enablePush, "on", "Notifications are on for this device.")}>
              {state === "on" ? "Turn off" : "Turn on"}
            </button>
          </div>
        )}
      </div>
      {msg && <p className="settings-hint" role="status">{msg}</p>}
    </div>
  );
}
