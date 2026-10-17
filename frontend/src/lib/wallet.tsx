"use client";
// Wallet state shared by all pages: connected address, network check, role (admin / inspector).
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { readContract } from "./chain";
import { CHAIN_ID, NETWORK } from "./config";

type WalletCtx = {
  address: string | null; chainOk: boolean; isInspector: boolean; isAdmin: boolean;
  connect: () => Promise<void>; switchNetwork: () => Promise<void>; error: string | null;
};
const Ctx = createContext<WalletCtx>(null as any);
export const useWallet = () => useContext(Ctx);

const eth = () => (typeof window !== "undefined" ? (window as any).ethereum : undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState(true);
  const [isInspector, setIsInspector] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshRole = useCallback(async (addr: string | null) => {
    if (!addr) { setIsInspector(false); setIsAdmin(false); return; }
    try {
      const c = readContract();
      setIsInspector(await c.isInspector(addr));
      setIsAdmin((await c.owner()).toLowerCase() === addr.toLowerCase());
    } catch { /* chain not running - ignore */ }
  }, []);

  const refreshChain = useCallback(async () => {
    const e = eth(); if (!e) return;
    const id = parseInt(await e.request({ method: "eth_chainId" }), 16);
    setChainOk(id === CHAIN_ID);
  }, []);

  useEffect(() => {
    const e = eth(); if (!e) return;
    // Reconnect silently if the site was already approved.
    e.request({ method: "eth_accounts" }).then((a: string[]) => { setAddress(a[0] ?? null); refreshRole(a[0] ?? null); }).catch(() => {});
    refreshChain();
    const onAcc = (a: string[]) => { setAddress(a[0] ?? null); refreshRole(a[0] ?? null); };
    e.on?.("accountsChanged", onAcc);
    e.on?.("chainChanged", refreshChain);
    return () => { e.removeListener?.("accountsChanged", onAcc); e.removeListener?.("chainChanged", refreshChain); };
  }, [refreshRole, refreshChain]);

  const switchNetwork = async () => {
    const e = eth(); if (!e) return;
    try {
      await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + CHAIN_ID.toString(16) }] });
    } catch (err: any) {
      if (err.code === 4902 || /Unrecognized chain/i.test(err.message)) {
        // Network not in MetaMask yet -> add it.
        await e.request({ method: "wallet_addEthereumChain", params: [{
          chainId: "0x" + CHAIN_ID.toString(16), chainName: NETWORK.name, rpcUrls: [NETWORK.rpc],
          ...(NETWORK.explorer ? { blockExplorerUrls: [NETWORK.explorer] } : {}),
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 } }] });
      } else throw err;
    }
    await refreshChain();
  };

  const connect = async () => {
    setError(null);
    const e = eth();
    if (!e) { setError("MetaMask not found. Install the MetaMask extension."); return; }
    try {
      const a: string[] = await e.request({ method: "eth_requestAccounts" });
      setAddress(a[0]); refreshRole(a[0]);
      await switchNetwork();
    } catch (err: any) { setError(err?.message ?? "Could not connect"); }
  };

  return <Ctx.Provider value={{ address, chainOk, isInspector, isAdmin, connect, switchNetwork, error }}>{children}</Ctx.Provider>;
}
