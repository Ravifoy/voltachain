"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap, Clock, MapPin, UserRound } from "lucide-react";
import BatteryIndicator from "./BatteryIndicator";
import GradeBadge from "./GradeBadge";
import { VerifiedChip, useName } from "./bits";
import type { BatteryFull } from "@/lib/chain";
import { priceLabel } from "@/lib/config";

/** Same simple formula as the ML API: ~0.6 SoH points lost per month, usable until 50%. */
export const remainingMonths = (soh: number) => Math.round(Math.min(120, Math.max(0, (soh - 50) / 0.6)));

export default function BatteryCard({ item, onBuy, index = 0 }: { item: BatteryFull; onBuy?: (i: BatteryFull) => void; index?: number }) {
  const r = item.reports[item.reports.length - 1];
  const owner = useName(item.owner);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }} className="card card-hover flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-white">{item.battery.batteryType}</p>
          <p className="truncate font-mono text-xs text-mute">{item.battery.serialNumber}</p>
        </div>
        {r && <GradeBadge grade={r.grade} />}
      </div>

      {r ? <BatteryIndicator percent={r.sohPercent} size="md" /> : <p className="text-sm text-mute">No health report yet</p>}

      <div className="flex items-center justify-between text-sm text-slate-300">
        <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-bolt" />{r ? `~${remainingMonths(r.sohPercent)} months left` : "—"}</span>
        <span>{item.battery.capacityMah.toLocaleString()} mAh</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
        <span className="flex items-center gap-1"><UserRound className="h-3.5 w-3.5" />{owner || `${item.owner.slice(0, 6)}…${item.owner.slice(-4)}`}</span>
        {item.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-bolt" />{item.location.city}</span>}
      </div>

      {r && <VerifiedChip />}

      <div className="mt-auto border-t border-line pt-3">
        {item.listing.active && <p className="mb-3 font-display text-sm font-bold text-bolt text-glow-bolt">{priceLabel(item.listing.price)}</p>}
        <div className="flex gap-2">
          <Link href={`/battery/${item.battery.tokenId}`} className="btn-ghost flex-1">Details</Link>
          {item.listing.active && onBuy && (
            <button onClick={() => onBuy(item)} className="btn-primary flex-1"><Zap className="h-4 w-4" /> Buy</button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
