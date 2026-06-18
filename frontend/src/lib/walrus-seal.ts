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

// Seal timelock package
const SEAL_PACKAGE_ID = networkConfig.sealPackageId;

const SEAL_KEY_SERVERS = [
  { objectId: "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75", weight: 1 },
  { objectId: "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8", weight: 1 },
  { objectId: "0x6a0726a1ea3d62ba2f2ae51104f2c3633c003fb75621d06fde47f04dc930ba06", weight: 1 },
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
  blobObjectId?: string;
  name: string;
  size: number;
  uploadDate: number;
  epochs: number;
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

// WAL token for storage payment
const WAL_COIN_TYPE = networkConfig.walCoinType;
const WAL_EXCHANGE_PACKAGE = networkConfig.walExchangePackage;
const EXCHANGE_ID = networkConfig.walExchangeId;

async function getWalBalance(sender: string): Promise<bigint> {
  const client = createSuiClient();
  const resp = await (client as any).getBalance({ owner: sender, coinType: WAL_COIN_TYPE });
  const b = resp?.balance;
  const val = typeof b === "object" ? (b.coinBalance ?? b.balance ?? "0") : (b ?? "0");
  return BigInt(val);
}

function buildSwapTx(sender: string, amount: bigint): Transaction {
  const tx = new Transaction();
  tx.setSender(sender);
  const [suiCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
  const walCoin = tx.moveCall({
    target: `${WAL_EXCHANGE_PACKAGE}::wal_exchange::exchange_all_for_wal`,
    arguments: [tx.object(EXCHANGE_ID), suiCoin],
  });
  tx.transferObjects([walCoin], sender);
  return tx;
}

export async function walrusUpload(
  data: Uint8Array,
  sender: string,
  signAndExecute: SignAndExecute,
  onProgress?: (step: string) => void,
): Promise<{ blobId: string; blobObjectId?: string }> {
  const client = createWalrusClient();

  onProgress?.("Encoding blob...");
  const flow = client.walrus.writeBlobFlow({ blob: data });
  const encoded = await flow.encode();

  // Check WAL balance vs storage cost
  onProgress?.("Checking WAL balance...");
  const cost = await client.walrus.storageCost(data.length, 5);
  const walBalance = await getWalBalance(sender);

  // Auto-swap SUI→WAL if insufficient
  if (walBalance < cost.totalCost) {
    const shortage = cost.totalCost - walBalance;
    onProgress?.(`Swapping ${(Number(shortage) / 1e9).toFixed(4)} SUI → WAL...`);
    const swapTx = buildSwapTx(sender, shortage);
    await signAndExecute({ transaction: swapTx });
    // Wait for swap to finalize
    await new Promise((r) => setTimeout(r, 2000));
  }

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
  const certifyResult = await signAndExecute({ transaction: certifyTx });

  // Try to extract blob object ID from register result (created objects)
  const blobObjectId = (registerResult as any)?.effects?.created?.[0]?.reference?.objectId
    ?? (registerResult as any)?.Transaction?.effects?.created?.[0]?.objectId
    ?? undefined;

  return { blobId: encoded.blobId, blobObjectId };
}

// === #2: Seal Encrypt (Time-Lock) ===

export async function sealEncrypt(
  plaintext: string,
  unlockTimeMs: number,
  recipient: string,
): Promise<{ encryptedData: Uint8Array; nonce: Uint8Array; idHex: string }> {
  const client = createSealClient();

  // id = bcs(unlock_time) + bcs(recipient_address) — matches seal_policy::seal_approve
  const timeBytes = bcs.u64().serialize(BigInt(unlockTimeMs)).toBytes();
  const addrBytes = bcs.Address.serialize(recipient).toBytes();
  const idBytes = new Uint8Array(timeBytes.length + addrBytes.length);
  idBytes.set(timeBytes, 0);
  idBytes.set(addrBytes, timeBytes.length);
  const idHex = toHex(idBytes);

  const nonce = new Uint8Array(32);
  crypto.getRandomValues(nonce);

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
): Promise<string> {
  const { Ed25519Keypair } = await import("@mysten/sui/keypairs/ed25519");
  const client = createSealClient();
  const suiClient = createSuiClient();

  // Create ephemeral keypair for session (self-signed, no wallet needed)
  const sessionKp = new Ed25519Keypair();

  const sessionKey = await SessionKey.create({
    address: sessionKp.getPublicKey().toSuiAddress(),
    packageId: SEAL_PACKAGE_ID,
    ttlMin: 10,
    signer: sessionKp,
    suiClient: suiClient as any,
  });

  // Build seal_approve tx
  const idBytes: number[] = [];
  for (let i = 0; i < idHex.length; i += 2) {
    idBytes.push(parseInt(idHex.substring(i, i + 2), 16));
  }

  const tx = new Transaction();
  tx.moveCall({
    target: `${SEAL_PACKAGE_ID}::seal_policy::seal_approve`,
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
  const { encryptedData, nonce, idHex } = await sealEncrypt(params.content, unlockTimeMs, params.recipient || params.sender);

  // 2. Upload encrypted blob to Walrus (user signs 2 txs)
  const { blobId } = await walrusUpload(
    encryptedData,
    params.sender,
    params.signAndExecute,
    params.onProgress,
  );

  // 3. Create capsule on-chain (metadata) — wait for previous tx to finalize
  params.onProgress?.("Creating capsule on-chain...");
  await new Promise((r) => setTimeout(r, 2000));
  const { Transaction } = await import("@mysten/sui/transactions");
  const tx = new Transaction();
  const recipient = params.recipient || params.sender;
  tx.moveCall({
    target: `${SEAL_PACKAGE_ID}::capsule::create_capsule`,
    arguments: [
      tx.pure.string(blobId),
      tx.pure.vector("u8", Array.from(nonce)),
      tx.pure.u64(BigInt(unlockTimeMs)),
      tx.pure.address(recipient),
      tx.object("0x6"), // Clock
    ],
  });
  await params.signAndExecute({ transaction: tx });

  return {
    id: `capsule_${Date.now()}`,
    blobId,
    nonce: toHex(nonce),
    idHex,
    unlockTimeMs,
    createdAt: Date.now(),
    recipient,
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
  const { blobId, blobObjectId } = await walrusUpload(data, params.sender, params.signAndExecute, params.onProgress);
  return { blobId, blobObjectId, name: params.file.name, size: params.file.size, uploadDate: Date.now(), epochs: 3 };
}

// === High-Level: Extend Blob Storage ===

const WALRUS_SYSTEM_OBJECT = "0x6c2547cbbc38025cf3adac45f63cb0a8d12ecf777cdc75a4971612bf97fdf6af";

export async function extendBlobStorage(params: {
  blobObjectId: string;
  extendEpochs: number;
  sender: string;
  signAndExecute: SignAndExecute;
}): Promise<void> {
  const { Transaction } = await import("@mysten/sui/transactions");
  const tx = new Transaction();

  // Need WAL payment — split from gas (auto-swap handled by caller if needed)
  const [walCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(BigInt(100_000_000))]); // 0.1 WAL estimate
  const walPayment = tx.moveCall({
    target: `${networkConfig.walExchangePackage}::wal_exchange::exchange_all_for_wal`,
    arguments: [tx.object(networkConfig.walExchangeId), walCoin],
  });

  tx.moveCall({
    target: `0x7e12d67a52106ddd5f26c6ff4fe740ba5dea7cfc138d5b1d33863ba9098aa6fe::system::extend_blob`,
    arguments: [
      tx.object(WALRUS_SYSTEM_OBJECT),
      tx.object(params.blobObjectId),
      tx.pure.u32(params.extendEpochs),
      walPayment,
    ],
  });

  await params.signAndExecute({ transaction: tx });
}

// === High-Level: Unlock Capsule ===

export async function unlockCapsule(params: {
  blobId: string;
  unlockTimeMs: number;
  recipient: string;
  userAddress: string;
}): Promise<string> {
  if (Date.now() < params.unlockTimeMs) {
    throw new Error("Capsule not yet unlockable");
  }

  // Reconstruct id: bcs(unlock_time) + bcs(recipient) — must match what was used during encrypt
  const timeBytes = bcs.u64().serialize(BigInt(params.unlockTimeMs)).toBytes();
  const addrBytes = bcs.Address.serialize(params.recipient).toBytes();
  const idBytes = new Uint8Array(timeBytes.length + addrBytes.length);
  idBytes.set(timeBytes, 0);
  idBytes.set(addrBytes, timeBytes.length);
  const idHex = toHex(idBytes);

  // Download from Walrus
  const encryptedData = await walrusDownload(params.blobId);

  // Decrypt with Seal
  return sealDecrypt(encryptedData, idHex, params.userAddress);
}
