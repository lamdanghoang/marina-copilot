"use client";

import { useCallback, useRef } from "react";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
import { useCopilotStore, saveMessages } from "@/store/copilot-store";
import { remember } from "@/lib/api-client";
import { networkConfig } from "@/lib/config";
import type { CapsuleData, UploadedFile } from "@/lib/walrus-seal";
import type { ChatMessage } from "@/types";

const CAPSULES_KEY = "marina-copilot-capsules";
const FILES_KEY = "marina-copilot-files";

function saveCapsules(capsules: CapsuleData[]) {
  localStorage.setItem(CAPSULES_KEY, JSON.stringify(capsules));
}

export function loadCapsules(): CapsuleData[] {
  try { return JSON.parse(localStorage.getItem(CAPSULES_KEY) || "[]"); } catch { return []; }
}

function saveFiles(files: UploadedFile[]) {
  localStorage.setItem(FILES_KEY, JSON.stringify(files));
}

export function loadFiles(): UploadedFile[] {
  try { return JSON.parse(localStorage.getItem(FILES_KEY) || "[]"); } catch { return []; }
}

export function useActionExecution() {
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const executeAction = useCallback(async (action: string, params: Record<string, unknown>) => {
    const sender = account?.address || useCopilotStore.getState().walletAddress;
    if (!sender) {
      addMessage("❌ Connect wallet first", "error");
      return;
    }

    let signAndExecute: (args: { transaction: any }) => Promise<any>;
    if (account) {
      signAndExecute = async (args) => (dAppKit as any).signAndExecuteTransaction({ transaction: args.transaction });
    } else {
      const { signAndExecuteZkLogin } = await import("@/lib/zklogin-signer");
      signAndExecute = signAndExecuteZkLogin;
    }

    if (action === "create_capsule") {
      await executeCapsuleAction(params, sender, signAndExecute);
    } else if (action === "upload_file") {
      const file = params.file as File | undefined;
      if (file) {
        await executeFileUpload(file, sender, signAndExecute);
      } else {
        triggerFileUpload(fileInputRef, sender, signAndExecute);
      }
    }
  }, [account, dAppKit]);

  return { executeAction, fileInputRef };
}

function addMessage(content: string, type: "text" | "success" | "error", metadata?: Record<string, unknown>) {
  const msg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content, type, timestamp: Date.now(), metadata };
  useCopilotStore.setState((state) => {
    const msgs = [...state.messages, msg];
    saveMessages(msgs, state.walletAddress);
    return { messages: msgs };
  });
}

function rememberAction(walletAddress: string, content: string, metadata: Record<string, unknown>) {
  const { memwalCredentials } = useCopilotStore.getState();
  remember(walletAddress, { type: "transaction", content, metadata }, memwalCredentials ?? undefined).catch(() => {
    console.warn("Failed to store action memory");
  });
}

async function executeCapsuleAction(
  params: Record<string, unknown>,
  sender: string,
  signAndExecute: (args: { transaction: any }) => Promise<any>,
) {
  useCopilotStore.setState({ isProcessing: true, statusText: "Encrypting..." });

  try {
    const { createCapsule } = await import("@/lib/walrus-seal");
    const capsule = await createCapsule({
      content: params.content as string,
      unlockAfterMinutes: params.unlockAfterMinutes as number,
      recipient: (params.recipient as string) || "self",
      sender,
      signAndExecute,
      onProgress: (step) => useCopilotStore.setState({ statusText: step }),
    });

    // Save locally
    const existing = loadCapsules();
    existing.push(capsule);
    saveCapsules(existing);

    const unlockDate = new Date(capsule.unlockTimeMs).toLocaleString();
    const explorerUrl = capsule.digest ? `https://suiscan.xyz/${networkConfig.network}/tx/${capsule.digest}` : "";
    addMessage(
      `✅ Time Capsule created!\n\n🔒 Encrypted with Seal\n🐘 Stored on Walrus: ${capsule.blobId.slice(0, 16)}...\n⏰ Unlocks: ${unlockDate}\n📬 Recipient: ${capsule.recipient}`,
      "success",
      { txDigest: capsule.digest, explorerUrl },
    );

    // Remember action
    rememberAction(sender, `Created time capsule (unlocks ${unlockDate}), stored on Walrus: ${capsule.blobId.slice(0, 16)}`, {
      action: "create_capsule", blobId: capsule.blobId, unlockTimeMs: capsule.unlockTimeMs, recipient: capsule.recipient,
    });
  } catch (error) {
    addMessage(`❌ Capsule creation failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
  } finally {
    useCopilotStore.setState({ isProcessing: false, statusText: "" });
  }
}


async function executeFileUpload(file: File, sender: string, signAndExecute: (args: { transaction: any }) => Promise<any>) {
  useCopilotStore.setState({ isProcessing: true, statusText: "Uploading..." });
  try {
    const { uploadFileToWalrus } = await import("@/lib/walrus-seal");
    const result = await uploadFileToWalrus({ file, sender, signAndExecute, onProgress: (step) => useCopilotStore.setState({ statusText: step }) });
    const existing = loadFiles();
    existing.push(result);
    saveFiles(existing);
    const sizeStr = result.size > 1024 ? `${(result.size / 1024).toFixed(1)} KB` : `${result.size} B`;
    addMessage(`✅ File uploaded to Walrus!\n\n📄 ${result.name} (${sizeStr})\n🐘 Blob ID: ${result.blobId.slice(0, 20)}...`, "success");
    rememberAction(sender, `Uploaded file "${result.name}" (${sizeStr}) to Walrus: ${result.blobId.slice(0, 16)}`, { action: "upload_file", blobId: result.blobId, fileName: result.name, size: result.size });
  } catch (error) {
    addMessage(`❌ Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
  } finally {
    useCopilotStore.setState({ isProcessing: false, statusText: "" });
  }
}

function triggerFileUpload(
  ref: React.MutableRefObject<HTMLInputElement | null>,
  sender: string,
  signAndExecute: (args: { transaction: any }) => Promise<any>,
) {
  if (!ref.current) {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    document.body.appendChild(input);
    ref.current = input;
  }

  ref.current.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    useCopilotStore.setState({ isProcessing: true, statusText: "Uploading..." });

    try {
      const { uploadFileToWalrus } = await import("@/lib/walrus-seal");
      const result = await uploadFileToWalrus({
        file,
        sender,
        signAndExecute,
        onProgress: (step) => useCopilotStore.setState({ statusText: step }),
      });

      const existing = loadFiles();
      existing.push(result);
      saveFiles(existing);

      const sizeStr = result.size > 1024 ? `${(result.size / 1024).toFixed(1)} KB` : `${result.size} B`;
      addMessage(`✅ File uploaded to Walrus!\n\n📄 ${result.name} (${sizeStr})\n🐘 Blob ID: ${result.blobId.slice(0, 20)}...`, "success");

      // Remember action
      rememberAction(sender, `Uploaded file "${result.name}" (${sizeStr}) to Walrus: ${result.blobId.slice(0, 16)}`, {
        action: "upload_file", blobId: result.blobId, fileName: result.name, size: result.size,
      });
    } catch (error) {
      addMessage(`❌ Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    } finally {
      useCopilotStore.setState({ isProcessing: false, statusText: "" });
    }
  };

  ref.current.value = "";
  ref.current.click();
}
