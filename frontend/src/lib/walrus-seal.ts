// Walrus + Seal services for Marina Copilot
// Uses Walrus Publisher HTTP API (simpler than SDK writeBlobFlow)
// Uses @mysten/seal for encryption

import { SealClient } from "@mysten/seal";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { bcs } from "@mysten/sui/bcs";
import { toHex } from "@mysten/sui/utils";

// === Config ===

// Seal timelock package (testnet — same keys used by marina-assistant)
const SEAL_PACKAGE_ID = "0x23e7b5e2e47e3e5940ca2cba14a9a30dc9f7b6d1f5b18ed41be1e9059ece3b4e";

const SEAL_KEY_SERVERS = [
  { objectId: "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", weight: 1 },
  { objectId: "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8", weight: 1 },
];

// Walrus testnet endpoints (public, no auth needed for upload ≤10MB)
const WALRUS_PUBLISHER = "https://publisher.walrus-testnet.walrus.space";
const WALRUS_AGGREGATOR = "https://aggregator.walrus-testnet.walrus.space";

// === Clients ===

let sealClient: SealClient | null = null;

function getSealClient(): SealClient {
  if (!sealClient) {
    const suiClient = new SuiGrpcClient({ network: "testnet" } as any);
    sealClient = new SealClient({
      suiClient: suiClient as any,
      serverConfigs: SEAL_KEY_SERVERS,
      verifyKeyServers: false,
    });
  }
  return sealClient;
}

// === Seal Encrypt (Time-Lock) ===

export async function sealEncrypt(
  plaintext: string,
  unlockTimeMs: number
): Promise<{ encryptedData: Uint8Array; nonce: Uint8Array; idHex: string }> {
  const client = getSealClient();

  // Build Seal identity: bcs(unlock_time) + random_nonce
  const timeBytes = bcs.u64().serialize(BigInt(unlockTimeMs)).toBytes();
  const nonce = new Uint8Array(32);
  crypto.getRandomValues(nonce);
  const idBytes = new Uint8Array(timeBytes.length + nonce.length);
  idBytes.set(timeBytes, 0);
  idBytes.set(nonce, timeBytes.length);
  const idHex = toHex(idBytes);

  const data = new TextEncoder().encode(plaintext);

  const result = await client.encrypt({
    threshold: 2,
    packageId: SEAL_PACKAGE_ID,
    id: idHex,
    data,
  });

  return { encryptedData: result.encryptedObject, nonce, idHex };
}

// === Walrus Upload (Publisher HTTP API) ===

export async function walrusUpload(data: Uint8Array): Promise<string> {
  const response = await fetch(`${WALRUS_PUBLISHER}/v1/blobs`, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: Buffer.from(data) as any,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Walrus upload failed (${response.status}): ${text.slice(0, 100)}`);
  }

  const result = await response.json();
  const blobId =
    result.newlyCreated?.blobObject?.blobId ||
    result.alreadyCertified?.blobId ||
    result.blobId;

  if (!blobId) throw new Error("No blobId returned from Walrus");
  return blobId;
}

// === Walrus Download ===

export async function walrusDownload(blobId: string): Promise<Uint8Array> {
  const response = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`);
  if (!response.ok) throw new Error(`Walrus download failed: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

// === High-Level: Create Capsule ===

export interface CapsuleData {
  id: string;
  blobId: string;
  nonce: string;
  idHex: string;
  unlockTimeMs: number;
  createdAt: number;
  recipient: string;
  contentPreview: string;
}

export async function createCapsule(params: {
  content: string;
  unlockAfterMinutes: number;
  recipient?: string;
}): Promise<CapsuleData> {
  const unlockTimeMs = Date.now() + params.unlockAfterMinutes * 60 * 1000;

  // 1. Seal encrypt
  const { encryptedData, nonce, idHex } = await sealEncrypt(params.content, unlockTimeMs);

  // 2. Upload encrypted blob to Walrus
  const blobId = await walrusUpload(encryptedData);

  return {
    id: `capsule_${Date.now()}`,
    blobId,
    nonce: toHex(nonce),
    idHex,
    unlockTimeMs,
    createdAt: Date.now(),
    recipient: params.recipient || "self",
    contentPreview: params.content.slice(0, 50) + (params.content.length > 50 ? "..." : ""),
  };
}

// === High-Level: Upload File ===

export async function uploadFileToWalrus(file: File): Promise<{ blobId: string; name: string; size: number }> {
  const data = new Uint8Array(await file.arrayBuffer());
  const blobId = await walrusUpload(data);
  return { blobId, name: file.name, size: file.size };
}
