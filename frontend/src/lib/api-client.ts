import { config } from "@/lib/config";
import {
  ProcessIntentRequest,
  ProcessIntentResponse,
  MemoryContent,
} from "@/types";

const REQUEST_TIMEOUT_MS = 30_000;

interface ApiError {
  message: string;
  status?: number;
  isTimeout?: boolean;
  isNetworkError?: boolean;
}

function createTimeoutController(): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return { controller, timeoutId };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body.error?.message) {
        errorMessage = body.error.message;
      } else if (body.message) {
        errorMessage = body.message;
      }
    } catch {
      // Could not parse error body — use default message
    }
    const error: ApiError = {
      message: errorMessage,
      status: response.status,
    };
    throw error;
  }
  return response.json() as Promise<T>;
}

function handleFetchError(error: unknown): never {
  if (error && typeof error === "object" && "message" in error && "status" in error) {
    // Already an ApiError from handleResponse
    throw error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    const apiError: ApiError = {
      message: "Request timed out. Please try again.",
      isTimeout: true,
    };
    throw apiError;
  }

  if (error instanceof TypeError) {
    // fetch throws TypeError for network failures
    const apiError: ApiError = {
      message: "Network error. Please check your connection and try again.",
      isNetworkError: true,
    };
    throw apiError;
  }

  const apiError: ApiError = {
    message: "An unexpected error occurred. Please try again.",
  };
  throw apiError;
}

export async function processIntent(
  request: ProcessIntentRequest
): Promise<ProcessIntentResponse> {
  const { controller, timeoutId } = createTimeoutController();

  // Attach local memories to request
  const memories = getLocalMemories(request.walletAddress);
  const requestWithMemories = { ...request, memories };

  try {
    const response = await fetch(`${config.apiUrl}/api/process-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestWithMemories),
      signal: controller.signal,
    });

    return await handleResponse<ProcessIntentResponse>(response);
  } catch (error) {
    return handleFetchError(error);
  } finally {
    clearTimeout(timeoutId);
  }
}

const MEMORIES_KEY = "marina-copilot-memories";

function getLocalMemories(walletAddress: string | null): string[] {
  if (!walletAddress) return [];
  try {
    return JSON.parse(localStorage.getItem(`${MEMORIES_KEY}-${walletAddress}`) || "[]");
  } catch { return []; }
}

function saveLocalMemory(walletAddress: string, content: string) {
  const existing = getLocalMemories(walletAddress);
  existing.push(content);
  // Keep last 50 memories
  const trimmed = existing.slice(-50);
  localStorage.setItem(`${MEMORIES_KEY}-${walletAddress}`, JSON.stringify(trimmed));
}

export async function remember(
  walletAddress: string,
  content: MemoryContent,
  memwalCredentials?: { accountId: string; delegateKey: string }
): Promise<void> {
  // Always save locally
  saveLocalMemory(walletAddress, content.content);

  // Also send to backend (MemWal if credentials exist)
  const { controller, timeoutId } = createTimeoutController();
  try {
    await fetch(`${config.apiUrl}/api/remember`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress, content, memwalCredentials }),
      signal: controller.signal,
    });
  } catch {
    // Silent — local already saved
  } finally {
    clearTimeout(timeoutId);
  }
}

export function getMemories(walletAddress: string | null): string[] {
  return getLocalMemories(walletAddress);
}

export async function healthCheck(): Promise<{ status: string }> {
  const { controller, timeoutId } = createTimeoutController();

  try {
    const response = await fetch(`${config.apiUrl}/api/health`, {
      signal: controller.signal,
    });

    return await handleResponse<{ status: string }>(response);
  } catch (error) {
    return handleFetchError(error);
  } finally {
    clearTimeout(timeoutId);
  }
}
