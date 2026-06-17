// ============================================================
// Marina Copilot — Centralized Configuration
// Reads from environment variables with sensible defaults
// ============================================================

export interface AppConfig {
  port: number;
  corsOrigin: string;
  aws: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  bedrock: {
    modelId: string;
    timeoutMs: number;
  };
  sui: {
    rpcUrl: string;
  };
  memwal: {
    delegateKey: string;
    accountId: string;
    serverUrl: string;
    timeoutMs: number;
  };
  cetus: {
    apiUrl: string;
    timeoutMs: number;
  };
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || "3001", 10),
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:3000",
    aws: {
      region: process.env.AWS_REGION || "us-east-1",
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
    bedrock: {
      modelId:
        process.env.BEDROCK_MODEL_ID || "anthropic.claude-sonnet-4-20250514",
      timeoutMs: 8000,
    },
    sui: {
      rpcUrl:
        process.env.SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443",
    },
    memwal: {
      delegateKey: process.env.MEMWAL_DELEGATE_KEY || "",
      accountId: process.env.MEMWAL_ACCOUNT_ID || "",
      serverUrl:
        process.env.MEMWAL_SERVER_URL ||
        "https://relayer-staging.memory.walrus.xyz",
      timeoutMs: 5000,
    },
    cetus: {
      apiUrl: process.env.CETUS_API_URL || "",
      timeoutMs: 10000,
    },
  };
}

/** Singleton config instance */
export const config = loadConfig();
