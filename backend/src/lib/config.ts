// ============================================================
// DeFi Copilot — Centralized Configuration
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
    apiKey: string;
    delegateKey: string;
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
        process.env.SUI_RPC_URL || "https://fullnode.testnet.sui.io:443",
    },
    memwal: {
      apiKey: process.env.MEMWAL_API_KEY || "",
      delegateKey: process.env.MEMWAL_DELEGATE_KEY || "",
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
