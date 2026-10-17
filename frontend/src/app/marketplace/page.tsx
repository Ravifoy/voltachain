"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ShoppingBag, LayoutGrid, Map as MapIcon } from "lucide-react";
import BatteryCard from "@/components/BatteryCard";
import BuyModal from "@/components/BuyModal";
import ChargingLoader from "@/components/ChargingLoader";
import { ChainDown, PageTitle } from "@/components/bits";
import { BatteryFull, loadListed } from "@/lib/chain";

// Leaflet touches `window`, so load the map only in the browser.
const BatteryMap = dynamic(() => import("@/components/BatteryMap"), { ssr: false, loading: () => <ChargingLoader label="Loading map…" /> });

export default function Marketplace() {
  const [view, setView] = useState<"grid" | "map">("grid");
  const [items, setItems] = useState<BatteryFull[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [buying, setBuying] = useState<BatteryFull | null>(null);

  const load = useCallback(() => {
    loadListed().then((l) => { setItems(l); setErr(null); }).catch((e) => setErr(e.message));
  }, []);
  useEffect(load, [load]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("view") === "map") setView("map"); }, []);

  return (
    <>
      <PageTitle icon={<ShoppingBag className="h-8 w-8 text-volt" />} title="Marketplace" sub="Every battery here has a health report signed by a verified inspector and stored on the blockchain." />
      <div className="mb-5 inline-flex rounded-xl border border-line p-1">
        {([["grid", "List", LayoutGrid], ["map", "Map", MapIcon]] as const).map(([v, label, Icon]) => (
          <button key={v} onClick={() => setView(v)} className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${view === v ? "bg-volt text-ink" : "text-slate-300 hover:text-volt"}`}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>
      {err && <ChainDown message={err} />}
      {!err && !items && <ChargingLoader label="Loading batteries…" />}
      {items && items.length === 0 && <p className="text-mute">No batteries are listed right now. Sell one from the Sell page!</p>}
      {items && view === "map" && (
        <div className="mb-6">
          <BatteryMap items={items} />
          {items.some((i) => !i.location) && <p className="mt-2 text-xs text-mute">{items.filter((i) => !i.location).length} listing(s) have no location set and are not on the map.</p>}
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items?.map((it, i) => <BatteryCard key={it.battery.tokenId} item={it} index={i} onBuy={setBuying} />)}
      </div>
      {buying && <BuyModal item={buying} onClose={() => { setBuying(null); load(); }} onDone={load} />}
    </>
  );
}
