"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, FileSearch, Pencil, RotateCcw } from "lucide-react";
import BatteryIndicator from "@/components/BatteryIndicator";
import ChargingLoader from "@/components/ChargingLoader";
import { ChainDown, PageTitle } from "@/components/bits";
import { Battery, Report, loadAllBatteries } from "@/lib/chain";
import { fetchReport, hashReport } from "@/lib/report";

type Entry = { battery: Battery; report: Report; n: number };

/** Hash with every character that differs from `other` highlighted in red. */
function DiffHash({ value, other }: { value: string; other: string }) {
  return (
    <span className="hash">
      {value.split("").map((ch, i) => (
        <span key={i} className={ch.toLowerCase() === other[i]?.toLowerCase() ? "" : "rounded bg-redx/30 text-redx"}>{ch}</span>
      ))}
    </span>
  );
}

function VerifyInner() {
  const qHash = useSearchParams().get("hash");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sel, setSel] = useState<string>("");
  const [original, setOriginal] = useState("");
  const [text, setText] = useState("");
  const [missing, setMissing] = useState(false);
  const [result, setResult] = useState<null | { match: boolean; computed: string; key: number }>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);

  useEffect(() => {
    loadAllBatteries().then((all) => {
      const list: Entry[] = all.flatMap((b) => b.reports.map((r, i) => ({ battery: b.battery, report: r, n: i + 1 })));
      setEntries(list);
      const initial = list.find((e) => e.report.reportHash === qHash) ?? list[0];
      if (initial) setSel(initial.report.reportHash);
    }).catch((e) => setErr(e.shortMessage || e.message));
  }, [qHash]);

  const current = useMemo(() => entries?.find((e) => e.report.reportHash === sel), [entries, sel]);

  // Load the stored JSON (from the backend) whenever the selected report changes.
  useEffect(() => {
    if (!sel) return;
    setResult(null); setParseErr(null); setMissing(false);
    fetchReport(sel).then((j) => {
      if (!j) { setMissing(true); setText(""); setOriginal(""); return; }
      const pretty = JSON.stringify(j, null, 2);
      setText(pretty); setOriginal(pretty);
    });
  }, [sel]);

  const verify = () => {
    setParseErr(null);
    try {
      // Re-hash exactly like the inspector did: keccak256(compact JSON).
      const computed = hashReport(JSON.parse(text));
      setResult({ match: computed.toLowerCase() === sel.toLowerCase(), computed, key: Date.now() });
    } catch { setParseErr("That isn't valid JSON — fix it and try again."); }
  };

  // One-click tamper for the demo: change soh_percent to 95.
  const tamper = () => {
    try { const j = JSON.parse(text); if (j.ml) j.ml.soh_percent = 95; setText(JSON.stringify(j, null, 2)); setResult(null); } catch { /* ignore */ }
  };

  if (err) return <ChainDown message={err} />;
  if (!entries) return <ChargingLoader label="Loading reports…" />;

  return (
    <>
      <PageTitle icon={<FileSearch className="h-8 w-8 text-volt" />} title="Tamper check" sub="The blockchain stores only a fingerprint (hash) of each report. Re-hash the report below and compare. Change even one digit and the fingerprint changes completely." />
      {entries.length === 0 && <p className="text-mute">No health reports on-chain yet.</p>}
      {entries.length > 0 && (
        <div className="space-y-6">
          <div className="card">
            <label className="label">Choose a report</label>
            <select className="input" value={sel} onChange={(e) => setSel(e.target.value)}>
              {entries.map((e) => <option key={e.report.reportHash} value={e.report.reportHash}>#{e.battery.tokenId} {e.battery.serialNumber} — report {e.n} (SoH {e.report.sohPercent}%, grade {e.report.grade}) — block {e.report.blockNumber}</option>)}
            </select>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="card space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg text-white">Stored report (off-chain JSON)</h2>
                <div className="flex gap-2">
                  <button className="btn-ghost px-3 py-1.5 text-xs" onClick={tamper}><Pencil className="h-3.5 w-3.5" /> Tamper: SoH → 95</button>
                  <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => { setText(original); setResult(null); }}><RotateCcw className="h-3.5 w-3.5" /> Reset</button>
                </div>
              </div>
              {missing ? <p className="text-sm text-bolt">The JSON for this report isn't in the backend (is the ML server running?).</p> : (
                <textarea className="input h-96 resize-y font-mono text-xs leading-relaxed" spellCheck={false} value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} />
              )}
              {parseErr && <p className="text-sm text-redx">{parseErr}</p>}
            </div>

            <div className="space-y-4">
              <div className="card space-y-3">
                <h2 className="text-lg text-white">Fingerprint stored on the blockchain</h2>
                <div className="rounded-xl bg-ink/70 p-3">
                  {result && !result.match ? <DiffHash value={sel} other={result.computed} /> : <span className="hash">{sel}</span>}
                </div>
                <p className="text-xs text-mute">Added by inspector in block #{current?.report.blockNumber}. Nobody can change it afterwards.</p>
                <button className="btn-primary w-full" disabled={!text} onClick={verify}><ShieldCheck className="h-4 w-4" /> Verify integrity</button>
              </div>

              {result && (
                <motion.div key={result.key} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                  className={`card space-y-4 ${result.match ? "border-volt shadow-glow" : "border-redx shadow-[0_0_24px_rgba(239,68,68,0.45)] flicker"}`}>
                  <div className="flex flex-wrap items-center gap-4">
                    {result.match ? <ShieldCheck className="h-10 w-10 text-volt" /> : <ShieldAlert className="h-10 w-10 text-redx" />}
                    <div>
                      <p className={`font-display text-xl font-bold ${result.match ? "text-volt text-glow" : "text-redx"}`}>{result.match ? "MATCH — data is authentic" : "MISMATCH — data has been tampered with"}</p>
                      <p className="text-sm text-slate-300">{result.match ? "The report hashes to exactly the value stored on-chain." : "The edited report produces a completely different fingerprint."}</p>
                    </div>
                  </div>
                  {result.match ? <BatteryIndicator percent={100} size="md" /> : <BatteryIndicator percent={8} from={100} size="md" />}
                  <div className="space-y-2">
                    <div className="rounded-lg bg-ink/70 p-3"><p className="label">Recomputed hash (from the JSON on the left)</p>{result.match ? <span className="hash text-volt">{result.computed}</span> : <DiffHash value={result.computed} other={sel} />}</div>
                    <div className="rounded-lg bg-ink/70 p-3"><p className="label">Hash stored on-chain</p><span className="hash">{sel}</span></div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Verify() {
  return <Suspense fallback={<ChargingLoader label="Loading…" />}><VerifyInner /></Suspense>;
}
