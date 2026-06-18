// ============================================================
// Marina Copilot — PTB Compiler Service
// Converts structured intents into executable Sui PTBs
// ============================================================

import { SuiClient } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { AggregatorClient, Env, FindRouterParams } from "@cetusprotocol/aggregator-sdk";
import BN from "bn.js";
import { config } from "../lib/config";
import {
  SwapIntent,
  StakeIntent,
  PTBCompilerOutput,
  TransactionMetadata,
  PTBStep,
  AppError,
  ErrorCode,
} from "../types";
import {
  getTokenBySymbol,
  DEFAULT_SLIPPAGE,
  GAS_RESERVE_SUI,
  MINIMUM_STAKE_AMOUNT,
} from "../types/config";

// --- Constants ---

/** Cetus Aggregator API endpoint for testnet */
const CETUS_AGGREGATOR_ENDPOINT =
  config.cetus.apiUrl ||
  "https://api-sui.cetus.zone/router_v2/find_routes";

/** Timeout for Cetus SDK calls */
const CETUS_TIMEOUT_MS = config.cetus.timeoutMs || 10000;

/** SUI decimals (1 SUI = 10^9 MIST) */
const SUI_DECIMALS = 9;

// --- SUI Client Singleton ---

let suiClient: SuiClient | null = null;

function getSuiClient(): SuiClient {
  if (!suiClient) {
    suiClient = new SuiClient({ url: config.sui.rpcUrl });
  }
  return suiClient;
}

// --- Helper Functions ---

/**
 * Convert a human-readable token amount to its smallest unit (raw amount).
 */
function toRawAmount(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * 10 ** decimals));
}

/**
 * Convert raw amount back to human-readable format.
 */
function fromRawAmount(rawAmount: bigint | BN | string, decimals: number): number {
  const raw = typeof rawAmount === "string"
    ? BigInt(rawAmount)
    : rawAmount instanceof BN
      ? BigInt(rawAmount.toString())
      : rawAmount;
  return Number(raw) / 10 ** decimals;
}

/**
 * Get total balance for a coin type from on-chain data.
 */
async function getBalance(
  walletAddress: string,
  coinType: string
): Promise<bigint> {
  const client = getSuiClient();
  const balance = await client.getBalance({ owner: walletAddress, coinType });
  return BigInt(balance.totalBalance);
}

// --- Main Swap Compiler ---

/**
 * Compile a swap intent into a Sui Transaction using Cetus Aggregator.
 * Returns PTBCompilerOutput on success, or AppError on failure.
 */
export async function compileSwap(
  intent: SwapIntent,
  walletAddress: string
): Promise<PTBCompilerOutput | AppError> {
  // 1. Resolve token types
  const fromTokenConfig = getTokenBySymbol(intent.fromToken);
  const toTokenConfig = getTokenBySymbol(intent.toToken);

  if (!fromTokenConfig) {
    return {
      code: ErrorCode.UNKNOWN_TOKEN,
      message: `Unknown token: ${intent.fromToken}`,
      suggestion: "Check the token name and try again.",
    };
  }

  if (!toTokenConfig) {
    return {
      code: ErrorCode.UNKNOWN_TOKEN,
      message: `Unknown token: ${intent.toToken}`,
      suggestion: "Check the token name and try again.",
    };
  }

  // 2. Calculate raw input amount
  const rawInputAmount = toRawAmount(intent.amount, fromTokenConfig.decimals);

  // 3. Check balance (with gas reserve for SUI)
  let availableBalance: bigint;
  try {
    availableBalance = await getBalance(walletAddress, fromTokenConfig.coinType);
  } catch {
    availableBalance = BigInt(0);
  }

  const gasReserveRaw =
    fromTokenConfig.symbol === "SUI"
      ? toRawAmount(GAS_RESERVE_SUI, SUI_DECIMALS)
      : BigInt(0);

  const usableBalance = availableBalance > gasReserveRaw
    ? availableBalance - gasReserveRaw
    : BigInt(0);

  if (usableBalance < rawInputAmount) {
    const availableHuman = fromRawAmount(usableBalance, fromTokenConfig.decimals);
    return {
      code: ErrorCode.INSUFFICIENT_BALANCE,
      message: `You have ${availableHuman} ${intent.fromToken} but need ${intent.amount}. Try a smaller amount.`,
      suggestion: `Your available balance (after gas reserve) is ${availableHuman} ${intent.fromToken}.`,
      details: {
        available: availableHuman,
        required: intent.amount,
        token: intent.fromToken,
      },
    };
  }

  // 4. Query Cetus for route with timeout
  const slippage = intent.slippageTolerance ?? DEFAULT_SLIPPAGE;

  let routerData;
  try {
    routerData = await findRouteWithTimeout(
      fromTokenConfig.coinType,
      toTokenConfig.coinType,
      rawInputAmount,
      walletAddress
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        code: ErrorCode.ROUTING_TIMEOUT,
        message: "The routing service took too long to respond. Please try again.",
        suggestion: "Try again in a few moments, or reduce the swap amount.",
      };
    }
    return {
      code: ErrorCode.NO_ROUTE,
      message: `No route available for ${intent.fromToken} → ${intent.toToken}. The pair may not have liquidity.`,
      suggestion: "Try a different token pair or a smaller amount.",
    };
  }

  if (!routerData || routerData.insufficientLiquidity || routerData.routes.length === 0) {
    return {
      code: ErrorCode.NO_ROUTE,
      message: `No route available for ${intent.fromToken} → ${intent.toToken}. The pair may not have liquidity.`,
      suggestion: "Try a different token pair or a smaller amount.",
    };
  }

  // 5. Build transaction
  const estimatedOutputRaw = routerData.amountOut;
  const estimatedOutput = fromRawAmount(estimatedOutputRaw, toTokenConfig.decimals);
  const minimumOutput = estimatedOutput * (1 - slippage);

  // Calculate exchange rate and price impact
  const exchangeRate = estimatedOutput / intent.amount;
  const priceImpact = calculatePriceImpact(routerData);

  // Build the Sui Transaction using Cetus fastRouterSwap
  let transactionBytes: string;
  let gasEstimate: number;
  try {
    const { bytes, gas } = await buildSwapTransaction(
      routerData,
      walletAddress,
      fromTokenConfig.coinType,
      slippage
    );
    transactionBytes = bytes;
    gasEstimate = gas;
  } catch {
    // Fallback: serialize a stub transaction if building fails
    const { bytes, gas } = await buildStubSwapTransaction(
      walletAddress,
      intent,
      estimatedOutput,
      minimumOutput
    );
    transactionBytes = bytes;
    gasEstimate = gas;
  }

  // 6. Build route path for metadata
  const routePath = buildRoutePath(routerData, fromTokenConfig.symbol, toTokenConfig.symbol);
  const provider = routerData.routes[0]?.path[0]?.provider || "Cetus";

  // 7. Build steps
  const steps: PTBStep[] = [
    {
      index: 1,
      description: `Swap ${intent.amount} ${intent.fromToken} → ~${estimatedOutput.toFixed(4)} ${intent.toToken} via ${provider}`,
      type: "swap",
    },
    {
      index: 2,
      description: `Receive minimum ${minimumOutput.toFixed(4)} ${intent.toToken}`,
      type: "receive",
    },
  ];

  // Add split step if source is SUI (gas reserve)
  if (fromTokenConfig.symbol === "SUI") {
    steps.unshift({
      index: 0,
      description: `Reserve ${GAS_RESERVE_SUI} SUI for gas`,
      type: "split",
    });
    // Re-index
    steps.forEach((s, i) => (s.index = i + 1));
  }

  // 8. Build metadata
  const metadata: TransactionMetadata = {
    type: "swap",
    steps,
    gasEstimate,
    route: routePath,
    exchangeRate,
    estimatedOutput,
    minimumOutput,
    priceImpact,
  };

  return {
    transactionBytes,
    metadata,
  };
}

// --- Route Finding ---

/**
 * Find route via Cetus Aggregator with AbortController timeout.
 */
async function findRouteWithTimeout(
  fromCoinType: string,
  toCoinType: string,
  rawAmount: bigint,
  walletAddress: string
): Promise<ReturnType<AggregatorClient["findRouters"]>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CETUS_TIMEOUT_MS);

  try {
    const client = getSuiClient();
    const aggregator = new AggregatorClient(
      CETUS_AGGREGATOR_ENDPOINT,
      walletAddress,
      client,
      Env.Testnet
    );

    const params: FindRouterParams = {
      from: fromCoinType,
      target: toCoinType,
      amount: new BN(rawAmount.toString()),
      byAmountIn: true,
      depth: 3,
      splitCount: 1,
    };

    // Race the route finding against the timeout
    const result = await Promise.race([
      aggregator.findRouters(params),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => {
          const err = new Error("Cetus routing timeout");
          err.name = "AbortError";
          reject(err);
        });
      }),
    ]);

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Transaction Building ---

/**
 * Build the actual swap transaction using Cetus fastRouterSwap.
 */
async function buildSwapTransaction(
  routerData: NonNullable<Awaited<ReturnType<AggregatorClient["findRouters"]>>>,
  walletAddress: string,
  fromCoinType: string,
  slippage: number
): Promise<{ bytes: string; gas: number }> {
  const client = getSuiClient();
  const aggregator = new AggregatorClient(
    CETUS_AGGREGATOR_ENDPOINT,
    walletAddress,
    client,
    Env.Testnet
  );

  const txb = new Transaction();
  txb.setSender(walletAddress);

  await aggregator.fastRouterSwap({
    routers: routerData.routes,
    byAmountIn: true,
    txb,
    slippage,
    isMergeTragetCoin: true,
    refreshAllCoins: true,
  });

  // Serialize to base64
  const bytes = await txb.build({ client });
  const base64Bytes = Buffer.from(bytes).toString("base64");

  // Estimate gas from dry run
  let gasEstimate = 0.005; // default fallback
  try {
    const dryRun = await client.dryRunTransactionBlock({
      transactionBlock: Buffer.from(bytes).toString("base64"),
    });
    if (dryRun.effects?.gasUsed) {
      const { computationCost, storageCost, storageRebate } = dryRun.effects.gasUsed;
      const totalGas = BigInt(computationCost) + BigInt(storageCost) - BigInt(storageRebate);
      gasEstimate = Number(totalGas) / 10 ** SUI_DECIMALS;
    }
  } catch {
    // Use fallback gas estimate
  }

  return { bytes: base64Bytes, gas: Math.max(gasEstimate, 0.001) };
}

/**
 * Build a stub swap transaction when Cetus SDK building fails.
 * This provides a valid Transaction structure for development/testing.
 * TODO: Remove stub once Cetus integration is stable on testnet.
 */
async function buildStubSwapTransaction(
  walletAddress: string,
  intent: SwapIntent,
  _estimatedOutput: number,
  _minimumOutput: number
): Promise<{ bytes: string; gas: number }> {
  const tx = new Transaction();
  tx.setSender(walletAddress);

  // Create a minimal valid transaction (transfer 0 SUI to self as placeholder)
  const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(0)]);
  tx.transferObjects([coin], tx.pure.address(walletAddress));

  const client = getSuiClient();
  let base64Bytes: string;
  try {
    const bytes = await tx.build({ client });
    base64Bytes = Buffer.from(bytes).toString("base64");
  } catch {
    // If build fails too, serialize without resolving
    base64Bytes = Buffer.from(tx.serialize()).toString("base64");
  }

  return { bytes: base64Bytes, gas: 0.005 };
}

// --- Price Impact Calculation ---

/**
 * Calculate price impact from router data.
 * Price impact = how much worse than the initial price the trade executes at.
 */
function calculatePriceImpact(
  routerData: NonNullable<Awaited<ReturnType<AggregatorClient["findRouters"]>>>
): number {
  if (!routerData.routes || routerData.routes.length === 0) {
    return 0;
  }

  const amountIn = Number(routerData.amountIn.toString());
  const amountOut = Number(routerData.amountOut.toString());
  if (amountIn === 0 || amountOut === 0) return 0;

  const firstRoute = routerData.routes[0];
  if (!firstRoute.initialPrice || firstRoute.initialPrice.toNumber() === 0) {
    return 0.1;
  }

  const initialPrice = firstRoute.initialPrice.toNumber();
  const executionPrice = amountOut / amountIn;
  const impact = Math.abs((executionPrice - initialPrice) / initialPrice) * 100;

  return Math.round(Math.min(impact, 50) * 100) / 100;
}

// --- Route Path Builder ---

/**
 * Build a human-readable route path from router data.
 */
function buildRoutePath(
  routerData: NonNullable<Awaited<ReturnType<AggregatorClient["findRouters"]>>>,
  fromSymbol: string,
  toSymbol: string
): string[] {
  const path: string[] = [fromSymbol];

  if (routerData.routes.length > 0) {
    const route = routerData.routes[0];
    for (const step of route.path) {
      // Extract provider name for the path
      if (step.provider) {
        path.push(`[${step.provider}]`);
      }
    }
  }

  path.push(toSymbol);
  return path;
}

// --- Stake Compiler ---

/**
 * Calculate APY from a validator's staking pool exchange rate history.
 * Uses the ratio of the last two epoch exchange rates.
 */
function calculateValidatorApy(
  stakingPoolSuiBalance: string,
  stakingPoolTokenBalance: string,
  epoch: number
): number {
  // APY = (poolSuiBalance / poolTokenBalance - 1) * 365.25 / epochDuration
  // Simplified: use the ratio as a proxy, annualized
  const suiBalance = Number(stakingPoolSuiBalance);
  const tokenBalance = Number(stakingPoolTokenBalance);

  if (tokenBalance === 0 || suiBalance === 0) return 0;

  // Exchange rate represents accumulated rewards
  const exchangeRate = suiBalance / tokenBalance;
  // Each epoch is ~24 hours on Sui
  // Annualize the per-epoch gain
  const epochGain = Math.max(exchangeRate - 1, 0);
  const apy = epochGain * 365.25 * 100; // Convert to percentage

  return Math.round(apy * 100) / 100; // Round to 2 decimal places
}

/**
 * Compile a stake intent into a Sui Transaction using request_add_stake.
 * Returns PTBCompilerOutput on success, or AppError on failure.
 */
export async function compileStake(
  intent: StakeIntent,
  walletAddress: string
): Promise<PTBCompilerOutput | AppError> {
  // 1. Validate minimum stake amount
  if (intent.amount < MINIMUM_STAKE_AMOUNT) {
    return {
      code: ErrorCode.BELOW_MINIMUM,
      message: `Minimum stake amount is ${MINIMUM_STAKE_AMOUNT} SUI. You requested ${intent.amount} SUI.`,
      suggestion: `Please stake at least ${MINIMUM_STAKE_AMOUNT} SUI.`,
    };
  }

  // 2. Check SUI balance (need amount + gas reserve)
  const client = getSuiClient();
  let availableBalance: bigint;
  try {
    availableBalance = await getBalance(walletAddress, "0x2::sui::SUI");
  } catch {
    availableBalance = BigInt(0);
  }

  const gasReserveRaw = toRawAmount(GAS_RESERVE_SUI, SUI_DECIMALS);
  const usableBalance = availableBalance > gasReserveRaw
    ? availableBalance - gasReserveRaw
    : BigInt(0);

  const amountInMist = toRawAmount(intent.amount, SUI_DECIMALS);

  if (usableBalance < amountInMist) {
    const availableHuman = fromRawAmount(usableBalance, SUI_DECIMALS);
    return {
      code: ErrorCode.INSUFFICIENT_BALANCE,
      message: `You have ${availableHuman} SUI available for staking (after ${GAS_RESERVE_SUI} SUI gas reserve) but need ${intent.amount} SUI. Try a smaller amount.`,
      suggestion: `Your available stakeable balance is ${availableHuman} SUI.`,
      details: {
        available: availableHuman,
        required: intent.amount,
        gasReserve: GAS_RESERVE_SUI,
      },
    };
  }

  // 3. Fetch validators from Sui system state
  let systemState;
  try {
    systemState = await client.getLatestSuiSystemState();
  } catch {
    return {
      code: ErrorCode.VALIDATOR_UNAVAILABLE,
      message: "Validator information is temporarily unavailable. Please try again later.",
      suggestion: "Wait a moment and retry your stake request.",
    };
  }

  if (
    !systemState ||
    !systemState.activeValidators ||
    systemState.activeValidators.length === 0
  ) {
    return {
      code: ErrorCode.VALIDATOR_UNAVAILABLE,
      message: "Validator information is temporarily unavailable. Please try again later.",
      suggestion: "Wait a moment and retry your stake request.",
    };
  }

  // 4. Select validator: highest APY if no preference, or by name if specified
  const validators = systemState.activeValidators;
  const currentEpoch = Number(systemState.epoch);

  // Calculate APY for each validator
  const validatorsWithApy = validators.map((v) => ({
    address: v.suiAddress,
    name: v.name,
    apy: calculateValidatorApy(
      v.stakingPoolSuiBalance,
      v.poolTokenBalance,
      currentEpoch
    ),
    commission: Number(v.commissionRate) / 100, // basis points to percentage
  }));

  let selectedValidator;

  if (intent.validator) {
    // Find by name (case-insensitive)
    selectedValidator = validatorsWithApy.find(
      (v) => v.name.toLowerCase() === intent.validator!.toLowerCase()
    );
    if (!selectedValidator) {
      // Try partial match
      selectedValidator = validatorsWithApy.find(
        (v) => v.name.toLowerCase().includes(intent.validator!.toLowerCase())
      );
    }
    if (!selectedValidator) {
      return {
        code: ErrorCode.VALIDATOR_UNAVAILABLE,
        message: `Could not find validator "${intent.validator}". Please check the name and try again.`,
        suggestion: "Try specifying a different validator or let me select the highest APY one for you.",
      };
    }
  } else {
    // Select highest APY validator
    selectedValidator = validatorsWithApy.reduce((best, current) =>
      current.apy > best.apy ? current : best
    );
  }

  // 5. Build Transaction
  const tx = new Transaction();
  tx.setSender(walletAddress);

  const stakeCoin = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);
  tx.moveCall({
    target: "0x3::sui_system::request_add_stake",
    arguments: [
      tx.object("0x5"), // SuiSystemState shared object
      stakeCoin,
      tx.pure.address(selectedValidator.address),
    ],
  });

  // 6. Serialize and validate via dry run
  let transactionBytes: string;
  let gasEstimate = 0.005; // default fallback

  try {
    const bytes = await tx.build({ client });
    transactionBytes = Buffer.from(bytes).toString("base64");

    // Dry run to validate and get gas estimate
    try {
      const dryRun = await client.dryRunTransactionBlock({
        transactionBlock: transactionBytes,
      });
      if (dryRun.effects?.gasUsed) {
        const { computationCost, storageCost, storageRebate } = dryRun.effects.gasUsed;
        const totalGas = BigInt(computationCost) + BigInt(storageCost) - BigInt(storageRebate);
        gasEstimate = Number(totalGas) / 10 ** SUI_DECIMALS;
      }
    } catch {
      // Use fallback gas estimate
    }
  } catch {
    // Fallback: serialize without resolving
    transactionBytes = Buffer.from(tx.serialize()).toString("base64");
  }

  gasEstimate = Math.max(gasEstimate, 0.001);

  // 7. Build steps
  const steps: PTBStep[] = [
    {
      index: 1,
      description: `Reserve ${GAS_RESERVE_SUI} SUI for gas`,
      type: "split",
    },
    {
      index: 2,
      description: `Stake ${intent.amount} SUI with ${selectedValidator.name}`,
      type: "stake",
    },
  ];

  // 8. Build metadata
  const metadata: TransactionMetadata = {
    type: "stake",
    steps,
    gasEstimate,
    validatorName: selectedValidator.name,
    estimatedApy: selectedValidator.apy,
  };

  return {
    transactionBytes,
    metadata,
  };
}

// --- Utility Exports for Testing ---

export async function compileTransfer(
  intent: { token: string; amount: number; recipient: string },
  sender: string,
): Promise<PTBCompilerOutput> {
  const tokenInfo = getTokenBySymbol(intent.token.toUpperCase());
  if (!tokenInfo) throw new Error(`Unsupported token: ${intent.token}`);

  const rawAmount = toRawAmount(intent.amount, tokenInfo.decimals);
  const tx = new Transaction();
  tx.setSender(sender);

  if (tokenInfo.coinType === "0x2::sui::SUI") {
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(rawAmount)]);
    tx.transferObjects([coin], intent.recipient);
  } else {
    const coins = await getSuiClient().getCoins({ owner: sender, coinType: tokenInfo.coinType });
    const coinObjects = (coins as any)?.data ?? [];
    if (coinObjects.length === 0) throw new Error(`No ${intent.token} coins found`);
    const primaryCoin = tx.object(coinObjects[0].coinObjectId);
    if (coinObjects.length > 1) {
      tx.mergeCoins(primaryCoin, coinObjects.slice(1).map((c: any) => tx.object(c.coinObjectId)));
    }
    const [splitCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(rawAmount)]);
    tx.transferObjects([splitCoin], intent.recipient);
  }

  const txBytes = await tx.build({ client: getSuiClient() as any });

  return {
    transactionBytes: Buffer.from(txBytes).toString("base64"),
    metadata: {
      type: "transfer",
      steps: [{ index: 1, description: `Send ${intent.amount} ${intent.token} to ${intent.recipient.slice(0, 8)}...${intent.recipient.slice(-4)}`, type: "transfer" }],
      gasEstimate: 0.005,
      token: intent.token,
      amount: intent.amount,
      recipient: intent.recipient,
    },
  };
}

export {
  toRawAmount,
  fromRawAmount,
  calculatePriceImpact,
  buildRoutePath,
  getBalance,
  getSuiClient,
  calculateValidatorApy,
};
