"use client";
import { useEffect, useState } from "react";
import { BadgeCheck, ShieldX, Cpu, Send, UserPlus } from "lucide-react";
import BatteryIndicator from "@/components/BatteryIndicator";
import GradeBadge from "@/components/GradeBadge";
import TxPanel, { TxState } from "@/components/TxPanel";
import ChargingLoader from "@/components/ChargingLoader";
import { AddressChip, Hash, PageTitle } from "@/components/bits";
import { Battery, friendlyError, loadAllBatteries, readProvider, runTx, simulate, writeContract } from "@/lib/chain";
import { inr } from "@/lib/config";
import { MlResult, Readings, ReportJson, hashReport, predict, saveReport } from "@/lib/report";
import { useWallet } from "@/lib/wallet";
import { isAddress } from "ethers";

const SAMPLE: Omit<Readings, "nominal_capacity"> = { cycle_count: 450, age_months: 24, internal_resistance: 55, avg_temperature: 32, measured_capacity: 2400 };
const FIELDS: [keyof Readings, string, string][] = [
  ["cycle_count", "Charge cycles", "times fully charged"], ["age_months", "Age", "months"],
  ["internal_resistance", "Internal resistance", "milli-ohm"], ["avg_temperature", "Average temperature", "°C"],
  ["measured_capacity", "Measured capacity", "mAh today"], ["nominal_capacity", "Original capacity", "mAh when new"],
];

export default function Inspector() {
  const { address, connect, chainOk, switchNetwork, isInspector, isAdmin } = useWallet();
  const [batteries, setBatteries] = useState<Battery[]>([]);
  const [tokenId, setTokenId] = useState<number>(1);
  const [vals, setVals] = useState<Record<keyof Readings, string>>({ ...Object.fromEntries(Object.entries(SAMPLE).map(([k, v]) => [k, String(v)])), nominal_capacity: "3000" } as any);
  const [ml, setMl] = useState<MlResult | null>(null);
  const [mlBusy, setMlBusy] = useState(false);
  const [mlErr, setMlErr] = useState<string | null>(null);
  const [report, setReport] = useState<{ json: ReportJson; hash: string } | null>(null);
  const [state, setState] = useState<TxState>({ status: "idle" });
  // admin panel
  const [newInsp, setNewInsp] = useState("");
  const [adminState, setAdminState] = useState<TxState>({ status: "idle" });

  useEffect(() => {
    loadAllBatteries().then((all) => { const b = all.map((x) => x.battery); setBatteries(b); if (b[0]) { setTokenId(b[0].tokenId); setVals((v) => ({ ...v, nominal_capacity: String(b[0].capacityMah) })); } }).catch(() => {});
  }, []);

  const pick = (id: number) => {
    setTokenId(id); setMl(null); setReport(null); setState({ status: "idle" });
    const b = batteries.find((x) => x.tokenId === id);
    if (b) setVals((v) => ({ ...v, nominal_capacity: String(b.capacityMah) }));
  };
  const readings = (): Readings => Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Number(v)])) as any;
  const valid = Object.values(vals).every((v) => v !== "" && Number(v) >= 0) && Number(vals.measured_capacity) > 0;

  const analyze = async () => {
    setMlBusy(true); setMlErr(null); setReport(null); setState({ status: "idle" });
    try { setMl(await predict(readings())); } catch (e: any) { setMlErr(e.message?.includes("fetch") ? "Can't reach the ML service on port 8000. Is it running?" : e.message); }
    setMlBusy(false);
  };

  const submit = async () => {
    if (!ml || !address) return;
    const b = batteries.find((x) => x.tokenId === tokenId)!;
    // 1. Build the full report JSON (this is what gets hashed).
    const json: ReportJson = { serialNumber: b.serialNumber, batteryType: b.batteryType, tokenId, readings: readings(), ml, inspector: address, timestamp: new Date().toISOString() };
    // 2. keccak256 of the JSON -> the fingerprint stored on-chain.
    const hash = hashReport(json);
    setReport({ json, hash });
    setState({ status: "pending", label: "Charging transaction…" });
    const args = [tokenId, Math.round(ml.soh_percent), ml.grade, Math.round(readings().cycle_count), hash];
    try {
      // Access-control demo: dry-run first so we can show the exact revert reason for non-inspectors.
      const revertReason = await simulate(address, "addHealthReport", args);
      const c = await writeContract();
      if (revertReason) {
        // Send the tx ANYWAY (fixed gas limit skips MetaMask's pre-check) so it is mined and reverts on-chain.
        let failedTx = null;
        try { await c.addHealthReport(...args, { gasLimit: 300000 }); } catch { /* expected: reverted */ }
        await new Promise((r) => setTimeout(r, 800));
        const blk = await readProvider.getBlock("latest", true);
        const t = blk?.prefetchedTransactions.find((x) => x.from.toLowerCase() === address.toLowerCase());
        if (t && blk) failedTx = { hash: t.hash, blockNumber: blk.number, blockHash: blk.hash!, gasUsed: "—", status: 0 };
        setState({ status: "error", message: `Rejected by the smart contract: "${revertReason}"`, tx: failedTx });
        return;
      }
      // 3. Save the JSON in the backend (keyed by hash), 4. store the hash on-chain.
      await saveReport(hash, json);
      const tx = await runTx(() => c.addHealthReport(...args));
      setState({ status: "success", title: "Health report recorded on-chain", tx });
    } catch (e) { setState({ status: "error", message: friendlyError(e) }); }
  };

  const addInspector = async () => {
    setAdminState({ status: "pending" });
    try {
      const c = await writeContract();
      setAdminState({ status: "success", title: "Inspector approved", tx: await runTx(() => c.addInspector(newInsp.trim())) });
    } catch (e) { setAdminState({ status: "error", message: friendlyError(e) }); }
  };

  return (
    <>
      <PageTitle icon={<BadgeCheck className="h-8 w-8 text-volt" />} title="Inspector desk" sub="Enter the readings from your test. The AI turns them into a grade; the signed report fingerprint is then stored on the blockchain." />

      <div className={`card mb-6 flex flex-wrap items-center gap-3 ${address && !isInspector ? "border-bolt/50" : ""}`}>
        {!address ? <><span className="text-mute">Connect your wallet to submit reports.</span><button className="btn-primary" onClick={connect}>Connect wallet</button></>
          : isInspector ? <><BadgeCheck className="h-5 w-5 text-volt" /><span>Connected as a <b className="text-volt">verified inspector</b></span><AddressChip address={address} /></>
          : <><ShieldX className="h-5 w-5 text-bolt" /><span className="text-slate-200">This wallet is <b className="text-bolt">not</b> a verified inspector. You can still try to submit — the contract will reject it (access-control demo).</span><AddressChip address={address} /></>}
        {address && !chainOk && <button className="btn-bolt" onClick={switchNetwork}>Switch network</button>}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="card space-y-4">
          <div>
            <label className="label">Battery</label>
            <select className="input" value={tokenId} onChange={(e) => pick(Number(e.target.value))}>
              {batteries.map((b) => <option key={b.tokenId} value={b.tokenId}>#{b.tokenId} · {b.serialNumber} · {b.batteryType}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map(([k, label, hint]) => (
              <div key={k}>
                <label className="label">{label}</label>
                <input className="input" type="number" value={vals[k]} onChange={(e) => { setVals({ ...vals, [k]: e.target.value }); setMl(null); setReport(null); }} />
                <p className="mt-0.5 text-[11px] text-mute">{hint}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary" disabled={!valid || mlBusy || batteries.length === 0} onClick={analyze}><Cpu className="h-4 w-4" /> Analyze with AI</button>
            <button className="btn-ghost" onClick={() => { setVals((v) => ({ ...v, ...Object.fromEntries(Object.entries(SAMPLE).map(([k, x]) => [k, String(x)])) })); setMl(null); }}>Fill sample readings</button>
          </div>
          {mlErr && <p className="text-sm text-redx">{mlErr}</p>}
        </div>

        <div className="space-y-4">
          {mlBusy && <div className="card"><ChargingLoader label="Analyzing battery…" /></div>}
          {ml && !mlBusy && (
            <div className="card space-y-4 border-volt/40">
              <div className="flex items-center gap-4"><GradeBadge grade={ml.grade} big /><BatteryIndicator percent={ml.soh_percent} size="md" /></div>
              <p className="text-lg text-slate-100">{ml.explanation}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-ink/70 p-3"><p className="label">Life left</p><p className="font-display text-lg text-white">~{ml.remaining_life_months} months</p></div>
                <div className="rounded-xl bg-ink/70 p-3"><p className="label">Fair price</p><p className="font-display text-lg text-bolt">{inr(ml.suggested_price_inr)}</p></div>
              </div>
              <button className="btn-bolt w-full" disabled={!address || !chainOk || state.status === "pending"} onClick={submit}><Send className="h-4 w-4" /> Submit report to blockchain</button>
              {!address && <p className="text-xs text-mute">Connect your wallet first.</p>}
            </div>
          )}
          {report && (
            <div className="card space-y-2">
              <p className="label">Report fingerprint (keccak256 of the report JSON)</p>
              <Hash value={report.hash} />
              <details className="text-xs text-mute"><summary className="cursor-pointer">Show report JSON</summary><pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-ink p-3 text-slate-300">{JSON.stringify(report.json, null, 2)}</pre></details>
            </div>
          )}
          <TxPanel state={state} />
        </div>
      </div>

      {isAdmin && (
        <div className="card mt-8 max-w-xl space-y-3">
          <h2 className="flex items-center gap-2 text-lg text-white"><UserPlus className="h-5 w-5 text-volt" /> Admin: approve a new inspector</h2>
          <input className="input font-mono" placeholder="0x… wallet address" value={newInsp} onChange={(e) => setNewInsp(e.target.value)} />
          <button className="btn-primary" disabled={!isAddress(newInsp.trim())} onClick={addInspector}>Add inspector</button>
          <TxPanel state={adminState} />
        </div>
      )}
    </>
  );
}
