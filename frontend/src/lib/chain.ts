// All blockchain access lives here: read-only provider, contract helpers, tx runner, data loaders.
import { BrowserProvider, Contract, JsonRpcProvider, ContractTransactionResponse, Interface } from "ethers";
import deployment from "@/contracts/VoltaChain.json";
import { CHAIN_ID, DEPLOY_BLOCK, RPC_URL } from "./config";

export const CONTRACT_ADDRESS: string = deployment.address;
export const ABI = deployment.abi;
export const iface = new Interface(ABI);

/** Read-only connection straight to the local Hardhat node (no wallet needed to browse). */
export const readProvider = new JsonRpcProvider(RPC_URL, CHAIN_ID, { staticNetwork: true });
export const readContract = () => new Contract(CONTRACT_ADDRESS, ABI, readProvider);

/** Contract connected to the user's MetaMask signer (for sending transactions). */
export async function writeContract() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found. Please install it and connect your wallet.");
  const signer = await new BrowserProvider(eth).getSigner();
  return new Contract(CONTRACT_ADDRESS, ABI, signer);
}

// ---------- Types ----------
export type Battery = { tokenId: number; serialNumber: string; batteryType: string; capacityMah: number; registeredAt: number };
export type Report = { sohPercent: number; grade: string; cycleCount: number; reportHash: string; inspector: string; timestamp: number; blockNumber: number };
export type Listing = { price: bigint; active: boolean };
export type OwnerRec = { owner: string; timestamp: number; blockNumber: number };
export type Loc = { city: string; lat: number; lng: number } | null;
export type BatteryFull = { battery: Battery; owner: string; reports: Report[]; listing: Listing; history: OwnerRec[]; location: Loc };
export type TxInfo = { hash: string; blockNumber: number; blockHash: string; gasUsed: string; status: number };

const toBattery = (b: any): Battery => ({
  tokenId: Number(b.tokenId), serialNumber: b.serialNumber, batteryType: b.batteryType,
  capacityMah: Number(b.capacityMah), registeredAt: Number(b.registeredAt),
});
const toReport = (r: any): Report => ({
  sohPercent: Number(r.sohPercent), grade: r.grade, cycleCount: Number(r.cycleCount), reportHash: r.reportHash,
  inspector: r.inspector, timestamp: Number(r.timestamp), blockNumber: Number(r.blockNumber),
});

/** Load everything we know about one battery from the contract's view functions. */
export async function loadBattery(tokenId: number): Promise<BatteryFull> {
  const c = readContract();
  const [b, owner, reports, listing, history, loc] = await Promise.all([
    c.getBattery(tokenId), c.ownerOf(tokenId), c.getReports(tokenId), c.getListing(tokenId), c.getOwnerHistory(tokenId), c.getLocation(tokenId),
  ]);
  return {
    battery: toBattery(b), owner, reports: reports.map(toReport),
    listing: { price: listing.price, active: listing.active },
    location: loc.isSet ? { city: loc.city, lat: Number(loc.latE6) / 1e6, lng: Number(loc.lngE6) / 1e6 } : null,
    history: history.map((h: any) => ({ owner: h.owner, timestamp: Number(h.timestamp), blockNumber: Number(h.blockNumber) })),
  };
}

export async function loadAllBatteries(): Promise<BatteryFull[]> {
  const n = Number(await readContract().totalBatteries());
  return Promise.all(Array.from({ length: n }, (_, i) => loadBattery(i + 1)));
}

export async function loadListed(): Promise<BatteryFull[]> {
  const ids: bigint[] = await readContract().getActiveListings();
  return Promise.all(ids.map((i) => loadBattery(Number(i))));
}

// ---------- Timeline (built from contract events, so each entry has a tx hash + block) ----------
export type TimelineItem = {
  kind: "registered" | "report" | "listed" | "sold";
  blockNumber: number; txHash: string; logIndex: number;
  who?: string; to?: string; price?: bigint; reportHash?: string;
};

export async function loadTimeline(tokenId: number): Promise<TimelineItem[]> {
  const c = readContract();
  const [reg, rep, listed, sold] = await Promise.all([
    c.queryFilter(c.filters.BatteryRegistered(tokenId), DEPLOY_BLOCK),
    c.queryFilter(c.filters.HealthReportAdded(tokenId), DEPLOY_BLOCK),
    c.queryFilter(c.filters.Listed(tokenId), DEPLOY_BLOCK),
    c.queryFilter(c.filters.Sold(tokenId), DEPLOY_BLOCK),
  ]);
  const items: TimelineItem[] = [];
  const base = (l: any) => ({ blockNumber: l.blockNumber, txHash: l.transactionHash, logIndex: l.index });
  reg.forEach((l: any) => items.push({ kind: "registered", ...base(l), who: l.args.owner }));
  rep.forEach((l: any) => items.push({ kind: "report", ...base(l), who: l.args.inspector, reportHash: l.args.reportHash }));
  listed.forEach((l: any) => items.push({ kind: "listed", ...base(l), who: l.args.seller, price: l.args.price }));
  sold.forEach((l: any) => items.push({ kind: "sold", ...base(l), who: l.args.from, to: l.args.to, price: l.args.price }));
  return items.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
}

// ---------- Transactions ----------
/** Send a tx, wait for it to be mined, and return the details we show in the success card. */
export async function runTx(send: () => Promise<ContractTransactionResponse>): Promise<TxInfo> {
  const tx = await send();
  const rc = await tx.wait();
  if (!rc) throw new Error("Transaction was not mined");
  return { hash: rc.hash, blockNumber: rc.blockNumber, blockHash: rc.blockHash, gasUsed: rc.gasUsed.toString(), status: rc.status ?? 1 };
}

/** Turn ethers/MetaMask/Hardhat errors into one readable sentence (esp. revert reasons). */
export function friendlyError(e: any): string {
  const raw: string = [e?.reason, e?.info?.error?.message, e?.error?.message, e?.shortMessage, e?.message].filter(Boolean).join(" | ");
  if (/user rejected|ACTION_REJECTED|denied transaction/i.test(raw)) return "You cancelled the request in MetaMask.";
  const m = raw.match(/reverted with reason string '([^']+)'/) || raw.match(/execution reverted: ([^"|]+)/) || raw.match(/reason="([^"]+)"/);
  if (m) return m[1].trim();
  return (e?.shortMessage || e?.message || String(e)).slice(0, 300);
}

/** Dry-run a call to learn the revert reason (used by the access-control demo). */
export async function simulate(from: string, fnName: string, args: any[]): Promise<string | null> {
  try {
    // eth_call only reads state - nothing is sent or mined.
    await readProvider.call({ from, to: CONTRACT_ADDRESS, data: iface.encodeFunctionData(fnName, args) });
    return null;
  } catch (e) {
    return friendlyError(e);
  }
}

// ---------- Wallet display names (set on-chain with setName) ----------
const nameCache = new Map<string, string>();
export const clearNameCache = () => nameCache.clear();
/** Returns the wallet's chosen name, or "" if none. Cached so repeated addresses are cheap. */
export async function getName(addr: string): Promise<string> {
  const k = addr.toLowerCase();
  if (nameCache.has(k)) return nameCache.get(k)!;
  let n = "";
  try { n = await readContract().displayName(addr); } catch { /* chain unreachable */ }
  nameCache.set(k, n);
  return n;
}
