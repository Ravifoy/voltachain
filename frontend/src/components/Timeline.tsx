"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Factory, FileCheck2, Tag, ArrowRightLeft } from "lucide-react";
import { AddressChip } from "./bits";
import { priceLabel } from "@/lib/config";
import type { TimelineItem } from "@/lib/chain";

const META = {
  registered: { icon: Factory, color: "#22ff88", title: "Registered on chain" },
  report: { icon: FileCheck2, color: "#ffd60a", title: "Health report added" },
  listed: { icon: Tag, color: "#a3e635", title: "Listed for sale" },
  sold: { icon: ArrowRightLeft, color: "#22ff88", title: "Ownership transferred" },
} as const;

/** Vertical glowing "wire" with a node per on-chain event; each shows its tx hash + block. */
export default function Timeline({ items, reportInfo }: { items: TimelineItem[]; reportInfo?: Record<string, { soh: number; grade: string }> }) {
  return (
    <div className="relative pl-10">
      <div className="wire-v absolute bottom-2 left-[15px] top-2" />
      <ul className="space-y-6">
        {items.map((it, i) => {
          const m = META[it.kind];
          const Icon = m.icon;
          const rep = it.reportHash ? reportInfo?.[it.reportHash] : undefined;
          return (
            <motion.li key={`${it.txHash}-${it.logIndex}`} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="relative">
              <span className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-ink" style={{ borderColor: m.color, boxShadow: `0 0 12px ${m.color}99` }}>
                <Icon className="h-4 w-4" style={{ color: m.color }} />
              </span>
              <div className="card py-3">
                <p className="font-display text-sm font-bold" style={{ color: m.color }}>{m.title}</p>
                <div className="mt-1 space-y-1 text-sm text-slate-300">
                  {it.kind === "registered" && <p>Owner: <AddressChip address={it.who!} /></p>}
                  {it.kind === "report" && (
                    <>
                      <p>By inspector <AddressChip address={it.who!} />{rep && <> · SoH <b className="text-white">{rep.soh}%</b> · Grade <b className="text-white">{rep.grade}</b></>}</p>
                      <p className="text-xs text-mute">Report hash: <Link href={`/verify?hash=${it.reportHash}`} className="font-mono text-volt hover:underline">{it.reportHash!.slice(0, 18)}…</Link> (click to verify)</p>
                    </>
                  )}
                  {it.kind === "listed" && <p>Seller <AddressChip address={it.who!} /> asked <b className="text-bolt">{priceLabel(it.price!)}</b></p>}
                  {it.kind === "sold" && <p><AddressChip address={it.who!} /> → <AddressChip address={it.to!} /> for <b className="text-bolt">{priceLabel(it.price!)}</b></p>}
                </div>
                <p className="mt-2 text-[11px] text-mute">
                  Block <Link href={`/explorer?block=${it.blockNumber}`} className="text-volt hover:underline">#{it.blockNumber}</Link> · Tx{" "}
                  <Link href={`/explorer?tx=${it.txHash}`} className="font-mono text-volt hover:underline">{it.txHash.slice(0, 14)}…{it.txHash.slice(-6)}</Link>
                </p>
              </div>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
