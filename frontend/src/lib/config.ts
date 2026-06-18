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
    walCoinType: "0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL",
    walExchangePackage: "0x82593828ed3fcb8c6a235eac9abd0adbe9c5f9bbffa9b1e7a45cdd884481ef9f",
    walExchangeId: "0xf4d164ea2def5fe07dc573992a029e010dba09b1a8dcbc44c5c2e79567f39073",
    sealPackageId: process.env.NEXT_PUBLIC_SEAL_PACKAGE_ID || "0x6f0a3c7df312c0d07d1dafbc38e4acbbfedaa6f651aab4efa764a91221b1cb53",
  },
  testnet: {
    network: "testnet" as const,
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    explorerBase: "https://suiscan.xyz/testnet/tx/",
    walrusPublisher: "https://publisher.walrus-testnet.walrus.space",
    walrusAggregator: "https://aggregator.walrus-testnet.walrus.space",
    walCoinType: "0x8270feb7375eee355e64fdb69c50abb6b5f9393a722883c1cf45f8e26048810a::wal::WAL",
    walExchangePackage: "0x82593828ed3fcb8c6a235eac9abd0adbe9c5f9bbffa9b1e7a45cdd884481ef9f",
    walExchangeId: "0xf4d164ea2def5fe07dc573992a029e010dba09b1a8dcbc44c5c2e79567f39073",
    sealPackageId: process.env.NEXT_PUBLIC_SEAL_PACKAGE_ID || "0x6f0a3c7df312c0d07d1dafbc38e4acbbfedaa6f651aab4efa764a91221b1cb53",
  },
} as const;

export const networkConfig = NETWORK_CONFIG[network];
export const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
export const config = { apiUrl, suiNetwork: network };
