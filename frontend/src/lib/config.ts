// Frontend network config — all derived from NEXT_PUBLIC_SUI_NETWORK env

type Network = "mainnet" | "testnet";

const network: Network = (process.env.NEXT_PUBLIC_SUI_NETWORK as Network) || "testnet";

const NETWORK_CONFIG = {
  mainnet: {
    network: "mainnet" as const,
    rpcUrl: "https://fullnode.mainnet.sui.io:443",
    explorerBase: "https://suiscan.xyz/mainnet/tx/",
    walrusPublisher: "https://publisher.walrus.space",
    walrusAggregator: "https://aggregator.walrus.space",
  },
  testnet: {
    network: "testnet" as const,
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    explorerBase: "https://suiscan.xyz/testnet/tx/",
    walrusPublisher: "https://publisher.walrus-testnet.walrus.space",
    walrusAggregator: "https://aggregator.walrus-testnet.walrus.space",
  },
} as const;

export const networkConfig = NETWORK_CONFIG[network];
export const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
export const config = { apiUrl, suiNetwork: network };
