"use client";

import { useCallback, useState } from "react";
import { useDAppKit, useCurrentClient, useCurrentAccount } from "@mysten/dapp-kit-react";
import { createAccount, addDelegateKey, generateDelegateKey } from "@mysten-incubation/memwal/account";
import { networkConfig } from "@/lib/config";
import { findMemwalAccount } from "@/lib/sui-graphql";

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
  const account = useCurrentAccount();

  const setup = useCallback(async (): Promise<MemwalCredentials | null> => {
    if (!walletAddress) return null;
    setIsSettingUp(true);

    try {
      const delegate = await generateDelegateKey();
      const { isZkLoginSession, signAndExecuteZkLogin } = await import("@/lib/zklogin-signer");
      const useZk = !account && isZkLoginSession();

      const walletSigner = {
        address: walletAddress,
        signAndExecuteTransaction: async (input: { transaction: any }) => {
          if (useZk) {
            const res = await signAndExecuteZkLogin({ transaction: input.transaction });
            const digest = (res as any)?.Transaction?.digest ?? (res as any)?.digest ?? "";
            return { digest };
          }
          const res = await (dAppKit as any).signAndExecuteTransaction({ transaction: input.transaction });
          const digest = (res as any)?.Transaction?.digest ?? (res as any)?.digest ?? "";
          return { digest };
        },
        signPersonalMessage: async (input: { message: Uint8Array }) => {
          if (useZk) {
            // zkLogin doesn't support signPersonalMessage — use ephemeral key directly
            const { getStoredZkLoginState } = await import("@/lib/zklogin");
            const state = await getStoredZkLoginState();
            if (!state) throw new Error("No zkLogin session");
            const { signature } = await state.ephemeralKeyPair.signPersonalMessage(input.message);
            return { signature };
          }
          const res = await (dAppKit as any).signPersonalMessage({ message: input.message });
          return { signature: res.signature };
        },
      };

      // Check if account already exists via GraphQL
      let accountId: string | null = null;
      try {
        const found = await findMemwalAccount(MEMWAL_PACKAGE_ID, walletAddress);
        if (found) accountId = found.accountId;
      } catch (e) {
        console.warn("[MemWal] GraphQL query failed:", e);
      }

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
