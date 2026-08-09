import { type PlayingCard, Suit } from "typedeck";
import { createDeck, shuffle, cardKey } from "../../shared/deck";
import {
  type HeartsState,
  type PassDirection,
  type PlayerIndex,
  type Trick,
  HAND_SIZE,
  isTwoOfClubs,
  passDirectionForRound,
  passTarget,
  sortByHearts,
} from "./types";
import { resolvePreset } from "../../shared/engine/variant";
import { HEARTS_FAMILY, type HeartsConfig } from "./config";
import {
  isLeading,
  legalPlays,
  removeCardFromHand,
  trickWinner,
} from "./trick";
import { gameWinner, scoreRound } from "./score";
import { botChoosePass, botChoosePlay } from "./bot";

export class HeartsGame {
  private state: HeartsState;
  private readonly config: HeartsConfig;

  constructor(presetId?: string) {
    this.config = resolvePreset(HEARTS_FAMILY, presetId);
    this.state = this.initialState();
    this.deal();
  }

  getConfig(): Readonly<HeartsConfig> {
    return this.config;
  }

  private initialState(): HeartsState {
    return {
      phase: "PASSING",
      message: "",
      hands: [[], [], [], []],
      scores: [0, 0, 0, 0],
      roundScores: [0, 0, 0, 0],
      voidSuits: [new Set(), new Set(), new Set(), new Set()],
      passDirection: "left",
      pendingPasses: [null, null, null, null],
      heartsBroken: false,
      currentTrick: null,
      completedTricks: [],
      currentTurn: 0,
      roundNumber: 1,
      roundResult: null,
      winner: null,
    };
  }

  getState(): Readonly<HeartsState> {
    return this.state;
  }

  newGame(): void {
    this.state = this.initialState();
    this.deal();
  }

  nextRound(): void {
    if (this.state.winner !== null) return;
    this.state = {
      ...this.state,
      roundNumber: this.state.roundNumber + 1,
      roundScores: [0, 0, 0, 0],
      voidSuits: [new Set(), new Set(), new Set(), new Set()],
      heartsBroken: false,
      currentTrick: null,
      completedTricks: [],
      pendingPasses: [null, null, null, null],
      roundResult: null,
    };
    this.deal();
  }

  private deal(): void {
    const deck = shuffle(createDeck());
    const hands: PlayingCard[][] = [
      deck.slice(0, 13),
      deck.slice(13, 26),
      deck.slice(26, 39),
      deck.slice(39, 52),
    ];
    hands.forEach((h) => sortByHearts(h));
    this.state.hands = hands;
    this.state.passDirection = this.roundPassDirection();

    if (this.state.passDirection === "hold") {
      this.state.phase = "PLAYING";
      this.startFirstTrick();
    } else {
      this.state.phase = "PASSING";
      this.state.message = `Round ${this.state.roundNumber} — pass 3 cards ${this.state.passDirection}.`;
    }
  }

  /** No Pass plays every hand as dealt; Black Maria always passes right. */
  private roundPassDirection(): PassDirection {
    if (!this.config.passing) return "hold";
    return (
      this.config.fixedPassDirection ??
      passDirectionForRound(this.state.roundNumber)
    );
  }

  selectPass(player: PlayerIndex, cardIndices: number[]): boolean {
    if (this.state.phase !== "PASSING") return false;
    if (cardIndices.length !== 3) return false;
    const unique = new Set(cardIndices);
    if (unique.size !== 3) return false;
    const hand = this.state.hands[player]!;
    if (cardIndices.some((i) => i < 0 || i >= hand.length)) return false;
    this.state.pendingPasses[player] = [...cardIndices].sort((a, b) => a - b);
    return true;
  }

  allPassesSelected(): boolean {
    return this.state.pendingPasses.every((p) => p !== null);
  }

  executePass(): void {
    if (this.state.phase !== "PASSING") return;
    if (!this.allPassesSelected()) return;

    const direction = this.state.passDirection;
    if (direction === "hold") {
      this.state.phase = "PLAYING";
      this.startFirstTrick();
      return;
    }

    const cardsToReceive: PlayingCard[][] = [[], [], [], []];
    for (
      let from = 0 as PlayerIndex;
      from < 4;
      from = (from + 1) as PlayerIndex
    ) {
      const indices = this.state.pendingPasses[from]!;
      const target = passTarget(from, direction)!;
      const hand = this.state.hands[from]!;
      const taken: PlayingCard[] = [];
      const sortedDesc = [...indices].sort((a, b) => b - a);
      for (const idx of sortedDesc) {
        taken.unshift(hand.splice(idx, 1)[0]!);
      }
      cardsToReceive[target]!.push(...taken);
    }
    for (let p = 0; p < 4; p++) {
      this.state.hands[p]!.push(...cardsToReceive[p]!);
      sortByHearts(this.state.hands[p]!);
    }
    this.state.pendingPasses = [null, null, null, null];
    this.state.phase = "PLAYING";
    this.startFirstTrick();
  }

  /** Auto-select passes for all 3 bots. */
  selectBotPasses(): void {
    if (this.state.phase !== "PASSING") return;
    for (let p = 1 as PlayerIndex; p < 4; p = (p + 1) as PlayerIndex) {
      if (this.state.pendingPasses[p]) continue;
      const hand = this.state.hands[p]!;
      const idx = botChoosePass(hand, this.config);
      this.selectPass(p, idx);
    }
  }

  private startFirstTrick(): void {
    let leader: PlayerIndex = 0;
    for (let p = 0 as PlayerIndex; p < 4; p = (p + 1) as PlayerIndex) {
      if (this.state.hands[p]!.some(isTwoOfClubs)) {
        leader = p;
        break;
      }
    }
    this.state.currentTrick = { leader, ledSuit: null, plays: [] };
    this.state.currentTurn = leader;
    this.state.message =
      leader === 0
        ? "Lead the 2♣ to start."
        : `Player ${leader + 1} leads with 2♣.`;
  }

  legalPlaysFor(player: PlayerIndex): PlayingCard[] {
    const hand = this.state.hands[player]!;
    const isFirst = this.state.completedTricks.length === 0;
    return legalPlays(
      hand,
      this.state.currentTrick,
      this.state.heartsBroken,
      isFirst,
    );
  }

  playCard(player: PlayerIndex, card: PlayingCard): boolean {
    if (this.state.phase !== "PLAYING") return false;
    if (this.state.currentTurn !== player) return false;
    const trick = this.state.currentTrick;
    if (!trick) return false;

    const hand = this.state.hands[player]!;
    if (!hand.some((c) => cardKey(c) === cardKey(card))) return false;

    const legals = this.legalPlaysFor(player);
    if (!legals.some((c) => cardKey(c) === cardKey(card))) return false;

    const played = removeCardFromHand(hand, card);

    if (isLeading(trick)) {
      trick.ledSuit = played.suit;
    } else if (played.suit !== trick.ledSuit) {
      this.state.voidSuits[player]!.add(trick.ledSuit!);
    }
    trick.plays.push({ player, card: played });

    if (played.suit === Suit.Hearts) this.state.heartsBroken = true;

    if (trick.plays.length === 4) {
      this.completeTrick(trick);
    } else {
      this.state.currentTurn = ((player + 1) % 4) as PlayerIndex;
    }
    return true;
  }

  private completeTrick(trick: Trick): void {
    const winner = trickWinner(trick);
    this.state.completedTricks.push(trick);

    if (this.state.completedTricks.length === HAND_SIZE) {
      this.completeRound();
      return;
    }

    this.state.currentTrick = { leader: winner, ledSuit: null, plays: [] };
    this.state.currentTurn = winner;
    this.state.message = `Player ${winner + 1} won the trick.`;
  }

  private completeRound(): void {
    const result = scoreRound(this.state.completedTricks, this.config);
    this.state.roundResult = result;
    this.state.roundScores = result.pointsByPlayer;
    for (let i = 0; i < 4; i++) {
      this.state.scores[i]! += result.pointsByPlayer[i]!;
    }

    const winner = gameWinner(this.state.scores, this.config.targetScore);
    if (winner !== null) {
      this.state.winner = winner;
      this.state.phase = "GAME_OVER";
      this.state.message =
        winner === 0
          ? "You won the game!"
          : `Player ${winner + 1} won the game.`;
    } else {
      this.state.phase = "ROUND_OVER";
      this.state.message =
        result.shotTheMoon !== null
          ? `Player ${result.shotTheMoon + 1} shot the moon!`
          : "Round complete.";
    }
  }

  /** Used by UI to drive bot turns. Returns the card the bot played, or null if not bot's turn. */
  botPlay(): PlayingCard | null {
    if (this.state.phase !== "PLAYING") return null;
    if (this.state.currentTurn === 0) return null;
    const player = this.state.currentTurn;
    const card = botChoosePlay(this.state, player, this.config);
    this.playCard(player, card);
    return card;
  }
}
