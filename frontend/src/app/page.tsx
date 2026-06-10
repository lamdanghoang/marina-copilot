"use client";

import { useCopilotStore } from "@/store/copilot-store";
import { LandingPage } from "@/components/LandingPage";
import { AppLayout } from "@/components/AppLayout";

export default function Home() {
  const walletAddress = useCopilotStore((s) => s.walletAddress);

  if (!walletAddress) {
    return <LandingPage onConnect={() => {}} />;
  }

  return <AppLayout />;
}
