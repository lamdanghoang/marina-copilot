"use client";

import { useCallback, useState } from "react";
import { useDAppKit, useCurrentClient } from "@mysten/dapp-kit-react";
import { createAccount, addDelegateKey, generateDelegateKey } from "@mysten-incubation/memwal/account";
import { networkConfig } from "@/lib/config";

const MEMWAL_PACKAGE_ID = "0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6";
const MEMWAL_REGISTRY_ID = "0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437";
const STORAGE_KEY = "marina-copilot-memwal";

export interface MemwalCredentials {
  accountId: string;
  delegateKey: string;
}

export function loadCredentials(walletAddress: string): MemwalCredentials | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${walletAddress}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveCredentials(walletAddress: string, creds: MemwalCredentials) {
  localStorage.setItem(`${STORAGE_KEY}-${walletAddress}`, JSON.stringify(creds));
}

export function useMemwalSetup(walletAddress: string | null) {
  const [isSettingUp, setIsSettingUp] = useState(false);
  const suiClient = useCurrentClient();
  const dAppKit = useDAppKit();

  const setup = useCallback(async (): Promise<MemwalCredentials | null> => {
    if (!walletAddress) return null;
    setIsSettingUp(true);

    try {
      const delegate = await generateDelegateKey();

      const walletSigner = {
        address: walletAddress,
        signAndExecuteTransaction: async (input: { transaction: any }) => {
          const res = await (dAppKit as any).signAndExecuteTransaction({ transaction: input.transaction });
          const digest = (res as any)?.Transaction?.digest ?? (res as any)?.digest ?? "";
          return { digest };
        },
        signPersonalMessage: async (input: { message: Uint8Array }) => {
          const res = await (dAppKit as any).signPersonalMessage({ message: input.message });
          return { signature: res.signature };
        },
      };

      // Check if account already exists via events first (avoid abort code 3)
      let accountId: string | null = null;
      try {
        const events = await (suiClient as any).queryEvents({
          query: { MoveEventType: `${MEMWAL_PACKAGE_ID}::account::AccountCreated` },
          limit: 50,
          order: "descending",
        });
        const found = (events.data || []).find(
          (e: any) => e.parsedJson?.owner === walletAddress
        );
        if (found) accountId = found.parsedJson.account_id;
      } catch {}

      // Only create if not exists
      if (!accountId) {
        const account = await createAccount({
          packageId: MEMWAL_PACKAGE_ID,
          registryId: MEMWAL_REGISTRY_ID,
          walletSigner,
          suiClient: suiClient as any,
          suiNetwork: networkConfig.network,
        });
        accountId = account.accountId;
      }

      await addDelegateKey({
        packageId: MEMWAL_PACKAGE_ID,
        accountId,
        publicKey: delegate.publicKey,
        label: "Marina Copilot",
        walletSigner,
        suiClient: suiClient as any,
        suiNetwork: networkConfig.network,
      });

      const creds: MemwalCredentials = {
        accountId,
        delegateKey: delegate.privateKey,
      };
      saveCredentials(walletAddress, creds);

      // Update global store
      const { useCopilotStore } = await import("@/store/copilot-store");
      useCopilotStore.getState().setMemwalCredentials(creds);

      return creds;
    } catch (error) {
      console.error("[MemWal Setup] Failed:", error);
      return null;
    } finally {
      setIsSettingUp(false);
    }
  }, [walletAddress, dAppKit, suiClient]);

  return { isSettingUp, setup };
}
