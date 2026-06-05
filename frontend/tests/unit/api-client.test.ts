import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processIntent, remember, healthCheck } from "@/lib/api-client";
import type { ProcessIntentRequest, ProcessIntentResponse } from "@/types";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("api-client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("processIntent", () => {
    const request: ProcessIntentRequest = {
      message: "swap 100 USDC to SUI",
      walletAddress: "0x1234abcd5678ef90",
      conversationHistory: [],
      balances: [],
    };

    it("sends POST request to /api/process-intent and returns typed response", async () => {
      const mockResponse: ProcessIntentResponse = {
        type: "clarification",
        clarification: { message: "Which DEX do you prefer?" },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await processIntent(request);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/process-intent",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: expect.any(AbortSignal),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("throws ApiError with status on non-200 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: "Internal server error" }),
      });

      await expect(processIntent(request)).rejects.toMatchObject({
        message: "Internal server error",
        status: 500,
      });
    });

    it("throws timeout error when request exceeds 30 seconds", async () => {
      mockFetch.mockImplementation(
        (_url: string, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options.signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          })
      );

      const promise = processIntent(request);
      vi.advanceTimersByTime(30_000);

      await expect(promise).rejects.toMatchObject({
        message: "Request timed out. Please try again.",
        isTimeout: true,
      });
    });

    it("throws network error on fetch TypeError", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      await expect(processIntent(request)).rejects.toMatchObject({
        message: "Network error. Please check your connection and try again.",
        isNetworkError: true,
      });
    });
  });

  describe("remember", () => {
    it("sends POST request to /api/remember", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await remember("0xabc123", {
        type: "transaction",
        content: "Swapped 100 USDC to SUI via Cetus",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/remember",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: "0xabc123",
            content: {
              type: "transaction",
              content: "Swapped 100 USDC to SUI via Cetus",
            },
          }),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it("throws on non-200 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { message: "Bad request" } }),
      });

      await expect(
        remember("0xabc123", { type: "preference", content: "I prefer Cetus" })
      ).rejects.toMatchObject({
        message: "Bad request",
        status: 400,
      });
    });
  });

  describe("healthCheck", () => {
    it("sends GET request to /api/health and returns status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: "ok" }),
      });

      const result = await healthCheck();

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/health",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
      expect(result).toEqual({ status: "ok" });
    });

    it("throws on non-200 response with fallback message", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error("not json")),
      });

      await expect(healthCheck()).rejects.toMatchObject({
        message: "Request failed with status 503",
        status: 503,
      });
    });
  });
});
