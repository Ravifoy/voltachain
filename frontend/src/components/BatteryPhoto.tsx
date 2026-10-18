"use client";
import { useEffect, useState } from "react";
import { ImageOff, ShieldCheck, ShieldAlert } from "lucide-react";
import { fetchImage, hashImage } from "@/lib/image";

/**
 * Shows the battery photo stored off-chain, but only after re-hashing it and comparing with the
 * hash stored on the blockchain. A swapped or edited photo is NOT displayed.
 */
export default function BatteryPhoto({ hash, className = "", badge = true }: { hash: string; className?: string; badge?: boolean }) {
  const [state, setState] = useState<{ src: string | null; status: "loading" | "ok" | "missing" | "tampered" }>({ src: null, status: "loading" });

  useEffect(() => {
    let on = true;
    fetchImage(hash).then((data) => {
      if (!on) return;
      if (!data) return setState({ src: null, status: "missing" });
      setState(hashImage(data).toLowerCase() === hash.toLowerCase() ? { src: data, status: "ok" } : { src: null, status: "tampered" });
    });
    return () => { on = false; };
  }, [hash]);

  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      {state.status === "ok" && <img src={state.src!} alt="Battery" className="h-full w-full object-cover" />}
      {state.status === "loading" && <div className="h-full w-full animate-pulse bg-panel2" />}
      {(state.status === "missing" || state.status === "tampered") && (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-3 text-center text-xs text-mute">
          {state.status === "tampered" ? <ShieldAlert className="h-6 w-6 text-redx" /> : <ImageOff className="h-6 w-6" />}
          {state.status === "tampered" ? "Photo does not match the blockchain record" : "Photo unavailable right now"}
        </div>
      )}
      {badge && state.status === "ok" && (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[10px] font-semibold text-volt backdrop-blur"><ShieldCheck className="h-3 w-3" /> Photo verified</span>
      )}
    </div>
  );
}
