"use client";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

/** Loading state = a battery that keeps "charging", with a pulsing bolt. */
export default function ChargingLoader({ label = "Charging…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6" role="status">
      <div className="relative flex items-center">
        <div className="relative h-12 w-28 overflow-hidden rounded-lg border-[3px] border-volt shadow-glow">
          <motion.div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-volt/60 to-volt"
            animate={{ width: ["0%", "100%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div className="absolute inset-0 flex items-center justify-center" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>
            <Zap className="h-6 w-6 fill-bolt text-bolt drop-shadow-[0_0_6px_#ffd60a]" />
          </motion.div>
        </div>
        <div className="h-5 w-1.5 rounded-r bg-volt" />
      </div>
      <p className="font-display text-sm tracking-wide text-volt">{label}</p>
    </div>
  );
}
