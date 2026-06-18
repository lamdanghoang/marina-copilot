// ============================================================
// Marina Copilot — Shared TypeScript Interfaces (Frontend)
// Mirrors backend types for API communication compatibility
// ============================================================

// --- Error Types ---

export enum ErrorCode {
  NO_ROUTE = "NO_ROUTE",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  BELOW_MINIMUM = "BELOW_MINIMUM",
  UNKNOWN_TOKEN = "UNKNOWN_TOKEN",
  ROUTING_TIMEOUT = "ROUTING_TIMEOUT",
  VALIDATOR_UNAVAILABLE = "VALIDATOR_UNAVAILABLE",
  LLM_TIMEOUT = "LLM_TIMEOUT",
  LLM_ERROR = "LLM_ERROR",
  MEMORY_UNAVAILABLE = "MEMORY_UNAVAILABLE",
  TX_FAILED = "TX_FAILED",
  TX_TIMEOUT = "TX_TIMEOUT",
  WALLET_REJECTED = "WALLET_REJECTED",
}

export interface AppError {
  code: ErrorCode;
  message: string;
  suggestion?: string;
  details?: unknown;
}

// --- Chat & Messaging ---

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  type: "text" | "preview" | "success" | "error" | "clarification";
  timestamp: number;
  metadata?: {
    memoryIndicator?: string;
    txDigest?: string;
    explorerUrl?: string;
  };
}

// --- Token & Balance ---

export interface TokenBalance {
  token: string;
  symbol: string;
  balance: number;
  decimals: number;
  valueUsd?: number;
}

export interface PortfolioBalance {
  token: string;
  balance: number;
  valueUsd: number;
}

// --- Intent Types ---

export interface SwapIntent {
  action: "swap";
  fromToken: string;
  toToken: string;
  amount: number;
  dex?: string;
  slippageTolerance?: number;
}

export interface StakeIntent {
  action: "stake";
  token: "SUI";
  amount: number;
  validator?: string;
}

export interface QueryIntent {
  action: "query";
  queryType: "balance" | "history";
}

export interface CreateCapsuleIntent {
  action: "create_capsule";
  content: string;
  unlockAfterMinutes: number;
  recipient?: string;
}

export interface UploadFileIntent {
  action: "upload_file";
}

export interface TransferIntent {
  action: "transfer";
  token: string;
  amount: number;
  recipient: string;
}

export type StructuredIntent = SwapIntent | StakeIntent | QueryIntent | CreateCapsuleIntent | UploadFileIntent | TransferIntent;

// --- PTB & Transaction ---

export interface PTBStep {
  index: number;
  description: string;
  type: "split" | "swap" | "stake" | "receive";
}

export interface TransactionMetadata {
  type: "swap" | "stake";
  steps: PTBStep[];
  gasEstimate: number;
  // Swap-specific
  route?: string[];
  exchangeRate?: number;
  estimatedOutput?: number;
  minimumOutput?: number;
  priceImpact?: number;
  // Stake-specific
  validatorName?: string;
  estimatedApy?: number;
}

// --- Risk & Guardian ---

export interface RiskWarning {
  class: "HIGH_SLIPPAGE" | "CONCENTRATION";
  severity: "warning" | "elevated" | "danger";
  explanation: string;
  suggestion: string;
  data: {
    // Slippage
    priceImpact?: number;
    estimatedLoss?: number;
    // Concentration
    resultingPercentage?: number;
    asset?: string;
  };
}

// --- API Request/Response ---

export interface ProcessIntentRequest {
  message: string;
  walletAddress: string;
  conversationHistory: ChatMessage[];
  balances: TokenBalance[];
  memwalCredentials?: {
    accountId: string;
    delegateKey: string;
  };
}

export interface ProcessIntentResponse {
  type: "clarification" | "preview" | "error" | "info" | "action_request";
  // Optional memory indicator shown when preferences are applied
  memoryIndicator?: string | null;
  // When type = "clarification"
  clarification?: {
    message: string;
    options?: string[];
  };
  // When type = "preview"
  preview?: {
    steps: PTBStep[];
    metadata: TransactionMetadata;
    risks: RiskWarning[];
    assessment: "safe" | "warning" | "danger";
    transactionBytes: string;
  };
  // When type = "error"
  error?: {
    message: string;
    suggestion?: string;
  };
  // When type = "info" (read-only query response)
  info?: {
    message: string;
  };
  // When type = "action_request"
  actionRequest?: {
    action: "create_capsule" | "upload_file";
    params: Record<string, unknown>;
    message: string;
  };
}

// --- Memory ---

export interface MemoryRecord {
  id: string;
  type: "preference" | "transaction" | "behavioral";
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryContent {
  type: "preference" | "transaction";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MemwalCredentials {
  accountId: string;
  delegateKey: string;
}
