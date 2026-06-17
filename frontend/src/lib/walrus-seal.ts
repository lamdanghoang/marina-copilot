// Walrus + Seal services for Marina Copilot
// Uses @mysten/walrus SDK writeBlobFlow (user signs register + certify)
// Uses @mysten/seal for threshold encryption

import { SealClient, SessionKey } from "@mysten/seal";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { toHex } from "@mysten/sui/utils";
import { walrus } from "@mysten/walrus";

import { networkConfig } from "@/lib/config";

// === Config ===

const NETWORK = networkConfig.network;
const BASE_URL = networkConfig.rpcUrl;

// Seal timelock package — deploy your own or use existing
// For hackathon demo, using testnet package (Seal key servers are testnet only currently)
const SEAL_PACKAGE_ID = "0x23e7b5e2e47e3e5940ca2cba14a9a30dc9f7b6d1f5b18ed41be1e9059ece3b4e";

const SEAL_KEY_SERVERS = [
  { objectId: "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", weight: 1 },
  { objectId: "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8", weight: 1 },
];

// === Types ===

export type SignAndExecute = (args: { transaction: Transaction }) => Promise<any>;
export type SignPersonalMessage = (args: { message: Uint8Array }) => Promise<{ signature: string }>;

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

export interface UploadedFile {
  blobId: string;
  name: string;
  size: number;
  uploadDate: number;
}

// === Clients ===

function createSuiClient() {
  return new SuiGrpcClient({ network: NETWORK, baseUrl: BASE_URL } as any);
}

function createSealClient() {
  return new SealClient({
    suiClient: createSuiClient() as any,
    serverConfigs: SEAL_KEY_SERVERS,
    verifyKeyServers: false,
  });
}

function createWalrusClient() {
  const client = createSuiClient();
  return (client as any).$extend(walrus());
}

// === #1: Walrus Upload via writeBlobFlow (user signs) ===

export async function walrusUpload(
  data: Uint8Array,
  sender: string,
  signAndExecute: SignAndExecute,
  onProgress?: (step: string) => void,
): Promise<string> {
  const client = createWalrusClient();

  onProgress?.("Encoding blob...");
  const flow = client.walrus.writeBlobFlow({ blob: data });
  const encoded = await flow.encode();

  // Register blob (user signs)
  onProgress?.("Registering on Walrus (sign tx)...");
  const registerTx = flow.register({ deletable: false, epochs: 5, owner: sender });
  registerTx.setSender(sender);
  const registerResult = await signAndExecute({ transaction: registerTx });
  const registerDigest = (registerResult as any)?.Transaction?.digest ?? (registerResult as any)?.digest ?? "";

  // Upload to storage nodes
  onProgress?.("Uploading to storage nodes...");
  await flow.upload({ digest: registerDigest });

  // Certify blob (user signs)
  onProgress?.("Certifying blob (sign tx)...");
  const certifyTx = flow.certify();
  certifyTx.setSender(sender);
  await signAndExecute({ transaction: certifyTx });

  return encoded.blobId;
}

// === #2: Seal Encrypt (Time-Lock) ===

export async function sealEncrypt(
  plaintext: string,
  unlockTimeMs: number,
): Promise<{ encryptedData: Uint8Array; nonce: Uint8Array; idHex: string }> {
  const client = createSealClient();

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

// === #3: Seal Decrypt (after time-lock expires) ===

export async function sealDecrypt(
  encryptedData: Uint8Array,
  idHex: string,
  userAddress: string,
  signPersonalMessage: SignPersonalMessage,
): Promise<string> {
  const client = createSealClient();
  const suiClient = createSuiClient();

  // Create session key
  const sessionKey = await SessionKey.create({
    address: userAddress,
    packageId: SEAL_PACKAGE_ID,
    ttlMin: 10,
    suiClient: suiClient as any,
  });

  // Sign personal message for session
  const message = sessionKey.getPersonalMessage();
  const { signature } = await signPersonalMessage({ message });
  sessionKey.setPersonalMessageSignature(signature);

  // Build seal_approve tx (time-lock check)
  const idBytes: number[] = [];
  for (let i = 0; i < idHex.length; i += 2) {
    idBytes.push(parseInt(idHex.substring(i, i + 2), 16));
  }

  const tx = new Transaction();
  tx.moveCall({
    target: `${SEAL_PACKAGE_ID}::seal_timelock::seal_approve`,
    arguments: [
      tx.pure.vector("u8", idBytes),
      tx.object("0x6"), // Clock
    ],
  });
  tx.setSender(userAddress);

  const txBytes = await tx.build({ client: suiClient as any, onlyTransactionKind: true });

  const decrypted = await client.decrypt({
    data: encryptedData,
    sessionKey,
    txBytes,
  });

  return new TextDecoder().decode(decrypted);
}

// === #4: Walrus Download ===

export async function walrusDownload(blobId: string): Promise<Uint8Array> {
  const client = createWalrusClient();
  const [file] = await client.walrus.getFiles({ ids: [blobId] });
  return file.bytes();
}

// === High-Level: Create Capsule ===

export async function createCapsule(params: {
  content: string;
  unlockAfterMinutes: number;
  recipient?: string;
  sender: string;
  signAndExecute: SignAndExecute;
  onProgress?: (step: string) => void;
}): Promise<CapsuleData> {
  const unlockTimeMs = Date.now() + params.unlockAfterMinutes * 60 * 1000;

  // 1. Seal encrypt
  params.onProgress?.("Encrypting with Seal...");
  const { encryptedData, nonce, idHex } = await sealEncrypt(params.content, unlockTimeMs);

  // 2. Upload encrypted blob to Walrus (user signs 2 txs)
  const blobId = await walrusUpload(
    encryptedData,
    params.sender,
    params.signAndExecute,
    params.onProgress,
  );

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

export async function uploadFileToWalrus(params: {
  file: File;
  sender: string;
  signAndExecute: SignAndExecute;
  onProgress?: (step: string) => void;
}): Promise<UploadedFile> {
  const data = new Uint8Array(await params.file.arrayBuffer());
  const blobId = await walrusUpload(data, params.sender, params.signAndExecute, params.onProgress);
  return { blobId, name: params.file.name, size: params.file.size, uploadDate: Date.now() };
}

// === High-Level: Unlock Capsule ===

export async function unlockCapsule(params: {
  blobId: string;
  idHex: string;
  unlockTimeMs: number;
  userAddress: string;
  signPersonalMessage: SignPersonalMessage;
}): Promise<string> {
  if (Date.now() < params.unlockTimeMs) {
    throw new Error("Capsule not yet unlockable");
  }

  // Download from Walrus
  const encryptedData = await walrusDownload(params.blobId);

  // Decrypt with Seal
  return sealDecrypt(encryptedData, params.idHex, params.userAddress, params.signPersonalMessage);
}
