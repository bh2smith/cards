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
import { encodeStartGame, type GameIdValue } from "./leaderboard";

const ONE_CRC = BigInt(1e18);
const config = circlesConfig[100]!;

let connectedAddress: string | null = null;
let sdk: Sdk | null = null;
let rpc: CirclesRpc | null = null;

export function initMiniapp(): void {
  if (!isMiniappMode()) return;
  sdk = new Sdk(config);
  rpc = new CirclesRpc(CIRCLES_RPC);
  onWalletChange((address) => {
    connectedAddress = address;
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

export async function chargeEntryFeeWithStartGame(
  gameId: GameIdValue,
): Promise<string[]> {
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

  miniappTxs.push(encodeStartGame(gameId));

  return sendTransactions(miniappTxs);
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
