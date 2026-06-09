// ============================================================
// Marina Copilot — PTB Compiler Unit Tests
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SwapIntent, StakeIntent, AppError, ErrorCode, PTBCompilerOutput } from "@/types";

// Mock external dependencies before importing the module
vi.mock("@mysten/sui/client", () => {
  const mockGetBalance = vi.fn();
  const mockDryRunTransactionBlock = vi.fn();
  const mockGetLatestSuiSystemState = vi.fn();
  return {
    SuiClient: vi.fn().mockImplementation(() => ({
      getBalance: mockGetBalance,
      dryRunTransactionBlock: mockDryRunTransactionBlock,
      getCoins: vi.fn().mockResolvedValue({ data: [] }),
      getLatestSuiSystemState: mockGetLatestSuiSystemState,
    })),
    __mockGetBalance: mockGetBalance,
    __mockDryRunTransactionBlock: mockDryRunTransactionBlock,
    __mockGetLatestSuiSystemState: mockGetLatestSuiSystemState,
  };
});

vi.mock("@mysten/sui/transactions", () => {
  const mockBuild = vi.fn().mockResolvedValue(new Uint8Array(32));
  const mockSerialize = vi.fn().mockReturnValue(new Uint8Array(32));
  return {
    Transaction: vi.fn().mockImplementation(() => ({
      setSender: vi.fn(),
      splitCoins: vi.fn().mockReturnValue([{}]),
      transferObjects: vi.fn(),
      moveCall: vi.fn(),
      object: vi.fn().mockReturnValue({}),
      gas: {},
      pure: {
        u64: vi.fn().mockReturnValue({}),
        address: vi.fn().mockReturnValue({}),
      },
      build: mockBuild,
      serialize: mockSerialize,
    })),
  };
});

vi.mock("@cetusprotocol/aggregator-sdk", () => {
  const BN = vi.fn().mockImplementation((val: string) => ({
    toString: () => val,
  }));

  const mockFindRouters = vi.fn();
  const mockFastRouterSwap = vi.fn().mockResolvedValue(undefined);

  return {
    AggregatorClient: vi.fn().mockImplementation(() => ({
      findRouters: mockFindRouters,
      fastRouterSwap: mockFastRouterSwap,
      getAllCoins: vi.fn().mockResolvedValue([]),
    })),
    Env: { Mainnet: 0, Testnet: 1 },
    __mockFindRouters: mockFindRouters,
    __mockFastRouterSwap: mockFastRouterSwap,
  };
});

// Import after mocks
import { compileSwap, compileStake } from "@/services/ptb-compiler";

// Get mock references
const cetusModule = await import("@cetusprotocol/aggregator-sdk");
const suiClientModule = await import("@mysten/sui/client");
const mockFindRouters = (cetusModule as unknown as { __mockFindRouters: ReturnType<typeof vi.fn> }).__mockFindRouters;
const mockGetBalance = (suiClientModule as unknown as { __mockGetBalance: ReturnType<typeof vi.fn> }).__mockGetBalance;
const mockGetLatestSuiSystemState = (suiClientModule as unknown as { __mockGetLatestSuiSystemState: ReturnType<typeof vi.fn> }).__mockGetLatestSuiSystemState;

function isAppError(result: PTBCompilerOutput | AppError): result is AppError {
  return "code" in result;
}

function isPTBOutput(result: PTBCompilerOutput | AppError): result is PTBCompilerOutput {
  return "transactionBytes" in result && "metadata" in result;
}

// Helper to create a mock router result
function createMockRouterData(amountIn: string, amountOut: string) {
  return {
    amountIn: { toString: () => amountIn },
    amountOut: { toString: () => amountOut },
    insufficientLiquidity: false,
    routes: [
      {
        path: [
          {
            id: "pool-1",
            direction: true,
            provider: "CETUS",
            from: "0x2::sui::SUI",
            target: "0xa1ec::usdc::USDC",
            feeRate: 0.003,
            amountIn: Number(amountIn),
            amountOut: Number(amountOut),
          },
        ],
        amountIn: { toString: () => amountIn },
        amountOut: { toString: () => amountOut },
        initialPrice: { toNumber: () => Number(amountOut) / Number(amountIn) },
      },
    ],
  };
}

describe("PTB Compiler - compileSwap", () => {
  const testWallet = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: sufficient balance
    mockGetBalance.mockResolvedValue({ totalBalance: "10000000000" }); // 10 SUI
  });

  describe("Metadata completeness", () => {
    it("should return all required metadata fields for a successful swap", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "USDC",
        amount: 1,
      };

      mockFindRouters.mockResolvedValue(
        createMockRouterData("1000000000", "4000000") // 1 SUI → 4 USDC
      );

      const result = await compileSwap(intent, testWallet);

      expect(isPTBOutput(result)).toBe(true);
      if (!isPTBOutput(result)) return;

      // Check metadata has all required fields
      expect(result.metadata.type).toBe("swap");
      expect(result.metadata.steps).toBeDefined();
      expect(result.metadata.steps.length).toBeGreaterThan(0);
      expect(result.metadata.gasEstimate).toBeDefined();
      expect(typeof result.metadata.gasEstimate).toBe("number");
      expect(result.metadata.route).toBeDefined();
      expect(Array.isArray(result.metadata.route)).toBe(true);
      expect(result.metadata.route!.length).toBeGreaterThan(0);
      expect(result.metadata.exchangeRate).toBeDefined();
      expect(typeof result.metadata.exchangeRate).toBe("number");
      expect(result.metadata.estimatedOutput).toBeDefined();
      expect(typeof result.metadata.estimatedOutput).toBe("number");
      expect(result.metadata.minimumOutput).toBeDefined();
      expect(typeof result.metadata.minimumOutput).toBe("number");
      expect(result.metadata.priceImpact).toBeDefined();
      expect(typeof result.metadata.priceImpact).toBe("number");

      // Check transactionBytes is a non-empty base64 string
      expect(result.transactionBytes).toBeDefined();
      expect(result.transactionBytes.length).toBeGreaterThan(0);
    });

    it("should include steps with correct structure", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "USDC",
        toToken: "SUI",
        amount: 10,
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "100000000" }); // 100 USDC
      mockFindRouters.mockResolvedValue(
        createMockRouterData("10000000", "2500000000") // 10 USDC → 2.5 SUI
      );

      const result = await compileSwap(intent, testWallet);

      expect(isPTBOutput(result)).toBe(true);
      if (!isPTBOutput(result)) return;

      for (const step of result.metadata.steps) {
        expect(step.index).toBeDefined();
        expect(typeof step.index).toBe("number");
        expect(step.description).toBeDefined();
        expect(step.description.length).toBeGreaterThan(0);
        expect(["split", "swap", "stake", "receive"]).toContain(step.type);
      }
    });
  });

  describe("Insufficient balance error", () => {
    it("should return error with available and required amounts", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "USDC",
        toToken: "SUI",
        amount: 100,
      };

      // Only 50 USDC available
      mockGetBalance.mockResolvedValue({ totalBalance: "50000000" }); // 50 USDC (6 decimals)

      const result = await compileSwap(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
      // Message should contain available and required amounts
      expect(result.message).toContain("50");
      expect(result.message).toContain("100");
      expect(result.message).toContain("USDC");
    });

    it("should account for gas reserve when source is SUI", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "USDC",
        amount: 10,
      };

      // Has 10 SUI, but needs 0.05 SUI for gas, so only 9.95 usable
      mockGetBalance.mockResolvedValue({ totalBalance: "10000000000" }); // 10 SUI

      mockFindRouters.mockResolvedValue(
        createMockRouterData("10000000000", "40000000")
      );

      const result = await compileSwap(intent, testWallet);

      // Should fail because 10 SUI - 0.05 gas = 9.95 usable < 10 required
      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
      expect(result.message).toContain("9.95");
      expect(result.message).toContain("10");
    });
  });

  describe("Default slippage calculation", () => {
    it("should set minimumOutput = estimatedOutput * 0.99 when no slippage specified", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "USDC",
        amount: 1,
        // No slippageTolerance specified — defaults to 1%
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "100000000000" }); // 100 SUI
      mockFindRouters.mockResolvedValue(
        createMockRouterData("1000000000", "4000000") // 1 SUI → 4 USDC
      );

      const result = await compileSwap(intent, testWallet);

      expect(isPTBOutput(result)).toBe(true);
      if (!isPTBOutput(result)) return;

      const estimatedOutput = result.metadata.estimatedOutput!;
      const minimumOutput = result.metadata.minimumOutput!;

      // minimumOutput should be estimatedOutput * 0.99
      expect(minimumOutput).toBeCloseTo(estimatedOutput * 0.99, 6);
    });

    it("should use custom slippage when specified", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "USDC",
        amount: 1,
        slippageTolerance: 0.005, // 0.5%
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "100000000000" }); // 100 SUI
      mockFindRouters.mockResolvedValue(
        createMockRouterData("1000000000", "4000000") // 1 SUI → 4 USDC
      );

      const result = await compileSwap(intent, testWallet);

      expect(isPTBOutput(result)).toBe(true);
      if (!isPTBOutput(result)) return;

      const estimatedOutput = result.metadata.estimatedOutput!;
      const minimumOutput = result.metadata.minimumOutput!;

      // minimumOutput should be estimatedOutput * 0.995
      expect(minimumOutput).toBeCloseTo(estimatedOutput * 0.995, 6);
    });
  });

  describe("No route error", () => {
    it("should return NO_ROUTE when Cetus returns null", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "WETH",
        amount: 1,
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "100000000000" });
      mockFindRouters.mockResolvedValue(null);

      const result = await compileSwap(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.NO_ROUTE);
      expect(result.message).toContain("SUI");
      expect(result.message).toContain("WETH");
      expect(result.message).toContain("No route available");
    });

    it("should return NO_ROUTE when Cetus returns insufficient liquidity", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "USDC",
        amount: 1,
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "100000000000" });
      mockFindRouters.mockResolvedValue({
        amountIn: { toString: () => "0" },
        amountOut: { toString: () => "0" },
        insufficientLiquidity: true,
        routes: [],
      });

      const result = await compileSwap(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.NO_ROUTE);
    });

    it("should return NO_ROUTE when Cetus throws an error", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "USDC",
        amount: 1,
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "100000000000" });
      mockFindRouters.mockRejectedValue(new Error("Network error"));

      const result = await compileSwap(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.NO_ROUTE);
    });
  });

  describe("Cetus timeout handling", () => {
    it("should return ROUTING_TIMEOUT when Cetus exceeds 10s", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "USDC",
        amount: 1,
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "100000000000" });

      // Simulate timeout by rejecting with AbortError
      const abortError = new Error("Cetus routing timeout");
      abortError.name = "AbortError";
      mockFindRouters.mockRejectedValue(abortError);

      const result = await compileSwap(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.ROUTING_TIMEOUT);
      expect(result.message).toContain("took too long");
    });
  });

  describe("Unknown token handling", () => {
    it("should return error for unknown fromToken", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "FAKECOIN",
        toToken: "SUI",
        amount: 1,
      };

      const result = await compileSwap(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.UNKNOWN_TOKEN);
      expect(result.message).toContain("FAKECOIN");
    });

    it("should return error for unknown toToken", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "NONEXIST",
        amount: 1,
      };

      const result = await compileSwap(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.UNKNOWN_TOKEN);
      expect(result.message).toContain("NONEXIST");
    });
  });

  describe("Gas reserve for SUI source", () => {
    it("should include gas reserve step when source is SUI", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "SUI",
        toToken: "USDC",
        amount: 1,
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "100000000000" }); // 100 SUI
      mockFindRouters.mockResolvedValue(
        createMockRouterData("1000000000", "4000000")
      );

      const result = await compileSwap(intent, testWallet);

      expect(isPTBOutput(result)).toBe(true);
      if (!isPTBOutput(result)) return;

      // Should have a "split" step for gas reserve
      const splitStep = result.metadata.steps.find((s) => s.type === "split");
      expect(splitStep).toBeDefined();
      expect(splitStep!.description).toContain("gas");
    });

    it("should not include gas reserve step when source is not SUI", async () => {
      const intent: SwapIntent = {
        action: "swap",
        fromToken: "USDC",
        toToken: "SUI",
        amount: 10,
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "100000000" }); // 100 USDC
      mockFindRouters.mockResolvedValue(
        createMockRouterData("10000000", "2500000000")
      );

      const result = await compileSwap(intent, testWallet);

      expect(isPTBOutput(result)).toBe(true);
      if (!isPTBOutput(result)) return;

      const splitStep = result.metadata.steps.find((s) => s.type === "split");
      expect(splitStep).toBeUndefined();
    });
  });
});


// --- Helper for stake tests ---

function createMockSystemState(validators: Array<{
  name: string;
  suiAddress: string;
  stakingPoolSuiBalance: string;
  poolTokenBalance: string;
  commissionRate: string;
}>) {
  return {
    epoch: "100",
    activeValidators: validators.map((v) => ({
      name: v.name,
      suiAddress: v.suiAddress,
      stakingPoolSuiBalance: v.stakingPoolSuiBalance,
      poolTokenBalance: v.poolTokenBalance,
      commissionRate: v.commissionRate,
      stakingPoolActivationEpoch: "0",
      votingPower: "100",
      gasPrice: "1000",
      nextEpochGasPrice: "1000",
      nextEpochCommissionRate: v.commissionRate,
    })),
  };
}

describe("PTB Compiler - compileStake", () => {
  const testWallet = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: sufficient balance (100 SUI)
    mockGetBalance.mockResolvedValue({ totalBalance: "100000000000" });
    // Default: valid system state with validators
    mockGetLatestSuiSystemState.mockResolvedValue(
      createMockSystemState([
        {
          name: "Mysten Labs",
          suiAddress: "0xaaa1",
          stakingPoolSuiBalance: "1030000000000", // 1030 SUI (3% gain)
          poolTokenBalance: "1000000000000",      // 1000 tokens
          commissionRate: "500", // 5%
        },
        {
          name: "Sui Foundation",
          suiAddress: "0xbbb2",
          stakingPoolSuiBalance: "1050000000000", // 1050 SUI (5% gain)
          poolTokenBalance: "1000000000000",      // 1000 tokens
          commissionRate: "200", // 2%
        },
        {
          name: "Low APY Validator",
          suiAddress: "0xccc3",
          stakingPoolSuiBalance: "1010000000000", // 1010 SUI (1% gain)
          poolTokenBalance: "1000000000000",      // 1000 tokens
          commissionRate: "1000", // 10%
        },
      ])
    );
  });

  describe("Below minimum stake amount", () => {
    it("should return BELOW_MINIMUM error when amount < 1 SUI", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 0.5,
      };

      const result = await compileStake(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.BELOW_MINIMUM);
      expect(result.message).toContain("1 SUI");
      expect(result.message).toContain("0.5");
    });

    it("should return BELOW_MINIMUM for zero amount", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 0,
      };

      const result = await compileStake(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.BELOW_MINIMUM);
    });
  });

  describe("Insufficient balance for stake", () => {
    it("should return INSUFFICIENT_BALANCE with available stakeable amount", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 100,
      };

      // Only 50 SUI available
      mockGetBalance.mockResolvedValue({ totalBalance: "50000000000" }); // 50 SUI

      const result = await compileStake(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
      // Should mention available amount (50 - 0.05 gas reserve = 49.95)
      expect(result.message).toContain("49.95");
      expect(result.message).toContain("100");
      expect(result.details).toBeDefined();
      expect((result.details as { available: number }).available).toBeCloseTo(49.95, 2);
      expect((result.details as { required: number }).required).toBe(100);
    });

    it("should handle zero balance", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 5,
      };

      mockGetBalance.mockResolvedValue({ totalBalance: "0" });

      const result = await compileStake(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.INSUFFICIENT_BALANCE);
    });
  });

  describe("Highest APY validator selection", () => {
    it("should select the validator with highest APY when no preference", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 10,
      };

      const result = await compileStake(intent, testWallet);

      expect(isPTBOutput(result)).toBe(true);
      if (!isPTBOutput(result)) return;

      // "Sui Foundation" has the highest APY (5% gain ratio vs 3% and 1%)
      expect(result.metadata.validatorName).toBe("Sui Foundation");
      expect(result.metadata.estimatedApy).toBeDefined();
      expect(result.metadata.estimatedApy!).toBeGreaterThan(0);
    });

    it("should select validator by name when preference is given", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 10,
        validator: "Mysten Labs",
      };

      const result = await compileStake(intent, testWallet);

      expect(isPTBOutput(result)).toBe(true);
      if (!isPTBOutput(result)) return;

      expect(result.metadata.validatorName).toBe("Mysten Labs");
    });
  });

  describe("Valid stake produces complete metadata", () => {
    it("should return metadata with validator name, APY (2 decimals), and gas estimate", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 10,
      };

      const result = await compileStake(intent, testWallet);

      expect(isPTBOutput(result)).toBe(true);
      if (!isPTBOutput(result)) return;

      // Check all required metadata fields
      expect(result.metadata.type).toBe("stake");
      expect(result.metadata.validatorName).toBeDefined();
      expect(result.metadata.validatorName!.length).toBeGreaterThan(0);
      expect(result.metadata.estimatedApy).toBeDefined();
      expect(typeof result.metadata.estimatedApy).toBe("number");
      // APY should be rounded to 2 decimal places
      const apyStr = result.metadata.estimatedApy!.toString();
      const decimalPart = apyStr.split(".")[1];
      if (decimalPart) {
        expect(decimalPart.length).toBeLessThanOrEqual(2);
      }
      expect(result.metadata.gasEstimate).toBeDefined();
      expect(typeof result.metadata.gasEstimate).toBe("number");
      expect(result.metadata.gasEstimate).toBeGreaterThan(0);

      // Check transactionBytes is present
      expect(result.transactionBytes).toBeDefined();
      expect(result.transactionBytes.length).toBeGreaterThan(0);

      // Check steps are present
      expect(result.metadata.steps.length).toBeGreaterThan(0);
      const stakeStep = result.metadata.steps.find((s) => s.type === "stake");
      expect(stakeStep).toBeDefined();
      expect(stakeStep!.description).toContain("10");
      expect(stakeStep!.description).toContain("SUI");
    });
  });

  describe("Validator data unavailable", () => {
    it("should return VALIDATOR_UNAVAILABLE when system state fetch fails", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 10,
      };

      mockGetLatestSuiSystemState.mockRejectedValue(new Error("Network error"));

      const result = await compileStake(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.VALIDATOR_UNAVAILABLE);
      expect(result.message).toContain("temporarily unavailable");
    });

    it("should return VALIDATOR_UNAVAILABLE when active validators are empty", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 10,
      };

      mockGetLatestSuiSystemState.mockResolvedValue({
        epoch: "100",
        activeValidators: [],
      });

      const result = await compileStake(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.VALIDATOR_UNAVAILABLE);
    });

    it("should return VALIDATOR_UNAVAILABLE when preferred validator not found", async () => {
      const intent: StakeIntent = {
        action: "stake",
        token: "SUI",
        amount: 10,
        validator: "NonExistentValidator",
      };

      const result = await compileStake(intent, testWallet);

      expect(isAppError(result)).toBe(true);
      if (!isAppError(result)) return;

      expect(result.code).toBe(ErrorCode.VALIDATOR_UNAVAILABLE);
      expect(result.message).toContain("NonExistentValidator");
    });
  });
});
