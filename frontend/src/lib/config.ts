import { formatEther } from "ethers";

import deployment from "@/contracts/VoltaChain.json";

// Network comes from the last deploy (contracts/scripts/deploy.js writes chainId into the JSON).
export const CHAIN_ID: number = deployment.chainId;
export const IS_LOCAL = CHAIN_ID === 31337;
export const DEPLOY_BLOCK: number = (deployment as any).deployBlock ?? 0;
export const NETWORK = IS_LOCAL
  ? { name: "Hardhat Local", rpc: "http://127.0.0.1:8545", explorer: null as string | null }
  : { name: "Sepolia", rpc: "https://ethereum-sepolia-rpc.publicnode.com", explorer: "https://sepolia.etherscan.io" as string | null };
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || NETWORK.rpc;
export const ML_URL = process.env.NEXT_PUBLIC_ML_URL || "http://127.0.0.1:8000";
/** Link to the real Etherscan (only on public networks). */
export const etherscan = (kind: "tx" | "address" | "block", v: string) => (NETWORK.explorer ? `${NETWORK.explorer}/${kind}/${v}` : null);
/** Demo exchange rate so prices can be shown in INR next to ETH. */
export const INR_PER_ETH = 200000;

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const weiToInr = (wei: bigint) => Number(formatEther(wei)) * INR_PER_ETH;
export const inrToEth = (rupees: number) => (rupees / INR_PER_ETH).toFixed(6);
/** "0.007 ETH ≈ ₹1,400" */
export const priceLabel = (wei: bigint) =>
  `${Number(formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 6 })} ETH ≈ ${inr(weiToInr(wei))}`;

export const short = (s: string, a = 6, b = 4) => (s.length > a + b + 2 ? `${s.slice(0, a)}…${s.slice(-b)}` : s);

/** Well-known Hardhat test accounts, labelled so the demo is easy to follow. */
export const KNOWN_ACCOUNTS: Record<string, string> = {
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266": "Admin",
  "0x70997970c51812dc3a010c7d01b50e0d17dc79c8": "Inspector",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc": "Seller",
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906": "Buyer",
  "0x15d34aaf54267db7d7c367839aaf71a00a2c6a65": "Seller 2",
};
export const roleOf = (addr?: string | null) => (addr ? KNOWN_ACCOUNTS[addr.toLowerCase()] : undefined);

export const gradeColor = (g: string) =>
  ({ A: "#22ff88", B: "#a3e635", C: "#fb923c", D: "#ef4444" } as Record<string, string>)[g] || "#8fa89a";
export const sohColor = (p: number) => (p >= 85 ? "#22ff88" : p >= 70 ? "#a3e635" : p >= 50 ? "#fb923c" : "#ef4444");
