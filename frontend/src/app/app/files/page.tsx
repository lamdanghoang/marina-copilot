"use client";

import { useState, useRef } from "react";
import { useDAppKit, useCurrentAccount } from "@mysten/dapp-kit-react";
import { useCopilotStore } from "@/store/copilot-store";
import { useToast } from "@/components/Toast";
import { loadFiles } from "@/hooks/useActionExecution";
import { HardDrive, Image, FileText, Table, Film, Music, Archive, Code, File } from "lucide-react";
import type { UploadedFile } from "@/lib/walrus-seal";

export default function FilesPage() {
  const [files, setFiles] = useState<UploadedFile[]>(loadFiles);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const walletAddress = useCopilotStore((s) => s.walletAddress);
  const dAppKit = useDAppKit();
  const account = useCurrentAccount();
  const toast = useToast();

  const handleUpload = async (file: File) => {
    const sender = account?.address || walletAddress;
    if (!sender) { toast("Connect wallet first", "error"); return; }

    setUploading(true);
    try {
      const { uploadFileToWalrus } = await import("@/lib/walrus-seal");

      let signAndExecute: (args: { transaction: any }) => Promise<any>;
      if (account) {
        signAndExecute = async (args) => (dAppKit as any).signAndExecuteTransaction({ transaction: args.transaction });
      } else {
        const { signAndExecuteZkLogin } = await import("@/lib/zklogin-signer");
        signAndExecute = signAndExecuteZkLogin;
      }

      const result = await uploadFileToWalrus({
        file,
        sender,
        signAndExecute,
        onProgress: (step) => setStatus(step),
      });

      // Save to localStorage
      const updated = [...files, result];
      setFiles(updated);
      localStorage.setItem("marina-copilot-files", JSON.stringify(updated));

      toast(`${file.name} uploaded to Walrus!`, "success");
    } catch (e: any) {
      toast(e.message || "Upload failed", "error");
    } finally {
      setUploading(false);
      setStatus("");
    }
  };

  const handleExtend = async (file: UploadedFile) => {
    const sender = account?.address || walletAddress;
    if (!sender || !file.blobObjectId) {
      toast("Blob object ID not available for this file", "error");
      return;
    }
    try {
      const { extendBlobStorage } = await import("@/lib/walrus-seal");
      let signAndExecute: (args: { transaction: any }) => Promise<any>;
      if (account) {
        signAndExecute = async (args) => (dAppKit as any).signAndExecuteTransaction({ transaction: args.transaction });
      } else {
        const { signAndExecuteZkLogin } = await import("@/lib/zklogin-signer");
        signAndExecute = signAndExecuteZkLogin;
      }
      await extendBlobStorage({ blobObjectId: file.blobObjectId, extendEpochs: 3, sender, signAndExecute });
      // Update local epochs
      const updated = files.map((f) => f.blobId === file.blobId ? { ...f, epochs: (f.epochs || 3) + 3 } : f);
      setFiles(updated);
      localStorage.setItem("marina-copilot-files", JSON.stringify(updated));
      toast("Blob extended by 3 epochs!", "success");
    } catch (e: any) {
      toast(e.message || "Extend failed", "error");
    }
  };

  const handleDownload = async (file: UploadedFile) => {
    try {
      const { walrusDownload } = await import("@/lib/walrus-seal");
      const data = await walrusDownload(file.blobId);
      const blob = new Blob([data as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
      toast("Download started", "success");
    } catch (e: any) {
      toast(e.message || "Download failed", "error");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="font-headline text-3xl font-bold text-foreground">Walrus Storage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Decentralized file storage on Walrus. Your files are erasure-coded across storage nodes.
          </p>
        </div>

        {/* Upload button */}
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full glass-panel rounded-xl py-3 px-4 border-dashed border-[rgba(0,245,255,0.3)] hover:border-[#63f7ff] transition-colors flex items-center justify-center gap-2 text-sm text-[#63f7ff] font-bold disabled:opacity-50"
        >
          {uploading ? status || "Uploading..." : "+ Upload File to Walrus"}
        </button>

        {/* File list */}
        <div className="space-y-3">
          {files.map((file, i) => (
            <div key={i} className="glass-panel rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#63f7ff]/10 flex items-center justify-center text-[#63f7ff] text-lg">{getFileIcon(file.name)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{file.name}</p>
                <a href={`https://walruscan.com/testnet/blob/${file.blobId}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground font-mono hover:text-[#63f7ff] transition-colors">{file.blobId.slice(0, 24)}... ↗</a>
              </div>
              <div className="text-right flex-shrink-0 space-y-1">
                <p className="text-xs font-mono">{file.size > 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${file.size} B`}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(file.uploadDate).toLocaleDateString()}</p>
                {file.endEpoch && <p className="text-[9px] text-yellow-400/80">Expires: epoch {file.endEpoch}</p>}
                <div className="flex gap-1">
                  <button onClick={() => handleDownload(file)} className="text-[9px] px-2 py-0.5 rounded bg-[#63f7ff]/10 text-[#63f7ff] hover:bg-[#63f7ff]/20">Download</button>
                  <button onClick={(e) => { e.stopPropagation(); handleExtend(file); }} className="text-[9px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20">Extend</button>
                </div>
              </div>
            </div>
          ))}

          {files.length === 0 && !uploading && (
            <div className="glass-panel rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No files stored yet. Upload your first file!</p>
            </div>
          )}
        </div>

        <div className="glass-panel rounded-xl p-4 flex gap-3">
          <HardDrive size={18} className="text-[#63f7ff] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold">Powered by Walrus</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Files are erasure-coded across decentralized storage nodes. Click a file to download.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getFileIcon(name: string): React.ReactNode {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const cls = "text-[#63f7ff]";
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return <Image size={20} className={cls} />;
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) return <FileText size={20} className={cls} />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <Table size={20} className={cls} />;
  if (["mp4", "mov", "avi", "webm"].includes(ext)) return <Film size={20} className={cls} />;
  if (["mp3", "wav", "ogg"].includes(ext)) return <Music size={20} className={cls} />;
  if (["zip", "rar", "tar", "gz"].includes(ext)) return <Archive size={20} className={cls} />;
  if (["json", "js", "ts", "py", "rs"].includes(ext)) return <Code size={20} className={cls} />;
  return <File size={20} className={cls} />;
}
