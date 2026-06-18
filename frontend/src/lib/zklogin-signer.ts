// zkLogin transaction signing
// Combines ephemeral key signature + zkProof to execute transactions

import { getStoredZkLoginState } from "./zklogin";
import { getZkProofFromEnoki } from "./enoki";
import { networkConfig } from "./config";
import { getZkLoginSignature, genAddressSeed } from "@mysten/sui/zklogin";
import { SuiGrpcClient } from "@mysten/sui/grpc";

export async function signAndExecuteZkLogin(args: { transaction: any }): Promise<any> {
  const state = await getStoredZkLoginState();
  if (!state) throw new Error("No zkLogin session");

  const jwt = localStorage.getItem("zklogin_jwt");
  if (!jwt) throw new Error("No JWT token");

  const salt = localStorage.getItem("zklogin_salt");
  if (!salt) throw new Error("No salt");

  const randomness = localStorage.getItem("zklogin_randomness") || state.randomness;
  if (!randomness) throw new Error("No randomness");

  const address = localStorage.getItem("zklogin_address");
  if (!address) throw new Error("No zkLogin address");

  // Parse JWT to get sub and aud for addressSeed
  const payload = JSON.parse(atob(jwt.split(".")[1]));
  const aud = Array.isArray(payload.aud) ? payload.aud[0] : payload.aud;
  const addressSeed = genAddressSeed(BigInt(salt), "sub", payload.sub, aud).toString();

  // Build + sign with ephemeral key
  const tx = args.transaction;
  tx.setSender(address);

  const client = new SuiGrpcClient({ network: networkConfig.network, baseUrl: networkConfig.rpcUrl } as any);

  const { bytes, signature: userSignature } = await tx.sign({
    client,
    signer: state.ephemeralKeyPair,
  });

  // Get zkProof from Enoki
  const proof = await getZkProofFromEnoki({
    jwt,
    ephemeralPublicKey: state.ephemeralKeyPair.getPublicKey(),
    maxEpoch: state.maxEpoch,
    randomness,
    salt,
  });

  // Combine into zkLogin signature
  const zkLoginSignature = getZkLoginSignature({
    inputs: { ...proof, addressSeed },
    maxEpoch: state.maxEpoch,
    userSignature,
  });

  // Execute
  const { fromBase64 } = await import("@mysten/sui/utils");
  const txBytes = typeof bytes === "string" ? fromBase64(bytes) : bytes;
  const result = await client.executeTransaction({
    transaction: txBytes,
    signatures: [zkLoginSignature],
  });

  const digest = (result as any)?.Transaction?.digest ?? (result as any)?.digest ?? "";
  return { digest, Transaction: { digest } };
}

export function isZkLoginSession(): boolean {
  return !!localStorage.getItem("zklogin_address");
}
