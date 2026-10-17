"use client";
// Small reusable pieces: address chip, copyable hash, verified chip, animated counter, page title, chain-down notice.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";
import { Copy, Check, Link2, Zap } from "lucide-react";
import { roleOf, short } from "@/lib/config";
import { CONTRACT_ADDRESS, getName } from "@/lib/chain";

/** Wallet name (if the owner set one), or the demo role label, plus the address; links to the explorer. */
export function useName(address: string) {
  const [name, setName] = useState("");
  useEffect(() => { let on = true; getName(address).then((n) => on && setName(n)); return () => { on = false; }; }, [address]);
  return name;
}

export function AddressChip({ address, full = false }: { address: string; full?: boolean }) {
  const name = useName(address);
  const role = address.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() ? "VoltaChain contract" : name || roleOf(address);
  return (
    <Link href={`/explorer?address=${address}`} className="inline-flex flex-wrap items-center gap-1.5 font-mono text-xs text-slate-200 hover:text-volt" title={address}>
      {role && <span className="rounded bg-volt/15 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-volt">{role}</span>}
      <span className={full ? "break-all" : ""}>{full ? address : short(address, 6, 4)}</span>
    </Link>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}
      className="text-mute hover:text-volt" aria-label="Copy"
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Full hash with a copy button. */
export function Hash({ value, href }: { value: string; href?: string }) {
  return (
    <span className="inline-flex items-start gap-2">
      {href ? <Link href={href} className="hash text-volt hover:underline">{value}</Link> : <span className="hash">{value}</span>}
      <CopyButton text={value} />
    </span>
  );
}

export function VerifiedChip({ label = "Verified on blockchain" }: { label?: string }) {
  return <span className="chip"><Link2 className="h-3.5 w-3.5" />{label}</span>;
}

/** Number that counts up when scrolled into view. */
export function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const c = animate(0, to, { duration: 1.6, ease: "easeOut", onUpdate: (x) => setV(Math.round(x)) });
    return () => c.stop();
  }, [inView, to]);
  return <span ref={ref}>{v.toLocaleString("en-IN")}{suffix}</span>;
}

export function PageTitle({ title, sub, icon }: { title: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="flex items-center gap-3 text-3xl font-bold text-white md:text-4xl">
        {icon ?? <Zap className="h-8 w-8 fill-bolt text-bolt" />} {title}
      </h1>
      {sub && <p className="mt-2 max-w-2xl text-mute">{sub}</p>}
    </div>
  );
}

export function ChainDown({ message }: { message: string }) {
  return (
    <div className="card border-bolt/50 text-sm text-slate-200">
      <p className="font-display text-bolt">Can't reach the local blockchain</p>
      <p className="mt-1 text-mute">{message} Make sure <code className="text-volt">npx hardhat node</code> is running and the contract is deployed (see README).</p>
    </div>
  );
}
