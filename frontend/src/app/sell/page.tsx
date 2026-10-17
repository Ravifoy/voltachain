"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PackagePlus, Tag, MapPin, UserRound } from "lucide-react";
import BatteryIndicator from "@/components/BatteryIndicator";
import GradeBadge from "@/components/GradeBadge";
import TxPanel, { TxState } from "@/components/TxPanel";
import { PageTitle } from "@/components/bits";
import { BatteryFull, clearNameCache, friendlyError, getName, loadAllBatteries, runTx, writeContract } from "@/lib/chain";
import { CITIES } from "@/lib/cities";
import { inrToEth, priceLabel } from "@/lib/config";
import { fetchReport } from "@/lib/report";
import { useWallet } from "@/lib/wallet";
import { parseEther } from "ethers";

/** Owner picks the city where the battery is; it appears on the marketplace map. */
function LocationPicker({ item, onDone }: { item: BatteryFull; onDone: () => void }) {
  const [city, setCity] = useState(item.location?.city ?? "Mumbai");
  const [state, setState] = useState<TxState>({ status: "idle" });
  const save = async () => {
    setState({ status: "pending" });
    try {
      const [lat, lng] = CITIES[city];
      const c = await writeContract();
      const tx = await runTx(() => c.setLocation(item.battery.tokenId, city, Math.round(lat * 1e6), Math.round(lng * 1e6)));
      setState({ status: "success", title: "Location saved", tx });
      onDone();
    } catch (e) { setState({ status: "error", message: friendlyError(e) }); }
  };
  return (
    <div className="space-y-2">
      <label className="label flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Battery location {item.location && <span className="normal-case text-volt">· now: {item.location.city}</span>}</label>
      <div className="flex gap-2">
        <select className="input" value={city} onChange={(e) => setCity(e.target.value)}>{Object.keys(CITIES).map((c) => <option key={c}>{c}</option>)}</select>
        <button className="btn-ghost shrink-0" disabled={state.status === "pending"} onClick={save}>Save</button>
      </div>
      <TxPanel state={state} />
    </div>
  );
}

function ListRow({ item, onDone }: { item: BatteryFull; onDone: () => void }) {
  const r = item.reports[item.reports.length - 1];
  const [price, setPrice] = useState("");
  const [state, setState] = useState<TxState>({ status: "idle" });
  // Pre-fill with the ML-suggested price (saved inside the report JSON).
  useEffect(() => { if (r) fetchReport(r.reportHash).then((j) => j && setPrice(String(j.ml.suggested_price_inr))); }, [r?.reportHash]);

  const list = async () => {
    setState({ status: "pending" });
    try {
      const c = await writeContract();
      const tx = await runTx(() => c.listForSale(item.battery.tokenId, parseEther(inrToEth(Number(price)))));
      setState({ status: "success", title: "Listed for sale!", tx });
      onDone();
    } catch (e) { setState({ status: "error", message: friendlyError(e) }); }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="truncate font-display text-sm text-white">{item.battery.batteryType}</p><p className="font-mono text-xs text-mute">{item.battery.serialNumber}</p></div>
        {r && <GradeBadge grade={r.grade} />}
      </div>
      {r && <BatteryIndicator percent={r.sohPercent} size="sm" />}
      <LocationPicker item={item} onDone={onDone} />
      {!r && <p className="text-sm text-bolt">Waiting for a verified inspector to add a health report before you can list it.</p>}
      {r && item.listing.active && <p className="text-sm text-bolt">Listed at {priceLabel(item.listing.price)}</p>}
      {r && !item.listing.active && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[8rem] flex-1">
            <label className="label">Price in ₹</label>
            <input className="input" type="number" min={1} value={price} onChange={(e) => setPrice(e.target.value)} />
            {Number(price) > 0 && <p className="mt-1 text-xs text-mute">≈ {inrToEth(Number(price))} ETH</p>}
          </div>
          <button className="btn-bolt" disabled={!(Number(price) > 0) || state.status === "pending"} onClick={list}><Tag className="h-4 w-4" /> List for sale</button>
        </div>
      )}
      <TxPanel state={state} />
    </div>
  );
}

export default function Sell() {
  const { address, connect, chainOk, switchNetwork } = useWallet();
  const [myName, setMyName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [nameState, setNameState] = useState<TxState>({ status: "idle" });
  useEffect(() => { if (address) getName(address).then((n) => { setMyName(n); setNameInput(n); }); }, [address]);
  const saveName = async () => {
    setNameState({ status: "pending" });
    try {
      const c = await writeContract();
      const tx = await runTx(() => c.setName(nameInput.trim()));
      clearNameCache(); setMyName(nameInput.trim());
      setNameState({ status: "success", title: "Name saved on-chain", tx });
    } catch (e) { setNameState({ status: "error", message: friendlyError(e) }); }
  };
  const [serial, setSerial] = useState("");
  const [type, setType] = useState("Li-ion 18650 cell");
  const [cap, setCap] = useState("3000");
  const [state, setState] = useState<TxState>({ status: "idle" });
  const [mine, setMine] = useState<BatteryFull[]>([]);

  const reload = useCallback(() => {
    loadAllBatteries().then((all) => setMine(all.filter((b) => address && b.owner.toLowerCase() === address.toLowerCase()))).catch(() => {});
  }, [address]);
  useEffect(reload, [reload]);

  const register = async () => {
    setState({ status: "pending", label: "Charging transaction…" });
    try {
      const c = await writeContract();
      const tx = await runTx(() => c.registerBattery(serial.trim(), type, Number(cap)));
      setState({ status: "success", title: "Battery registered!", tx });
      setSerial(""); reload();
    } catch (e) { setState({ status: "error", message: friendlyError(e) }); }
  };

  const ready = serial.trim() && type.trim() && Number(cap) > 0;

  return (
    <>
      <PageTitle icon={<PackagePlus className="h-8 w-8 text-volt" />} title="Sell a battery" sub="Register your battery, get it inspected, then list it. Buyers can see its verified health history." />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card space-y-3">
            <h2 className="flex items-center gap-2 text-lg text-white"><UserRound className="h-5 w-5 text-volt" /> Your name <span className="text-xs text-mute">(shown to buyers, optional)</span></h2>
            <div className="flex gap-2">
              <input className="input" value={nameInput} maxLength={32} placeholder="e.g. GreenCell Recyclers" onChange={(e) => setNameInput(e.target.value)} />
              <button className="btn-ghost shrink-0" disabled={!address || !chainOk || !nameInput.trim() || nameInput.trim() === myName || nameState.status === "pending"} onClick={saveName}>Save name</button>
            </div>
            <TxPanel state={nameState} />
          </div>
          <div className="card space-y-4">
            <h2 className="text-lg text-white">1 · Register your battery</h2>
            <div><label className="label">Serial number (must be unique)</label><input className="input" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. NMC-2024-00123" /></div>
            <div><label className="label">Battery type</label><input className="input" value={type} onChange={(e) => setType(e.target.value)} /></div>
            <div><label className="label">Capacity (mAh)</label><input className="input" type="number" min={1} value={cap} onChange={(e) => setCap(e.target.value)} /></div>
            {!address ? <button className="btn-primary w-full" onClick={connect}>Connect wallet</button>
              : !chainOk ? <button className="btn-bolt w-full" onClick={switchNetwork}>Switch to the local network</button>
              : <button className="btn-primary w-full" disabled={!ready || state.status === "pending"} onClick={register}>Register battery</button>}
          </div>
          <TxPanel state={state}>
            <p className="rounded-lg bg-ink/70 p-3 text-sm text-slate-300">Next: ask a verified inspector to test it. Once a report exists you can list it on the right.</p>
          </TxPanel>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg text-white">2 · Your batteries</h2>
          {!address && <p className="text-mute">Connect your wallet to see your batteries.</p>}
          {address && mine.length === 0 && <p className="text-mute">You don't own any batteries yet. Register one on the left — or <Link href="/marketplace" className="text-volt">browse the marketplace</Link>.</p>}
          {mine.map((m) => <ListRow key={m.battery.tokenId} item={m} onDone={reload} />)}
        </div>
      </div>
    </>
  );
}
