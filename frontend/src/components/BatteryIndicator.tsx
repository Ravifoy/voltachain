"use client";
import { motion } from "framer-motion";
import { sohColor } from "@/lib/config";

/** `from` = starting fill % (default 0). Use from={100} to show a battery that drains. */
type Props = { percent: number; size?: "xs" | "sm" | "md" | "xl"; className?: string; showText?: boolean; from?: number };

const SIZES = {
  xs: { w: 40, h: 18, text: "text-[9px]", border: 2 },
  sm: { w: 120, h: 34, text: "text-sm", border: 2 },
  md: { w: 200, h: 54, text: "text-xl", border: 3 },
  xl: { w: 460, h: 130, text: "text-5xl", border: 5 },
} as const;

/**
 * Horizontal battery: body + terminal cap. Fill grows left -> right with the health %,
 * coloured green >=85, lime 70-84, orange 50-69, red <50.
 */
export default function BatteryIndicator({ percent, size = "sm", className = "", showText = true, from = 0 }: Props) {
  const p = Math.max(0, Math.min(100, percent));
  const s = SIZES[size];
  const color = sohColor(p);
  const capW = Math.max(3, s.h * 0.12);
  return (
    <div className={`inline-flex max-w-full items-center ${className}`} style={{ width: s.w + capW }} role="img" aria-label={`Battery health ${Math.round(p)} percent`}>
      <div
        className="relative flex-1 overflow-hidden"
        style={{ height: s.h, borderRadius: s.h * 0.22, border: `${s.border}px solid ${color}`, boxShadow: `0 0 ${size === "xl" ? 28 : 10}px ${color}55`, background: "#0a0f0d" }}
      >
        <motion.div
          className="absolute inset-y-0 left-0"
          initial={{ width: `${from}%` }}
          animate={{ width: `${p}%` }}
          transition={{ duration: from > p ? 1.8 : 1.1, ease: "easeOut" }}
          style={{ background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 14px ${color}` }}
        />
        {/* faint cell dividers for a "battery cell" look */}
        {size !== "xs" && (
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 calc(20% - 2px), #0a0f0d calc(20% - 2px) 20%)" }} />
        )}
        {showText && (
          <div className={`absolute inset-0 flex items-center justify-center font-display font-bold text-white ${s.text}`} style={{ textShadow: "0 1px 6px #000, 0 0 3px #000" }}>
            {Math.round(p)}%
          </div>
        )}
      </div>
      {/* terminal cap */}
      <div style={{ width: capW, height: s.h * 0.4, background: color, borderRadius: "0 3px 3px 0", boxShadow: `0 0 8px ${color}88` }} />
    </div>
  );
}
