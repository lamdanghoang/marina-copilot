"use client";

import { useState } from "react";

interface StoredFile {
  id: string;
  name: string;
  size: string;
  blobId: string;
  uploadDate: string;
}

const DEMO_FILES: StoredFile[] = [
  { id: "1", name: "portfolio-strategy.md", size: "2.4 KB", blobId: "walrus://abc123...", uploadDate: "Jun 14, 2026" },
  { id: "2", name: "trade-notes.txt", size: "1.1 KB", blobId: "walrus://def456...", uploadDate: "Jun 12, 2026" },
];

export default function FilesPage() {
  const [files] = useState<StoredFile[]>(DEMO_FILES);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-headline text-3xl font-bold text-foreground">Walrus Storage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Decentralized file storage on Walrus. Your files are erasure-coded across storage nodes.
          </p>
        </div>

        {/* Upload button */}
        <button className="w-full glass-panel rounded-xl p-4 border-dashed border-[rgba(0,245,255,0.3)] hover:border-[#63f7ff] transition-colors flex items-center justify-center gap-2 text-sm text-[#63f7ff] font-bold">
          + Upload File to Walrus
        </button>

        {/* File list */}
        <div className="space-y-3">
          {files.map((file) => (
            <div key={file.id} className="glass-panel rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#63f7ff]/10 flex items-center justify-center text-[#63f7ff] text-lg">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{file.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{file.blobId}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-mono">{file.size}</p>
                <p className="text-[10px] text-muted-foreground">{file.uploadDate}</p>
              </div>
            </div>
          ))}

          {files.length === 0 && (
            <div className="glass-panel rounded-xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No files stored yet</p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="glass-panel rounded-xl p-4 flex gap-3">
          <span>🐘</span>
          <div>
            <p className="text-xs font-bold">Powered by Walrus</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Files are erasure-coded across decentralized storage nodes. Epoch-based expiry ensures availability.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
