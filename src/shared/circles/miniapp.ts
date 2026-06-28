import {
  isMiniappMode,
  onWalletChange as sdkOnWalletChange,
  sendTransactions as sdkSendTransactions,
  type Transaction,
} from "@aboutcircles/miniapp-sdk";
import { circlesConfig } from "@aboutcircles/sdk-core";
import { CirclesRpc } from "@aboutcircles/sdk-rpc";
import { TransferBuilder } from "@aboutcircles/sdk-transfers";
import { TREASURY_ADDRESS, CIRCLES_RPC } from "./config";
import {
  connect as connectorConnect,
  disconnect as connectorDisconnect,
  onConnectorWalletChange,
  sendTransactions as connectorSendTransactions,
} from "./connector";

const ONE_CRC = BigInt(1e18);
const config = circlesConfig[100]!;
const STORAGE_KEY = "cardroom:circles-address";

let connectedAddress: string | null = null;
let rpc: CirclesRpc | null = null;
let trustedCache: string[] | null = null;

const sessionListeners = new Set<(address: string | null) => void>();

/**
 * Wire up the active Circles transport. Embedded in the Circles host app we
 * listen to the miniapp SDK; standalone on the open web we drive the
 * `crc-signin` connector iframe and remember the last login across reloads.
 */
export function initCircles(): void {
  rpc = new CirclesRpc(CIRCLES_RPC);

  if (isMiniappMode()) {
    sdkOnWalletChange((address) => setAddress(address));
    return;
  }

  onConnectorWalletChange((address) => setAddress(address));
  restoreStoredAddress();
}

function setAddress(address: string | null): void {
  if (address === connectedAddress) return;
  connectedAddress = address;
  trustedCache = null;
  if (!isMiniappMode()) persistAddress(address);
  for (const fn of sessionListeners) fn(address);
}

function restoreStoredAddress(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setAddress(stored);
  } catch {
    // ignore privacy-mode / quota failures
  }
}

function persistAddress(address: string | null): void {
  try {
    if (address) localStorage.setItem(STORAGE_KEY, address);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore privacy-mode / quota failures
  }
}

export function isInMiniapp(): boolean {
  return isMiniappMode();
}

/** True whenever a wallet is attached — embedded host or standalone login. */
export function isConnected(): boolean {
  return connectedAddress !== null;
}

export function getWalletAddress(): string | null {
  return connectedAddress;
}

/** Subscribe to login/logout. Fires on every connected-address change. */
export function onSessionChange(
  fn: (address: string | null) => void,
): () => void {
  sessionListeners.add(fn);
  return () => sessionListeners.delete(fn);
}

/** Open the standalone connector. No-op (resolves current address) when embedded. */
export function connect(): Promise<string | null> {
  if (isMiniappMode()) return Promise.resolve(connectedAddress);
  return connectorConnect();
}

export function disconnect(): void {
  if (isMiniappMode()) return;
  connectorDisconnect();
}

/** Route a transaction batch through whichever transport is active. */
function sendTransactions(transactions: Transaction[]): Promise<string[]> {
  return isMiniappMode()
    ? sdkSendTransactions(transactions)
    : connectorSendTransactions(transactions);
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

/** Submit a pre-built leaderboard transaction over the active transport. */
export function submitTransactions(
  transactions: Transaction[],
): Promise<string[]> {
  return sendTransactions(transactions);
}

/**
 * Addresses the connected user trusts (outgoing and mutual relations),
 * lowercased and deduped. Empty before a wallet connects.
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
