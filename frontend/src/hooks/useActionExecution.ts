"use client";

import { useCallback, useRef } from "react";
import { useCopilotStore, saveMessages } from "@/store/copilot-store";
import { createCapsule, uploadFileToWalrus, CapsuleData } from "@/lib/walrus-seal";
import type { ChatMessage } from "@/types";

const CAPSULES_KEY = "marina-copilot-capsules";
const FILES_KEY = "marina-copilot-files";

// Persist capsules/files to localStorage
function saveCapsules(capsules: CapsuleData[]) {
  localStorage.setItem(CAPSULES_KEY, JSON.stringify(capsules));
}

export function loadCapsules(): CapsuleData[] {
  try {
    const raw = localStorage.getItem(CAPSULES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveFiles(files: Array<{ blobId: string; name: string; size: number; uploadDate: number }>) {
  localStorage.setItem(FILES_KEY, JSON.stringify(files));
}

export function loadFiles(): Array<{ blobId: string; name: string; size: number; uploadDate: number }> {
  try {
    const raw = localStorage.getItem(FILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/**
 * Hook that executes Walrus/Seal actions triggered by AI.
 */
export function useActionExecution() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const executeAction = useCallback(async (action: string, params: Record<string, unknown>) => {
    if (action === "create_capsule") {
      await executeCapsuleAction(params);
    } else if (action === "upload_file") {
      triggerFileUpload(fileInputRef);
    }
  }, []);

  return { executeAction, fileInputRef };
}

async function executeCapsuleAction(params: Record<string, unknown>) {
  const content = params.content as string;
  const unlockAfterMinutes = params.unlockAfterMinutes as number;
  const recipient = (params.recipient as string) || "self";

  // Show processing message
  const processingMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "🔒 Encrypting with Seal and uploading to Walrus...",
    type: "text",
    timestamp: Date.now(),
  };

  useCopilotStore.setState((state) => ({
    messages: [...state.messages, processingMsg],
    isProcessing: true,
    statusText: "Encrypting...",
  }));

  try {
    const capsule = await createCapsule({ content, unlockAfterMinutes, recipient });

    // Save to localStorage
    const existing = loadCapsules();
    existing.push(capsule);
    saveCapsules(existing);

    const unlockDate = new Date(capsule.unlockTimeMs).toLocaleString();
    const successMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `✅ Time Capsule created!\n\n🔒 Encrypted with Seal threshold encryption\n🐘 Stored on Walrus: ${capsule.blobId.slice(0, 16)}...\n⏰ Unlocks: ${unlockDate}\n📬 Recipient: ${recipient}`,
      type: "success",
      timestamp: Date.now(),
    };

    useCopilotStore.setState((state) => {
      const msgs = [...state.messages.filter((m) => m.id !== processingMsg.id), successMsg];
      saveMessages(msgs, state.walletAddress);
      return { messages: msgs, isProcessing: false, statusText: "" };
    });
  } catch (error) {
    const errMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `❌ Failed to create capsule: ${error instanceof Error ? error.message : "Unknown error"}`,
      type: "error",
      timestamp: Date.now(),
    };

    useCopilotStore.setState((state) => {
      const msgs = [...state.messages.filter((m) => m.id !== processingMsg.id), errMsg];
      saveMessages(msgs, state.walletAddress);
      return { messages: msgs, isProcessing: false, statusText: "" };
    });
  }
}

function triggerFileUpload(ref: React.MutableRefObject<HTMLInputElement | null>) {
  // Create hidden file input and trigger click
  if (!ref.current) {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      await executeFileUpload(file);
    };
    document.body.appendChild(input);
    ref.current = input;
  }
  ref.current.value = "";
  ref.current.click();
}

async function executeFileUpload(file: File) {
  const processingMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "assistant",
    content: `📤 Uploading ${file.name} to Walrus...`,
    type: "text",
    timestamp: Date.now(),
  };

  useCopilotStore.setState((state) => ({
    messages: [...state.messages, processingMsg],
    isProcessing: true,
    statusText: "Uploading...",
  }));

  try {
    const result = await uploadFileToWalrus(file);

    // Save to localStorage
    const existing = loadFiles();
    existing.push({ ...result, uploadDate: Date.now() });
    saveFiles(existing);

    const sizeStr = result.size > 1024 ? `${(result.size / 1024).toFixed(1)} KB` : `${result.size} B`;
    const successMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `✅ File uploaded to Walrus!\n\n📄 ${result.name} (${sizeStr})\n🐘 Blob ID: ${result.blobId.slice(0, 20)}...`,
      type: "success",
      timestamp: Date.now(),
    };

    useCopilotStore.setState((state) => {
      const msgs = [...state.messages.filter((m) => m.id !== processingMsg.id), successMsg];
      saveMessages(msgs, state.walletAddress);
      return { messages: msgs, isProcessing: false, statusText: "" };
    });
  } catch (error) {
    const errMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `❌ Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      type: "error",
      timestamp: Date.now(),
    };

    useCopilotStore.setState((state) => {
      const msgs = [...state.messages.filter((m) => m.id !== processingMsg.id), errMsg];
      saveMessages(msgs, state.walletAddress);
      return { messages: msgs, isProcessing: false, statusText: "" };
    });
  }
}
