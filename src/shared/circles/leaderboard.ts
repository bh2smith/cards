import {
  createPublicClient,
  http,
  encodeFunctionData,
  type Address,
} from "viem";
import { gnosis } from "viem/chains";
import { sendTransactions, type Transaction } from "@aboutcircles/miniapp-sdk";
import { leaderboardAbi } from "./leaderboardAbi";
import { CIRCLES_RPC, LEADERBOARD_ADDRESS } from "./config";
import { getWalletAddress, isInMiniapp } from "./miniapp";

export const GameId = {
  Golf: 0,
  Pyramid: 1,
  Cribbage: 2,
  Blackjack: 3,
  GinRummy: 4,
  Hearts: 5,
  Klondike: 6,
} as const;

export type GameIdValue = (typeof GameId)[keyof typeof GameId];

export interface PlayerStats {
  wins: number;
  losses: number;
  totalCardsRemaining: number;
  gamesPlayed: number;
  lastPlayedAt: bigint;
}

export interface LeaderboardEntry {
  player: Address;
  stats: PlayerStats;
}

const client = createPublicClient({
  chain: gnosis,
  transport: http(CIRCLES_RPC),
});

function parseStats(raw: {
  wins: number;
  losses: number;
  totalCardsRemaining: number;
  gamesPlayed: number;
  lastPlayedAt: bigint;
}): PlayerStats {
  return {
    wins: raw.wins,
    losses: raw.losses,
    totalCardsRemaining: raw.totalCardsRemaining,
    gamesPlayed: raw.gamesPlayed,
    lastPlayedAt: raw.lastPlayedAt,
  };
}

export function encodeStartGame(gameId: GameIdValue): Transaction {
  const data = encodeFunctionData({
    abi: leaderboardAbi,
    functionName: "startGame",
    args: [gameId],
  });
  return { to: LEADERBOARD_ADDRESS, data };
}

export async function submitSoloResult(
  gameId: GameIdValue,
  won: boolean,
  cardsRemaining: number,
): Promise<string[]> {
  const data = encodeFunctionData({
    abi: leaderboardAbi,
    functionName: "recordSoloResult",
    args: [gameId, won, cardsRemaining],
  });

  const tx: Transaction = { to: LEADERBOARD_ADDRESS, data };
  return sendTransactions([tx]);
}

export async function submitVsAiResult(
  gameId: GameIdValue,
  won: boolean,
): Promise<string[]> {
  const data = encodeFunctionData({
    abi: leaderboardAbi,
    functionName: "recordVsAiResult",
    args: [gameId, won],
  });

  const tx: Transaction = { to: LEADERBOARD_ADDRESS, data };
  return sendTransactions([tx]);
}

export async function fetchMyStats(
  gameId: GameIdValue,
): Promise<PlayerStats | null> {
  const address = getWalletAddress();
  if (!address) return null;
  return fetchPlayerStats(gameId, address as Address);
}

export async function fetchPlayerStats(
  gameId: GameIdValue,
  player: Address,
): Promise<PlayerStats> {
  const result = await client.readContract({
    address: LEADERBOARD_ADDRESS,
    abi: leaderboardAbi,
    functionName: "getPlayerStats",
    args: [gameId, player],
  });

  return parseStats(result);
}

export class LeaderboardReporter {
  private submitted = false;
  private gameId: GameIdValue;
  private terminalPhase: string;

  constructor(gameId: GameIdValue, terminalPhase = "GAME_OVER") {
    this.gameId = gameId;
    this.terminalPhase = terminalPhase;
  }

  reportSolo(phase: string, won: boolean, cardsRemaining: number): void {
    if (phase !== this.terminalPhase || this.submitted) return;
    this.submitted = true;
    if (!isInMiniapp()) return;
    submitSoloResult(this.gameId, won, cardsRemaining).catch(() => {});
  }

  reportVsAi(phase: string, won: boolean): void {
    if (phase !== this.terminalPhase || this.submitted) return;
    this.submitted = true;
    if (!isInMiniapp()) return;
    submitVsAiResult(this.gameId, won).catch(() => {});
  }
}

export async function fetchTopLeaderboard(
  gameId: GameIdValue,
): Promise<LeaderboardEntry[]> {
  const [players, playerStats] = await client.readContract({
    address: LEADERBOARD_ADDRESS,
    abi: leaderboardAbi,
    functionName: "getTop",
    args: [gameId],
  });

  return players.map((player, i) => ({
    player,
    stats: parseStats(playerStats[i]!),
  }));
}
