"use client";

import { useEffect, useState } from "react";

import { useCopilotStore } from "@/store/copilot-store";
import { secureGet, secureClearAll } from "@/lib/secure-storage";
import { formatBalance } from "@/lib/formatting";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { networkConfig } from "@/lib/config";

/**
 * Hook that detects zkLogin session from localStorage and syncs wallet state.
 * Returns logout function for zkLogin users.
 */
export function useZkLoginSession() {
  const [isZkLogin, setIsZkLogin] = useState(false);
  const suiClient = new SuiGrpcClient({ network: networkConfig.network, baseUrl: networkConfig.rpcUrl } as any);
  const connectWallet = useCopilotStore((s) => s.connectWallet);
  const disconnectWallet = useCopilotStore((s) => s.disconnectWallet);
  const walletAddress = useCopilotStore((s) => s.walletAddress);

  useEffect(() => {
    // Small delay to ensure storage is ready after redirect
    const timer = setTimeout(() => checkZkLoginSession(), 100);
    return () => clearTimeout(timer);
  }, []);

  const checkZkLoginSession = async () => {
    const address = localStorage.getItem("zklogin_address");
    if (!address) return;

    const jwt = localStorage.getItem("zklogin_jwt");
    if (!jwt) {
      localStorage.removeItem("zklogin_address");
      return;
    }

    try {
      const payload = JSON.parse(atob(jwt.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        // JWT expired
        logout();
        return;
      }
    } catch {
      logout();
      return;
    }

    // Fetch balances and connect
    setIsZkLogin(true);
    const WAL_TYPE = "0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL";
    const USDC_TYPE = "0xa1ec7fc00a6f40db9693571b57fdd7d48add54f290e3f8023143e6d4a4e6bef3::usdc::USDC";
    try {
      const [suiRes, walRes, usdcRes] = await Promise.all([
        (suiClient as any).getBalance({ owner: address }).catch(() => null),
        (suiClient as any).getBalance({ owner: address, coinType: WAL_TYPE }).catch(() => null),
        (suiClient as any).getBalance({ owner: address, coinType: USDC_TYPE }).catch(() => null),
      ]);

      const balances: { token: string; symbol: string; balance: number; decimals: number }[] = [];
      const suiBal = BigInt(suiRes?.balance?.balance ?? suiRes?.balance?.coinBalance ?? suiRes?.totalBalance ?? "0");
      balances.push({ token: "0x2::sui::SUI", symbol: "SUI", balance: Number(formatBalance(suiBal, 9, 2)), decimals: 9 });

      const walBal = BigInt(walRes?.balance?.balance ?? walRes?.balance?.coinBalance ?? walRes?.totalBalance ?? "0");
      if (walBal > BigInt(0)) balances.push({ token: WAL_TYPE, symbol: "WAL", balance: Number(formatBalance(walBal, 9, 2)), decimals: 9 });

      const usdcBal = BigInt(usdcRes?.balance?.balance ?? usdcRes?.balance?.coinBalance ?? usdcRes?.totalBalance ?? "0");
      if (usdcBal > BigInt(0)) balances.push({ token: USDC_TYPE, symbol: "USDC", balance: Number(formatBalance(usdcBal, 6, 2)), decimals: 6 });

      connectWallet(address, balances);
    } catch {
      connectWallet(address, []);
    }

    // Load memwal credentials from localStorage
    try {
      const { loadCredentials } = await import("@/hooks/useMemwalSetup");
      const creds = loadCredentials(address);
      if (creds) useCopilotStore.getState().setMemwalCredentials(creds);
    } catch {}
  };

  const logout = () => {
    secureClearAll();
    localStorage.removeItem("zklogin_address");
    setIsZkLogin(false);
    disconnectWallet();
  };

  return { isZkLogin, logout };
}
