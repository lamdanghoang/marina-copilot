"use client";

import { createDAppKit } from "@mysten/dapp-kit-core";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { networkConfig } from "@/lib/config";

const dAppKit = createDAppKit({
  networks: [networkConfig.network],
  createClient: (network) => new SuiGrpcClient({ network, baseUrl: networkConfig.rpcUrl } as any),
  defaultNetwork: networkConfig.network,
  autoConnect: true,
  slushWalletConfig: null,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <DAppKitProvider dAppKit={dAppKit}>
        {children}
      </DAppKitProvider>
    </QueryClientProvider>
  );
}
