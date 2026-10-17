"use client";
import { AlertTriangle } from "lucide-react";
import ChargingLoader from "./ChargingLoader";
import TxSuccessCard from "./TxSuccessCard";
import type { TxInfo } from "@/lib/chain";

export type TxState =
  | { status: "idle" }
  | { status: "pending"; label?: string }
  | { status: "success"; tx: TxInfo; title: string }
  | { status: "error"; message: string; tx?: TxInfo | null };

/** One component for all 3 transaction states: charging / success card / error. */
export default function TxPanel({ state, children }: { state: TxState; children?: React.ReactNode }) {
  if (state.status === "idle") return null;
  if (state.status === "pending") return <div className="card"><ChargingLoader label={state.label ?? "Charging transaction…"} /></div>;
  if (state.status === "success") return <TxSuccessCard title={state.title} tx={state.tx}>{children}</TxSuccessCard>;
  return (
    <div className="card border-redx/60 shadow-[0_0_18px_rgba(239,68,68,0.3)]" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-redx" />
        <div className="min-w-0">
          <p className="font-display text-sm text-redx">Transaction failed</p>
          <p className="mt-1 break-words text-sm text-slate-200">{state.message}</p>
          {state.tx && (
            <p className="mt-2 text-xs text-mute">
              Mined as a failed transaction in block {state.tx.blockNumber}: <span className="hash">{state.tx.hash}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
