"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Brain, ShieldCheck, ShieldAlert, Zap, Clock, Gauge, Repeat } from "lucide-react";
import BatteryIndicator from "@/components/BatteryIndicator";
import GradeBadge from "@/components/GradeBadge";
import BuyModal from "@/components/BuyModal";
import Timeline from "@/components/Timeline";
import BatteryPhoto from "@/components/BatteryPhoto";
import ChargingLoader from "@/components/ChargingLoader";
import { AddressChip, ChainDown } from "@/components/bits";
import { remainingMonths } from "@/components/BatteryCard";
import { BatteryFull, TimelineItem, loadBattery, loadTimeline } from "@/lib/chain";
import { fetchReport, hashReport, ReportJson } from "@/lib/report";
import { priceLabel, inr } from "@/lib/config";

export default function BatteryDetail() {
  const id = Number(useParams<{ id: string }>().id);
  const [data, setData] = useState<BatteryFull | null>(null);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [report, setReport] = useState<ReportJson | null>(null);
  const [intact, setIntact] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await loadBattery(id);
      setData(d);
      setTimeline(await loadTimeline(id));
      const last = d.reports[d.reports.length - 1];
      if (last) {
        // Fetch the off-chain JSON and re-hash it: does it still match the on-chain hash?
        const json = await fetchReport(last.reportHash);
        setReport(json);
        setIntact(json ? hashReport(json).toLowerCase() === last.reportHash.toLowerCase() : null);
      }
    } catch (e: any) { setErr(e.shortMessage || e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (err) return <ChainDown message={`Battery #${id} could not be loaded (${err}).`} />;
  if (!data) return <ChargingLoader label="Loading battery…" />;

  const { battery: b, reports, listing } = data;
  const last = reports[reports.length - 1];
  const reportInfo = Object.fromEntries(reports.map((r) => [r.reportHash, { soh: r.sohPercent, grade: r.grade }]));

  return (
    <div className="space-y-10">
      <section className="card relative overflow-hidden border-volt/30">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 space-y-3">
            <p className="font-mono text-xs text-mute">Battery #{b.tokenId} · {b.serialNumber}</p>
            <h1 className="text-3xl font-bold text-white">{b.batteryType}</h1>
            <p className="text-mute">{b.capacityMah.toLocaleString()} mAh nominal · Owner <AddressChip address={data.owner} />{data.location && <> · 📍 {data.location.city}</>}</p>
            {last && (
              <div className="flex flex-wrap items-center gap-3">
                <GradeBadge grade={last.grade} big />
                {intact === true && <span className="chip"><ShieldCheck className="h-4 w-4" /> Report authentic (hash matches chain)</span>}
                {intact === false && <span className="chip border-redx/60 bg-redx/10 text-redx"><ShieldAlert className="h-4 w-4" /> Report data does not match chain!</span>}
                <Link href={`/verify?hash=${last.reportHash}`} className="text-xs text-volt hover:underline">Open tamper check →</Link>
              </div>
            )}
          </div>
          <div className="max-w-full overflow-hidden">
            {last ? <BatteryIndicator percent={last.sohPercent} size="xl" /> : <p className="text-mute">No health report yet</p>}
          </div>
        </div>
      </section>

      {data.imageHash && <BatteryPhoto hash={data.imageHash} className="h-72 w-full rounded-2xl border border-line md:h-96" />}

      {last && (
        <section className="grid gap-5 md:grid-cols-3">
          <div className="card md:col-span-2">
            <h2 className="flex items-center gap-2 text-lg text-white"><Brain className="h-5 w-5 text-volt" /> What this means</h2>
            <p className="mt-3 text-lg text-slate-100">{report?.ml.explanation ?? `Grade ${last.grade} with ${last.sohPercent}% health remaining.`}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [Gauge, "Health", `${last.sohPercent}%`], [Repeat, "Charge cycles", last.cycleCount.toLocaleString()],
                [Clock, "Est. life left", `~${report?.ml.remaining_life_months ?? remainingMonths(last.sohPercent)} mo`],
                [Zap, "Fair price", report ? inr(report.ml.suggested_price_inr) : "—"],
              ].map(([Icon, k, v]: any) => (
                <div key={k} className="rounded-xl bg-ink/70 p-3"><Icon className="h-4 w-4 text-bolt" /><p className="mt-1 text-[11px] uppercase tracking-wider text-mute">{k}</p><p className="font-display text-lg text-white">{v}</p></div>
              ))}
            </div>
          </div>
          <div className="card flex flex-col justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wider text-mute">Status</p>
              {listing.active ? <p className="mt-1 font-display text-xl font-bold text-bolt text-glow-bolt">{priceLabel(listing.price)}</p> : <p className="mt-1 text-slate-300">Not for sale</p>}
            </div>
            {listing.active && <button className="btn-primary" onClick={() => setBuying(true)}><Zap className="h-4 w-4" /> Buy this battery</button>}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-5 text-xl text-white">History <span className="text-sm text-mute">· every step is recorded on-chain</span></h2>
        <Timeline items={timeline} reportInfo={reportInfo} />
      </section>

      <section className="card">
        <h2 className="text-lg text-white">Ownership history <span className="text-xs text-mute">(read from the contract)</span></h2>
        <ol className="mt-3 space-y-2 text-sm">
          {data.history.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center gap-3"><span className="font-display text-volt">{i + 1}.</span><AddressChip address={h.owner} full /><span className="text-xs text-mute">block #{h.blockNumber}</span></li>
          ))}
        </ol>
      </section>

      {buying && <BuyModal item={data} onClose={() => { setBuying(false); load(); }} onDone={load} />}
    </div>
  );
}
