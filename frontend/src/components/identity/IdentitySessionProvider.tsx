import { BrowserProvider, getAddress } from "ethers";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient } from "../../lib/api-client";
import { BrowserWalletIdentityWriter, DemoLocalIdentityWriter, type IdentityWriter } from "../../services/identity-writers";
import type { DemoWallet, IdentityContractConfig } from "../../types/api";

type OwnershipMode = "browser" | "demo" | null;
interface IdentitySessionValue {
  mode: OwnershipMode;
  address: string | null;
  chainId: number | null;
  config: IdentityContractConfig | null;
  demoWallets: DemoWallet[];
  browserWalletAvailable: boolean;
  loading: boolean;
  connectBrowserWallet(): Promise<void>;
  selectDemoWallet(wallet: DemoWallet): void;
  refreshDemoWallets(): Promise<void>;
  writer(): IdentityWriter;
}

const IdentitySessionContext = createContext<IdentitySessionValue | null>(null);

export function IdentitySessionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<OwnershipMode>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [config, setConfig] = useState<IdentityContractConfig | null>(null);
  const [demoWallets, setDemoWallets] = useState<DemoWallet[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDemoWallets = useCallback(async () => {
    try { setDemoWallets((await apiClient.demoWallets()).wallets); } catch { setDemoWallets([]); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([apiClient.identityConfig(controller.signal), apiClient.demoWallets(controller.signal)])
      .then(([configuration, wallets]) => {
        if (configuration.status === "fulfilled") setConfig(configuration.value);
        if (wallets.status === "fulfilled") setDemoWallets(wallets.value.wallets);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const connectBrowserWallet = useCallback(async () => {
    if (!window.ethereum) throw new Error("BROWSER_WALLET_UNAVAILABLE");
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const network = await provider.getNetwork();
    const wallet = getAddress(await (await provider.getSigner()).getAddress());
    setMode("browser"); setAddress(wallet); setChainId(Number(network.chainId));
  }, []);

  const selectDemoWallet = useCallback((wallet: DemoWallet) => {
    setMode("demo"); setAddress(wallet.address); setChainId(config?.chainId ?? 31337);
  }, [config]);

  const getWriter = useCallback((): IdentityWriter => {
    if (!address || !mode || !config) throw new Error("WALLET_NOT_CONNECTED");
    if (mode === "browser") {
      if (!window.ethereum) throw new Error("BROWSER_WALLET_UNAVAILABLE");
      return new BrowserWalletIdentityWriter(window.ethereum, config);
    }
    return new DemoLocalIdentityWriter(address);
  }, [address, config, mode]);

  const value = useMemo(() => ({ mode, address, chainId, config, demoWallets, browserWalletAvailable: Boolean(window.ethereum), loading, connectBrowserWallet, selectDemoWallet, refreshDemoWallets, writer: getWriter }), [address, chainId, config, connectBrowserWallet, demoWallets, getWriter, loading, mode, refreshDemoWallets, selectDemoWallet]);
  return <IdentitySessionContext.Provider value={value}>{children}</IdentitySessionContext.Provider>;
}

export function useIdentitySession() {
  const value = useContext(IdentitySessionContext);
  if (!value) throw new Error("useIdentitySession must be used inside IdentitySessionProvider.");
  return value;
}
