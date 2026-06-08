// Enoki integration — managed zkLogin salt + proof generation

import { EnokiClient } from "@mysten/enoki";

const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY || "";

let enokiClient: EnokiClient | null = null;

function getEnokiClient(): EnokiClient {
  if (!enokiClient) {
    if (!ENOKI_API_KEY) throw new Error("Enoki API key not configured");
    enokiClient = new EnokiClient({ apiKey: ENOKI_API_KEY });
  }
  return enokiClient;
}

export function isEnokiConfigured(): boolean {
  return ENOKI_API_KEY !== "";
}

export async function getZkLoginInfoFromEnoki(jwt: string): Promise<{ address: string; salt: string }> {
  const client = getEnokiClient();
  const response = await client.getZkLogin({ jwt });
  return { address: response.address, salt: response.salt };
}

export interface ZkProofResponse {
  proofPoints: { a: string[]; b: string[][]; c: string[] };
  issBase64Details: { value: string; indexMod4: number };
  headerBase64: string;
}

let cachedProof: { proof: ZkProofResponse; jwt: string; maxEpoch: number } | null = null;

export async function getZkProofFromEnoki(params: {
  jwt: string;
  ephemeralPublicKey: unknown;
  maxEpoch: number;
  randomness: string;
  salt: string;
}): Promise<ZkProofResponse> {
  if (cachedProof && cachedProof.jwt === params.jwt && cachedProof.maxEpoch === params.maxEpoch) {
    return cachedProof.proof;
  }

  const client = getEnokiClient();
  const network = (process.env.NEXT_PUBLIC_SUI_NETWORK as "mainnet" | "testnet") || "testnet";

  const response = await client.createZkLoginZkp({
    jwt: params.jwt,
    ephemeralPublicKey: params.ephemeralPublicKey as Parameters<typeof client.createZkLoginZkp>[0]["ephemeralPublicKey"],
    maxEpoch: params.maxEpoch,
    randomness: params.randomness,
    network,
  });

  const proof: ZkProofResponse = {
    proofPoints: {
      a: Array.from(response.proofPoints.a),
      b: Array.from(response.proofPoints.b).map((arr) => Array.from(arr)),
      c: Array.from(response.proofPoints.c),
    },
    issBase64Details: response.issBase64Details,
    headerBase64: response.headerBase64,
  };

  cachedProof = { proof, jwt: params.jwt, maxEpoch: params.maxEpoch };
  return proof;
}

export function clearCachedProof(): void {
  cachedProof = null;
}
