"use client";
// Built-in blockchain explorer (a mini Etherscan) reading the local Hardhat chain directly with ethers.js.
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Blocks, Search, CheckCircle2, XCircle, ArrowRight, Radio } from "lucide-react";
import { Block, TransactionReceipt, TransactionResponse, formatEther, isAddress } from "ethers";
import ChargingLoader from "@/components/ChargingLoader";
import { AddressChip, ChainDown, Hash, PageTitle } from "@/components/bits";
import { CONTRACT_ADDRESS, friendlyError, iface, readProvider } from "@/lib/chain";
import { short } from "@/lib/config";

import { IS_LOCAL, etherscan } from "@/lib/config";
const PAGE = IS_LOCAL ? 8 : 4;               // public chains have big blocks: show fewer
const POLL_MS = IS_LOCAL ? 3000 : 12000;     // ...and poll slower
const SCAN = IS_LOCAL ? 300 : 15;            // blocks scanned for the address page

/** Colour derived from the first 6 hex chars of a hash - parent/child hashes share a colour so links are visible. */
const hashColor = (h: string) => `#${h.slice(2, 8)}`;
const ago = (ts: number) => { const s = Math.max(0, Math.floor(Date.now() / 1000 - ts)); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`; };

/** Decode a tx's calldata into a function name using the contract ABI. */
function decode(tx: { data: string; value: bigint; to: string | null }) {
  if (!tx.to) return { name: "Contract creation", args: [] as [string, string][] };
  try {
    const p = iface.parseTransaction({ data: tx.data, value: tx.value });
    if (p) return { name: p.name, args: p.fragment.inputs.map((inp, i) => [inp.name, String(p.args[i])] as [string, string]) };
  } catch { /* not a VoltaChain call */ }
  return { name: tx.data === "0x" ? "Transfer ETH" : "Unknown call", args: [] };
}

function BlockCard({ b, parentOk, last, active, onClick }: { b: Block; parentOk: boolean | null; last: boolean; active: boolean; onClick: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.7, x: -60 }} animate={{ opacity: 1, scale: 1, x: 0 }} transition={{ type: "spring", stiffness: 160, damping: 18 }} className="flex shrink-0 items-center">
      <button onClick={onClick} className={`relative w-64 rounded-2xl border-2 bg-panel p-4 text-left transition hover:shadow-glow ${active ? "border-volt shadow-glow" : "border-line hover:border-volt/60"}`}>
        {/* battery terminal nub */}
        <span className="absolute -right-2 top-1/2 h-6 w-2 -translate-y-1/2 rounded-r bg-volt/70" />
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-bold text-volt">#{b.number}</span>
          <span className="text-[11px] text-mute">{ago(b.timestamp)}</span>
        </div>
        <dl className="mt-3 space-y-2 text-[11px]">
          <div><dt className="text-mute">Block hash</dt><dd className="flex items-center gap-1.5 font-mono text-slate-100"><i className="h-3 w-1.5 rounded-sm" style={{ background: hashColor(b.hash!) }} />{short(b.hash!, 10, 6)}</dd></div>
          <div><dt className="text-mute">Parent hash</dt><dd className="flex items-center gap-1.5 font-mono text-slate-300"><i className="h-3 w-1.5 rounded-sm" style={{ background: hashColor(b.parentHash) }} />{short(b.parentHash, 10, 6)}</dd></div>
        </dl>
        <div className="mt-3 flex justify-between border-t border-line pt-2 text-[11px] text-slate-300">
          <span>{b.transactions.length} tx</span><span>gas {b.gasUsed.toLocaleString("en-US")}</span>
        </div>
      </button>
      {!last && (
        <div className="flex w-20 shrink-0 flex-col items-center gap-1 px-1">
          <div className="wire-h w-full" />
          <span className={`flex items-center gap-1 text-center text-[10px] font-semibold leading-tight ${parentOk === false ? "text-redx" : "text-volt"}`}>
            {parentOk === false ? "broken!" : <><ArrowRight className="h-3 w-3" />parent #{b.number - 1}</>}
          </span>
          {parentOk && <span className="text-[10px] text-mute">hash match ✓</span>}
        </div>
      )}
    </motion.div>
  );
}

function TxRow({ tx }: { tx: TransactionResponse }) {
  const d = decode(tx);
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2 pr-3"><Link href={`/explorer?tx=${tx.hash}`} className="font-mono text-xs text-volt hover:underline">{short(tx.hash, 10, 6)}</Link></td>
      <td className="py-2 pr-3 text-xs"><span className="rounded bg-bolt/15 px-1.5 py-0.5 font-semibold text-bolt">{d.name}</span></td>
      <td className="py-2 pr-3"><AddressChip address={tx.from} /></td>
      <td className="py-2 pr-3">{tx.to ? <AddressChip address={tx.to} /> : <span className="text-xs text-mute">new contract</span>}</td>
      <td className="py-2 text-xs text-slate-300">{formatEther(tx.value)} ETH</td>
    </tr>
  );
}

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => (
  <div className="grid gap-1 border-t border-line py-2.5 first:border-0 sm:grid-cols-[11rem_1fr]"><dt className="text-xs uppercase tracking-wider text-mute">{k}</dt><dd className="min-w-0 text-sm text-slate-100">{children}</dd></div>
);

function BlockDetail({ n }: { n: number }) {
  const [b, setB] = useState<Block | null | undefined>(undefined);
  useEffect(() => { setB(undefined); readProvider.getBlock(n, true).then(setB).catch(() => setB(null)); }, [n]);
  if (b === undefined) return <ChargingLoader label="Loading block…" />;
  if (!b) return <p className="text-bolt">Block #{n} not found.</p>;
  return (
    <div className="card">
      <h2 className="mb-2 text-lg text-white">Block #{b.number}</h2>
      <dl>
        <Row k="Block hash"><Hash value={b.hash!} /></Row>
        <Row k="Parent hash"><Hash value={b.parentHash} href={b.number > 0 ? `/explorer?block=${b.number - 1}` : undefined} /></Row>
        <Row k="Timestamp">{new Date(b.timestamp * 1000).toLocaleString()}</Row>
        <Row k="Gas used">{b.gasUsed.toLocaleString("en-US")} / {b.gasLimit.toLocaleString("en-US")}</Row>
        <Row k="Transactions">{b.transactions.length}</Row>
      </dl>
      {b.prefetchedTransactions.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left"><thead><tr className="text-[11px] uppercase tracking-wider text-mute"><th className="pb-1">Tx hash</th><th>Function</th><th>From</th><th>To</th><th>Value</th></tr></thead>
            <tbody>{b.prefetchedTransactions.map((t) => <TxRow key={t.hash} tx={t} />)}</tbody></table>
        </div>
      )}
    </div>
  );
}

function TxDetail({ hash }: { hash: string }) {
  const [d, setD] = useState<{ tx: TransactionResponse; rc: TransactionReceipt; block: Block; reason?: string } | null | undefined>(undefined);
  useEffect(() => {
    setD(undefined);
    (async () => {
      const tx = await readProvider.getTransaction(hash);
      const rc = await readProvider.getTransactionReceipt(hash);
      if (!tx || !rc) return setD(null);
      const block = (await readProvider.getBlock(rc.blockNumber))!;
      let reason: string | undefined;
      if (rc.status === 0) { // replay the failed call on the previous block to learn the revert reason
        try { await readProvider.call({ from: tx.from, to: tx.to, data: tx.data, value: tx.value, blockTag: rc.blockNumber - 1 }); } catch (e) { reason = friendlyError(e); }
      }
      setD({ tx, rc, block, reason });
    })().catch(() => setD(null));
  }, [hash]);
  if (d === undefined) return <ChargingLoader label="Loading transaction…" />;
  if (!d) return <p className="text-bolt">Transaction not found.</p>;
  const { tx, rc, block, reason } = d;
  const fn = decode(tx);
  const logs = rc.logs.map((l) => { try { const p = iface.parseLog({ topics: [...l.topics], data: l.data }); return p ? { name: p.name, args: p.fragment.inputs.map((inp, i) => [inp.name, String(p.args[i])] as [string, string]), address: l.address } : null; } catch { return null; } }).filter(Boolean) as { name: string; args: [string, string][]; address: string }[];
  return (
    <div className="card">
      <h2 className="mb-2 text-lg text-white">Transaction</h2>
      <dl>
        <Row k="Tx hash"><Hash value={tx.hash} /></Row>
        <Row k="Status">{rc.status === 1 ? <span className="inline-flex items-center gap-1 text-volt"><CheckCircle2 className="h-4 w-4" /> Success</span> : <span className="inline-flex items-center gap-1 text-redx"><XCircle className="h-4 w-4" /> Failed (reverted){reason && <>: “{reason}”</>}</span>}</Row>
        <Row k="Block"><Link href={`/explorer?block=${rc.blockNumber}`} className="text-volt hover:underline">#{rc.blockNumber}</Link> <span className="text-xs text-mute">({block.timestamp && new Date(block.timestamp * 1000).toLocaleTimeString()})</span></Row>
        <Row k="Block hash"><Hash value={rc.blockHash} /></Row>
        <Row k="From"><AddressChip address={tx.from} full /></Row>
        <Row k="To">{tx.to ? <AddressChip address={tx.to} full /> : <>Contract creation → <AddressChip address={rc.contractAddress!} full /></>}</Row>
        <Row k="Value">{formatEther(tx.value)} ETH</Row>
        <Row k="Gas used">{rc.gasUsed.toLocaleString("en-US")}</Row>
        <Row k="Function called"><span className="rounded bg-bolt/15 px-2 py-0.5 font-mono text-bolt">{fn.name}</span></Row>
      </dl>
      {fn.args.length > 0 && (
        <div className="mt-3"><p className="label">Decoded input</p>
          <div className="space-y-1 rounded-xl bg-ink/70 p-3">{fn.args.map(([k, v]) => <p key={k} className="text-xs"><span className="text-mute">{k}:</span> <span className="break-all font-mono text-slate-100">{v}</span></p>)}</div></div>
      )}
      <div className="mt-4"><p className="label">Event logs ({logs.length} decoded of {rc.logs.length})</p>
        {logs.length === 0 && <p className="text-sm text-mute">No events.</p>}
        <div className="space-y-2">{logs.map((l, i) => (
          <div key={i} className="rounded-xl border border-line bg-ink/70 p-3">
            <p className="font-display text-sm text-volt">{l.name}</p>
            {l.args.map(([k, v]) => <p key={k} className="text-xs"><span className="text-mute">{k}:</span> <span className="break-all font-mono text-slate-100">{v}</span></p>)}
          </div>))}</div>
      </div>
    </div>
  );
}

function AddressDetail({ addr }: { addr: string }) {
  const [d, setD] = useState<{ bal: bigint; nonce: number; code: boolean; txs: TransactionResponse[] } | undefined>(undefined);
  useEffect(() => {
    setD(undefined);
    (async () => {
      const [bal, nonce, code, latest] = await Promise.all([readProvider.getBalance(addr), readProvider.getTransactionCount(addr), readProvider.getCode(addr), readProvider.getBlockNumber()]);
      // Chain is tiny: scan the most recent 300 blocks for txs from/to this address.
      const nums = Array.from({ length: Math.min(SCAN, latest + 1) }, (_, i) => latest - i);
      const blocks = await Promise.all(nums.map((n) => readProvider.getBlock(n, true)));
      const txs = blocks.flatMap((b) => b?.prefetchedTransactions ?? []).filter((t) => t.from.toLowerCase() === addr.toLowerCase() || t.to?.toLowerCase() === addr.toLowerCase());
      setD({ bal, nonce, code: code !== "0x", txs });
    })().catch(() => {});
  }, [addr]);
  if (!d) return <ChargingLoader label="Loading address…" />;
  return (
    <div className="card">
      <h2 className="mb-2 text-lg text-white">{d.code ? "Contract" : "Account"}</h2>
      <dl>
        <Row k="Address"><AddressChip address={addr} full /></Row>
        <Row k="Balance">{Number(formatEther(d.bal)).toLocaleString(undefined, { maximumFractionDigits: 4 })} ETH</Row>
        <Row k="Transactions sent">{d.nonce}</Row>
        {d.code && addr.toLowerCase() === CONTRACT_ADDRESS.toLowerCase() && <Row k="Contract">VoltaChain (ERC-721 battery registry)</Row>}
      </dl>
      <p className="label mt-4">Transactions involving this address ({d.txs.length})</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left"><tbody>{d.txs.map((t) => <TxRow key={t.hash} tx={t} />)}</tbody></table></div>
    </div>
  );
}

function ExplorerInner() {
  const router = useRouter();
  const params = useSearchParams();
  const qBlock = params.get("block"), qTx = params.get("tx"), qAddr = params.get("address");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [count, setCount] = useState(PAGE);
  const [latest, setLatest] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const lastSeen = useRef(-1);

  // Fetch the newest `count` blocks (with their txs).
  const refresh = useCallback(async (force = false) => {
    try {
      const n = await readProvider.getBlockNumber();
      if (!force && n === lastSeen.current) return;
      lastSeen.current = n;
      const nums = Array.from({ length: Math.min(count, n + 1) }, (_, i) => n - i);
      setBlocks((await Promise.all(nums.map((x) => readProvider.getBlock(x, true)))).filter(Boolean) as Block[]);
      setLatest(n); setErr(null);
    } catch (e: any) { setErr(e.shortMessage || e.message); }
  }, [count]);

  useEffect(() => { refresh(true); }, [refresh]);
  useEffect(() => { const t = setInterval(() => refresh(), POLL_MS); return () => clearInterval(t); }, [refresh]); // auto-refresh: new blocks appear live

  const go = (kind: string, v: string) => router.push(`/explorer?${kind}=${v}`);

  const search = async (e: React.FormEvent) => {
    e.preventDefault(); setSearchErr(null);
    const q = query.trim(); if (!q) return;
    if (/^\d+$/.test(q)) return go("block", q);
    if (isAddress(q)) return go("address", q);
    if (/^0x[0-9a-fA-F]{64}$/.test(q)) {
      if (await readProvider.getTransaction(q)) return go("tx", q);
      const b = await readProvider.getBlock(q); // maybe it is a block hash
      if (b) return go("block", String(b.number));
    }
    setSearchErr("Nothing found. Try a tx hash, block number, or address.");
  };

  return (
    <>
      <PageTitle icon={<Blocks className="h-8 w-8 text-volt" />} title="Blockchain Explorer" sub="Every block points to the one before it by its hash. Change any old block and the whole chain after it breaks — that's what makes the data tamper-proof." />

      <form onSubmit={search} className="mb-2 flex gap-2">
        <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-mute" /><input className="input pl-9 font-mono" placeholder="Search tx hash, block number or address" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <button className="btn-primary">Search</button>
      </form>
      {searchErr && <p className="mb-2 text-sm text-bolt">{searchErr}</p>}

      {!IS_LOCAL && <p className="mt-2 text-sm text-mute">You are on a public network, so these are the newest blocks of the whole chain. Search a tx hash or open the <a className="text-volt underline" href={etherscan("address", CONTRACT_ADDRESS)!} target="_blank" rel="noreferrer">contract on Etherscan</a> to see only VoltaChain activity.</p>}
      <div className="mb-3 mt-6 flex items-center justify-between">
        <h2 className="text-lg text-white">Latest blocks</h2>
        {latest !== null && <span className="chip"><Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE · block #{latest}</span>}
      </div>
      {err && <ChainDown message={err} />}
      {!err && blocks.length === 0 && <ChargingLoader label="Reading the chain…" />}
      <div className="overflow-x-auto pb-4 pr-6 pt-2">
        <div className="flex w-max items-center">
          <AnimatePresence initial={false}>
            {blocks.map((b, i) => (
              <BlockCard key={b.number} b={b} last={i === blocks.length - 1 && b.number === 0}
                parentOk={i < blocks.length - 1 ? b.parentHash === blocks[i + 1].hash : null}
                active={String(b.number) === qBlock} onClick={() => go("block", String(b.number))} />
            ))}
          </AnimatePresence>
          {latest !== null && blocks.length < latest + 1 && <button className="btn-ghost ml-4 shrink-0" onClick={() => setCount(count + PAGE)}>Load older blocks</button>}
        </div>
      </div>

      <div className="mt-4">
        {qTx ? <TxDetail hash={qTx} /> : qBlock !== null ? <BlockDetail n={Number(qBlock)} /> : qAddr ? <AddressDetail addr={qAddr} />
          : <p className="text-sm text-mute">Click a block to see its transactions, then click a transaction to see its decoded details.</p>}
      </div>
    </>
  );
}

export default function Explorer() {
  return <Suspense fallback={<ChargingLoader label="Loading explorer…" />}><ExplorerInner /></Suspense>;
}
