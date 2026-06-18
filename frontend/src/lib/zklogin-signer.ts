// zkLogin transaction signing
// Combines ephemeral key signature + zkProof to execute transactions

import { getStoredZkLoginState } from "./zklogin";
import { getZkProofFromEnoki } from "./enoki";
import { secureGet } from "./secure-storage";
import { networkConfig } from "./config";
import { getZkLoginSignature } from "@mysten/sui/zklogin";

export async function signAndExecuteZkLogin(args: { transaction: any }): Promise<any> {
  const state = await getStoredZkLoginState();
  if (!state) throw new Error("No zkLogin session");

  const jwt = await secureGet("zklogin_jwt") || localStorage.getItem("zklogin_jwt");
  if (!jwt) throw new Error("No JWT token");

  const salt = await secureGet("zklogin_salt") || localStorage.getItem("zklogin_salt");
  if (!salt) throw new Error("No salt");

  const address = localStorage.getItem("zklogin_address");
  if (!address) throw new Error("No zkLogin address");

  // Build transaction
  const tx = args.transaction;
  tx.setSender(address);

  const client = await getClient();
  const txBytes = await tx.build({ client });

  // Sign with ephemeral key
  const { signature: ephemeralSig } = await state.ephemeralKeyPair.signTransaction(txBytes);

  // Get zkProof from Enoki
  const proof = await getZkProofFromEnoki({
    jwt,
    ephemeralPublicKey: state.ephemeralKeyPair.getPublicKey().toBase64(),
    maxEpoch: state.maxEpoch,
    randomness: state.randomness || (await secureGet("zklogin_randomness")) || "",
    salt,
  });

  // Combine into zkLogin signature
  const zkSig = getZkLoginSignature({
    inputs: {
      proofPoints: proof.proofPoints,
      issBase64Details: proof.issBase64Details,
      headerBase64: proof.headerBase64,
      addressSeed: salt,
    },
    maxEpoch: state.maxEpoch,
    userSignature: ephemeralSig,
  });

  // Execute
  const result = await client.executeTransaction({
    transaction: txBytes,
    signatures: [zkSig],
  });

  return result;
}

async function getClient() {
  const { SuiGrpcClient } = await import("@mysten/sui/grpc");
  return new SuiGrpcClient({ network: networkConfig.network, baseUrl: networkConfig.rpcUrl } as any);
}

export function isZkLoginSession(): boolean {
  return !!localStorage.getItem("zklogin_address");
}
