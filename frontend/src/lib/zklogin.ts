// zkLogin integration — Google OAuth → Sui address via Enoki

import { generateNonce, generateRandomness, jwtToAddress } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { secureSet, secureGet } from "./secure-storage";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
const REDIRECT_URI = process.env.NEXT_PUBLIC_REDIRECT_URI || (typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : "");

export interface ZkLoginState {
  ephemeralKeyPair: Ed25519Keypair;
  randomness: string;
  nonce: string;
  maxEpoch: number;
}

export async function initZkLogin(currentEpoch: number): Promise<ZkLoginState> {
  const ephemeralKeyPair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const maxEpoch = currentEpoch + 10;
  const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), maxEpoch, randomness);

  await secureSet("zklogin_ephemeral_key", ephemeralKeyPair.getSecretKey());
  await secureSet("zklogin_randomness", randomness);
  await secureSet("zklogin_max_epoch", maxEpoch.toString());

  return { ephemeralKeyPair, randomness, nonce, maxEpoch };
}

export function getGoogleAuthUrl(nonce: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    response_type: "id_token",
    redirect_uri: REDIRECT_URI,
    scope: "openid email profile",
    nonce,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function getZkLoginAddress(jwt: string, userSalt: string): Promise<string> {
  return jwtToAddress(jwt, userSalt);
}

export async function getStoredZkLoginState(): Promise<ZkLoginState | null> {
  const secretKey = await secureGet("zklogin_ephemeral_key");
  const randomness = await secureGet("zklogin_randomness");
  const maxEpoch = await secureGet("zklogin_max_epoch");
  if (!secretKey || !randomness || !maxEpoch) return null;

  const ephemeralKeyPair = Ed25519Keypair.fromSecretKey(secretKey);
  const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), parseInt(maxEpoch), randomness);
  return { ephemeralKeyPair, randomness, nonce, maxEpoch: parseInt(maxEpoch) };
}

export async function generateUserSalt(sub: string): Promise<string> {
  const data = new TextEncoder().encode(sub);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash).slice(0, 16)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return BigInt("0x" + hex).toString();
}
