export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001",
  suiNetwork: (process.env.NEXT_PUBLIC_SUI_NETWORK || "testnet") as "testnet" | "mainnet",
} as const;
