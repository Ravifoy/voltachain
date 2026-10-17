"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, ClipboardCheck, Link2, ShoppingCart, Recycle, Leaf, FileCheck2, ArrowRight } from "lucide-react";
import BatteryIndicator from "@/components/BatteryIndicator";
import { Counter } from "@/components/bits";
import { loadAllBatteries } from "@/lib/chain";

const STEPS = [
  { icon: ClipboardCheck, title: "Inspect", text: "A verified inspector tests the battery. AI turns the readings into a simple A–D grade." },
  { icon: Link2, title: "Verify on chain", text: "A fingerprint of the report is stored on the blockchain. Nobody can quietly change it." },
  { icon: ShoppingCart, title: "Buy with trust", text: "Buyers see real health, full history and a fair price, then pay the seller directly." },
];

export default function Home() {
  const [pct, setPct] = useState(0);
  const [stats, setStats] = useState({ batteries: 0, reports: 0 });

  // Hero battery: charge to 100%, hold, drain, repeat.
  useEffect(() => {
    let alive = true;
    const loop = () => { if (!alive) return; setPct(100); setTimeout(() => alive && setPct(0), 3600); };
    loop(); const t = setInterval(loop, 5200);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    loadAllBatteries().then((all) => setStats({ batteries: all.length, reports: all.reduce((s, b) => s + b.reports.length, 0) })).catch(() => {});
  }, []);

  return (
    <div className="space-y-24">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <span className="chip"><Zap className="h-3.5 w-3.5 fill-bolt text-bolt" /> Verified second-hand batteries</span>
          <h1 className="text-4xl font-black leading-tight text-white md:text-5xl">
            Second life for every battery. <span className="text-volt text-glow">Verified on blockchain.</span>
          </h1>
          <p className="max-w-xl text-lg text-slate-300">Used batteries often have years of life left, but nobody trusts them. VoltaChain stores tamper-proof health reports so you can see exactly what you're buying.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/marketplace" className="btn-primary px-6 py-3 text-base"><Zap className="h-4 w-4" /> Browse batteries</Link>
            <Link href="/explorer" className="btn-ghost px-6 py-3 text-base">See the blockchain <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </motion.div>
        <div className="flex flex-col items-center gap-4 overflow-hidden py-6">
          <BatteryIndicator percent={pct} size="xl" className="origin-center scale-[0.62] sm:scale-90 lg:scale-100" />
          <p className="font-display text-sm tracking-widest text-mute">CHARGING THE CIRCULAR ECONOMY</p>
        </div>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Recycle, label: "Batteries saved from the bin", value: stats.batteries, suffix: "" },
          { icon: Leaf, label: "kg CO₂ saved (estimate)", value: stats.batteries * 12, suffix: "" },
          { icon: FileCheck2, label: "Verified health reports", value: stats.reports, suffix: "" },
        ].map((s) => (
          <div key={s.label} className="card text-center">
            <s.icon className="mx-auto h-7 w-7 text-volt" />
            <p className="mt-2 font-display text-4xl font-bold text-white text-glow"><Counter to={s.value} suffix={s.suffix} /></p>
            <p className="mt-1 text-sm text-mute">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Problem */}
      <section className="card border-bolt/30">
        <h2 className="text-2xl text-white">The <span className="text-bolt text-glow-bolt">problem</span></h2>
        <p className="mt-3 max-w-3xl text-slate-300">Millions of batteries are thrown away while they can still power something for years. Buyers can't tell a healthy used battery from a worn-out one, and a seller's word is not proof. So good batteries get scrapped, and e-waste grows.</p>
      </section>

      {/* How it works */}
      <section>
        <h2 className="mb-10 text-center text-2xl text-white">How it works</h2>
        <div className="relative grid gap-8 md:grid-cols-3">
          {/* glowing energy line joining the steps */}
          <div className="wire-h absolute left-[16%] right-[16%] top-8 hidden md:block" />
          {STEPS.map((s, i) => (
            <motion.div key={s.title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }} className="relative flex flex-col items-center text-center">
              <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-volt bg-ink shadow-glow"><s.icon className="h-7 w-7 text-volt" /></div>
              <p className="mt-4 font-display text-xs tracking-widest text-bolt">STEP {i + 1}</p>
              <h3 className="mt-1 text-xl text-white">{s.title}</h3>
              <p className="mt-2 max-w-xs text-sm text-slate-300">{s.text}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}
