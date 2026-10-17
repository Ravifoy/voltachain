"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import BatteryIndicator from "./BatteryIndicator";
import GradeBadge from "./GradeBadge";
import TxPanel, { TxState } from "./TxPanel";
import { BatteryFull, friendlyError, runTx, writeContract } from "@/lib/chain";
import { priceLabel } from "@/lib/config";
import { useWallet } from "@/lib/wallet";

/** "Confirm purchase" dialog. The contract moves the NFT to the buyer and pays the seller directly. */
export default function BuyModal({ item, onClose, onDone }: { item: BatteryFull; onClose: () => void; onDone?: () => void }) {
  const { address, connect, chainOk, switchNetwork } = useWallet();
  const [state, setState] = useState<TxState>({ status: "idle" });
  const r = item.reports[item.reports.length - 1];

  const confirm = async () => {
    setState({ status: "pending", label: "Charging transaction…" });
    try {
      const c = await writeContract();
      const tx = await runTx(() => c.buy(item.battery.tokenId, { value: item.listing.price }));
      setState({ status: "success", title: "Purchase complete — it's yours!", tx });
      onDone?.();
    } catch (e) { setState({ status: "error", message: friendlyError(e) }); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md space-y-4">
        {state.status !== "success" && (
          <div className="card border-volt/50 shadow-glow">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg text-white">Confirm purchase</h3>
              <button onClick={onClose} aria-label="Close"><X className="h-5 w-5 text-mute" /></button>
            </div>
            <p className="mt-2 text-sm text-mute">{item.battery.batteryType} · <span className="font-mono">{item.battery.serialNumber}</span></p>
            {r && <div className="mt-3 flex items-center gap-3"><GradeBadge grade={r.grade} /><BatteryIndicator percent={r.sohPercent} size="sm" /></div>}
            <p className="mt-4 font-display text-xl font-bold text-bolt text-glow-bolt">{priceLabel(item.listing.price)}</p>
            <p className="mt-1 text-xs text-mute">Your payment goes directly to the seller and the battery is transferred to you in the same step.</p>
            <div className="mt-4">
              {!address ? <button className="btn-primary w-full" onClick={connect}>Connect wallet first</button>
                : !chainOk ? <button className="btn-bolt w-full" onClick={switchNetwork}>Switch to the local network</button>
                : <button className="btn-primary w-full" disabled={state.status === "pending"} onClick={confirm}>Confirm purchase</button>}
            </div>
          </div>
        )}
        <TxPanel state={state} />
        {state.status === "success" && <button className="btn-ghost w-full" onClick={onClose}>Close</button>}
      </motion.div>
    </div>
  );
}
