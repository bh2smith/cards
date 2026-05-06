import {
  isMiniappMode,
  onWalletChange,
  sendTransactions,
  type Transaction,
} from "@aboutcircles/miniapp-sdk";
import { Sdk } from "@aboutcircles/sdk";
import { circlesConfig } from "@aboutcircles/sdk-core";
import { TransferBuilder } from "@aboutcircles/sdk-transfers";
import { TREASURY_ADDRESS, GNOSIS_GROUP } from "./config";

const ONE_CRC = BigInt(1e18);
const config = circlesConfig[100]!;

let connectedAddress: string | null = null;
let sdk: Sdk | null = null;

export function initMiniapp(): void {
  if (!isMiniappMode()) return;
  sdk = new Sdk(config);
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

export async function isGnosisGroupMember(address: string): Promise<boolean> {
  if (!sdk) return false;
  const members = await sdk.groups.getMembers(GNOSIS_GROUP);
  for (const m of members.results) {
    if (m.member.toLowerCase() === address.toLowerCase()) return true;
  }
  return false;
}

export async function getMaxTransferableAmount(from: string): Promise<bigint> {
  const builder = new TransferBuilder(config);
  const txs = await builder
    .constructAdvancedTransfer(from, TREASURY_ADDRESS, ONE_CRC)
    .catch(() => null);
  return txs ? ONE_CRC : 0n;
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
