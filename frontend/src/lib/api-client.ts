import { config } from "@/lib/config";
import {
  ProcessIntentRequest,
  ProcessIntentResponse,
  MemoryContent,
} from "@/types";

export async function processIntent(
  request: ProcessIntentRequest
): Promise<ProcessIntentResponse> {
  const response = await fetch(`${config.apiUrl}/api/process-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export async function remember(
  walletAddress: string,
  content: MemoryContent
): Promise<void> {
  const response = await fetch(`${config.apiUrl}/api/remember`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, content }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${config.apiUrl}/api/health`);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}
