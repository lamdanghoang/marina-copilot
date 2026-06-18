// Sui GraphQL client for on-chain queries

import { SuiGraphQLClient } from "@mysten/sui/graphql";
import { networkConfig } from "@/lib/config";

const GQL_URLS: Record<string, string> = {
  testnet: "https://graphql.testnet.sui.io/graphql",
  mainnet: "https://graphql.mainnet.sui.io/graphql",
};

export const gqlClient = new SuiGraphQLClient({
  url: GQL_URLS[networkConfig.network] || GQL_URLS.testnet,
  network: networkConfig.network,
});

/**
 * Find MemWalAccount objectId by owner wallet address.
 * Paginates shared objects until owner matches.
 */
export async function findMemwalAccount(packageId: string, ownerAddress: string): Promise<string | null> {
  let cursor: string | null = null;

  for (let page = 0; page < 10; page++) {
    const result = await gqlClient.query({
      query: `query($cursor: String) {
        objects(
          filter: { type: "${packageId}::account::MemWalAccount", ownerKind: SHARED },
          first: 50,
          after: $cursor
        ) {
          nodes { address asMoveObject { contents { json } } }
          pageInfo { hasNextPage endCursor }
        }
      }`,
      variables: { cursor },
    });

    const data = result.data as any;
    const nodes = data?.objects?.nodes || [];
    for (const node of nodes) {
      if (node.asMoveObject?.contents?.json?.owner === ownerAddress) return node.address;
    }
    if (!data?.objects?.pageInfo?.hasNextPage) break;
    cursor = data.objects.pageInfo.endCursor;
  }
  return null;
}
