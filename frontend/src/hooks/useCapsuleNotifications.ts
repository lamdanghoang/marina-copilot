"use client";

import { useEffect, useRef } from "react";
import { useCopilotStore } from "@/store/copilot-store";
import { useToast } from "@/components/Toast";
import { gqlClient } from "@/lib/sui-graphql";

const CAPSULE_PACKAGE = "0x6f0a3c7df312c0d07d1dafbc38e4acbbfedaa6f651aab4efa764a91221b1cb53";

export function useCapsuleNotifications() {
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const toast = useToast();
  const checked = useRef(false);

  useEffect(() => {
    if (!walletAddress || checked.current) return;
    checked.current = true;

    gqlClient.query({
      query: `{
        objects(filter: { type: "${CAPSULE_PACKAGE}::capsule::Capsule", owner: "${walletAddress}" }, first: 20) {
          nodes { asMoveObject { contents { json } } }
        }
      }` as any,
    } as any).then((res: any) => {
      const nodes = (res.data as any)?.objects?.nodes || [];
      const now = Date.now();
      let unlockable = 0;
      let soonUnlock = 0;

      for (const n of nodes) {
        const unlockDate = Number(n.asMoveObject?.contents?.json?.unlock_date || 0);
        if (unlockDate <= now) unlockable++;
        else if (unlockDate - now < 3600000) soonUnlock++; // < 1 hour
      }

      if (unlockable > 0) toast(`🔓 ${unlockable} capsule${unlockable > 1 ? "s" : ""} ready to unlock!`, "success");
      if (soonUnlock > 0) toast(`⏰ ${soonUnlock} capsule${soonUnlock > 1 ? "s" : ""} unlocking within 1 hour`, "info");
    }).catch(() => {});
  }, [walletAddress, toast]);
}
