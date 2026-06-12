import {
  isMiniappMode,
  onWalletChange,
  sendTransactions,
  type Transaction,
} from "@aboutcircles/miniapp-sdk";
import { Sdk } from "@aboutcircles/sdk";
import type { Profile } from "@aboutcircles/sdk-types";
import { circlesConfig } from "@aboutcircles/sdk-core";
import { CirclesRpc } from "@aboutcircles/sdk-rpc";
import { TransferBuilder } from "@aboutcircles/sdk-transfers";
import { TREASURY_ADDRESS, GNOSIS_GROUP, CIRCLES_RPC } from "./config";

const ONE_CRC = BigInt(1e18);
const config = circlesConfig[100]!;

let connectedAddress: string | null = null;
let sdk: Sdk | null = null;
let rpc: CirclesRpc | null = null;
let trustedCache: string[] | null = null;

export function initMiniapp(): void {
  if (!isMiniappMode()) return;
  sdk = new Sdk(config);
  rpc = new CirclesRpc(CIRCLES_RPC);
  onWalletChange((address) => {
    connectedAddress = address;
    trustedCache = null;
  });
}

export function isInMiniapp(): boolean {
  return isMiniappMode();
}

export function getWalletAddress(): string | null {
  return connectedAddress;
}

export async function canPayEntryFee(address: string): Promise<boolean> {
  try {
    const builder = new TransferBuilder(config);
    const txs = await builder.constructAdvancedTransfer(
      address,
      TREASURY_ADDRESS,
      ONE_CRC,
    );
    return txs.length > 0;
  } catch {
    return false;
  }
}

export async function chargeEntryFee(): Promise<string[]> {
  if (!connectedAddress) throw new Error("Wallet not connected");

  const builder = new TransferBuilder(config);
  const txs = await builder.constructAdvancedTransfer(
    connectedAddress,
    TREASURY_ADDRESS,
    ONE_CRC,
  );

  const miniappTxs: Transaction[] = txs.map((tx) => ({
    to: tx.to,
    data: tx.data,
    value: tx.value ? `0x${tx.value.toString(16)}` : undefined,
  }));

  return sendTransactions(miniappTxs);
}

/**
 * Addresses the connected user trusts (outgoing and mutual relations),
 * lowercased and deduped. Empty outside the miniapp or before the wallet
 * connects.
 */
export async function fetchTrustedAddresses(): Promise<string[]> {
  if (trustedCache) return trustedCache;
  if (!rpc || !connectedAddress) return [];

  const relations = await rpc.trust.getAggregatedTrustRelations(
    connectedAddress as `0x${string}`,
  );
  const seen = new Set<string>();
  for (const rel of relations) {
    if (rel.relation !== "trusts" && rel.relation !== "mutuallyTrusts")
      continue;
    seen.add(rel.objectAvatar.toLowerCase());
  }
  trustedCache = [...seen];
  return trustedCache;
}

export interface ResolvedProfile {
  name: string;
  imageUrl?: string;
}

const profileCache = new Map<string, ResolvedProfile>();

export async function resolveProfiles(
  addresses: string[],
): Promise<Map<string, ResolvedProfile>> {
  const result = new Map<string, ResolvedProfile>();
  const toFetch: string[] = [];

  for (const addr of addresses) {
    const key = addr.toLowerCase();
    const cached = profileCache.get(key);
    if (cached) {
      result.set(key, cached);
    } else {
      toFetch.push(addr);
    }
  }

  if (toFetch.length === 0 || !rpc) return result;

  try {
    const profiles = await rpc.profile.getProfileByAddressBatch(toFetch);
    for (let i = 0; i < toFetch.length; i++) {
      const key = toFetch[i]!.toLowerCase();
      const p = profiles[i];
      if (p?.name) {
        const resolved: ResolvedProfile = {
          name: p.name,
          imageUrl: p.previewImageUrl ?? p.imageUrl,
        };
        profileCache.set(key, resolved);
        result.set(key, resolved);
      }
    }
  } catch {
    // profile resolution is best-effort
  }

  return result;
}
