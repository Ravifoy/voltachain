"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Zap, Menu, X, AlertTriangle } from "lucide-react";
import BatteryIndicator from "./BatteryIndicator";
import { useWallet } from "@/lib/wallet";
import { roleOf, short } from "@/lib/config";

const LINKS = [
  ["/marketplace", "Marketplace"], ["/sell", "Sell"], ["/inspector", "Inspector"],
  ["/explorer", "Explorer"], ["/verify", "Verify"],
];

export default function Navbar() {
  const path = usePathname();
  const { address, chainOk, connect, switchNetwork, error } = useWallet();
  const [open, setOpen] = useState(false);
  const role = roleOf(address);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold text-white">
          <motion.span animate={{ filter: ["drop-shadow(0 0 3px #ffd60a)", "drop-shadow(0 0 12px #ffd60a)", "drop-shadow(0 0 3px #ffd60a)"] }} transition={{ duration: 2, repeat: Infinity }}>
            <Zap className="h-6 w-6 fill-bolt text-bolt" />
          </motion.span>
          <span>Volta<span className="text-volt text-glow">Chain</span></span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${path.startsWith(href) ? "bg-volt/15 text-volt" : "text-slate-300 hover:text-volt"}`}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {address && !chainOk ? (
            <button onClick={switchNetwork} className="btn bg-bolt text-ink text-xs"><AlertTriangle className="h-4 w-4" /> Switch network</button>
          ) : (
            <button onClick={address ? undefined : connect} className="btn-ghost gap-2.5 px-3 text-xs" title={address ?? "Connect your wallet"}>
              {/* mini battery: empty = disconnected, full green = connected */}
              <BatteryIndicator percent={address ? 100 : 0} size="xs" showText={false} />
              {address ? <span>{role ? `${role} · ` : ""}{short(address, 6, 4)}</span> : <span>Connect wallet</span>}
            </button>
          )}
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
      </div>
      {error && <p className="bg-redx/20 px-4 py-1 text-center text-xs text-redx">{error}</p>}
      {open && (
        <nav className="flex flex-col border-t border-line px-4 py-2 md:hidden">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="py-2 text-slate-200">{label}</Link>
          ))}
        </nav>
      )}
    </header>
  );
}
