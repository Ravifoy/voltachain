"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink } from "lucide-react";
import BatteryIndicator from "./BatteryIndicator";
import type { TxInfo } from "@/lib/chain";
import { etherscan } from "@/lib/config";

/** Shown after every on-chain action: battery fills to 100%, glow burst, then the receipt details. */
export default function TxSuccessCard({ title, tx, children }: { title: string; tx: TxInfo; children?: React.ReactNode }) {
  const rows: [string, string][] = [
    ["Transaction hash", tx.hash], ["Block number", String(tx.blockNumber)],
    ["Block hash", tx.blockHash], ["Gas used", Number(tx.gasUsed).toLocaleString("en-US")],
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card relative overflow-hidden border-volt/60 shadow-glow">
      <div className="pointer-events-none absolute left-1/2 top-8 h-24 w-24 -translate-x-1/2 rounded-full bg-volt/40 burst" />
      <div className="relative flex flex-col items-center gap-3 text-center">
        <BatteryIndicator percent={100} size="md" />
        <h3 className="flex items-center gap-2 font-display text-lg text-volt"><CheckCircle2 className="h-5 w-5" /> {title}</h3>
      </div>
      <dl className="relative mt-4 space-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-ink/70 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wider text-mute">{k}</dt>
            <dd className="hash">{v}</dd>
          </div>
        ))}
      </dl>
      {children && <div className="relative mt-3">{children}</div>}
      <Link href={`/explorer?tx=${tx.hash}`} className="btn-primary relative mt-4 w-full">
        View in explorer <ExternalLink className="h-4 w-4" />
      </Link>
      {etherscan("tx", tx.hash) && (
        <a href={etherscan("tx", tx.hash)!} target="_blank" rel="noreferrer" className="btn-ghost relative mt-2 w-full">View on Etherscan <ExternalLink className="h-4 w-4" /></a>
      )}
    </motion.div>
  );
}
