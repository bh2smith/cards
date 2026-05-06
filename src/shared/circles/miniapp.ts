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
