// ============================================================
// Marina Copilot — Remember Route
// POST /api/remember
// Stores memory records after successful transactions
// Graceful degradation: always returns 200 even on failure
// ============================================================

import { Router, Request, Response } from "express";
import { MemoryContent } from "../types";
import { remember } from "../services/memory-service";

const router = Router();

interface RememberRequestBody {
  walletAddress: string;
  content: MemoryContent;
  memwalCredentials?: {
    accountId: string;
    delegateKey: string;
  };
}

router.post("/", async (req: Request, res: Response) => {
  const { walletAddress, content, memwalCredentials } = req.body as RememberRequestBody;

  // Validate required fields
  if (!walletAddress || !content) {
    return res.status(400).json({
      error: { message: "walletAddress and content are required." },
    });
  }

  try {
    await remember(walletAddress, content, memwalCredentials);
    console.log(`[Memory] Store for ${walletAddress}:`, content.type);
  } catch (error) {
    // Silent degradation — log failure but still return 200
    console.error("[Memory] Store failed:", error);
  }

  return res.json({ success: true });
});

export default router;
