import { type PlayingCard, Suit } from "typedeck";
import { createDeck, shuffle, cardKey } from "../../shared/deck";
import {
  type EuchreState,
  type PlayerIndex,
  type Team,
  type Trick,
  EUCHRE_RANKS,
  GAME_POINTS,
  cardStrength,
  effectiveSuit,
  isTrump,
  nextActive,
  nextPlayer,
  partnerOf,
  suitName,
  teamOf,
} from "./types";
import { legalPlays, removeCardFromHand, trickWinner } from "./trick";
import { scoreHand, gameWinner } from "./score";
import {
  type BidDecision,
  botBidRound1,
  botBidRound2,
  botDiscard,
  botPlay,
} from "./bot";

const FIRST_DEALER: PlayerIndex = 3; // so You (0) are eldest hand the first deal

function euchreDeck(): PlayingCard[] {
  return createDeck().filter((c) => EUCHRE_RANKS.has(c.cardName));
}

export class EuchreGame {
  private state: EuchreState;

  constructor() {
    this.state = this.initialState();
    this.deal();
  }

  private initialState(): EuchreState {
    return {
      phase: "BID1",
      message: "",
      hands: [[], [], [], []],
      dealer: FIRST_DEALER,
      upCard: null,
      turnedDownSuit: null,
      kitty: [],
      trump: null,
      maker: null,
      alone: false,
      aloneSitter: null,
      bidTurn: 0,
      currentTurn: 0,
      currentTrick: null,
      completedTricks: [],
      trickWins: [0, 0],
      scores: [0, 0],
      handResult: null,
      winner: null,
    };
  }

  getState(): Readonly<EuchreState> {
    return this.state;
  }

  newGame(): void {
    this.state = this.initialState();
    this.deal();
  }

  private deal(): void {
    const deck = shuffle(euchreDeck());
    const hands: PlayingCard[][] = [
      deck.slice(0, 5),
      deck.slice(5, 10),
      deck.slice(10, 15),
      deck.slice(15, 20),
    ];
    this.state.hands = hands;
    this.state.upCard = deck[20]!;
    this.state.kitty = deck.slice(21, 24);
    this.state.turnedDownSuit = null;
    this.state.trump = null;
    this.state.maker = null;
    this.state.alone = false;
    this.state.aloneSitter = null;
    this.state.currentTrick = null;
    this.state.completedTricks = [];
    this.state.trickWins = [0, 0];
    this.state.handResult = null;
    this.state.phase = "BID1";
    this.state.bidTurn = nextPlayer(this.state.dealer);
    hands.forEach((h) => this.sortHand(h));
    this.state.message = `${this.label(this.state.bidTurn)} to bid — order it up?`;
  }

  // ── Bidding ──────────────────────────────────────────────────────────────

  canPass(player: PlayerIndex): boolean {
    // Stick-the-dealer: in round 2 the dealer cannot pass.
    if (this.state.phase === "BID2" && player === this.state.dealer)
      return false;
    return this.state.phase === "BID1" || this.state.phase === "BID2";
  }

  orderUp(player: PlayerIndex, alone: boolean): boolean {
    if (this.state.phase !== "BID1" || player !== this.state.bidTurn)
      return false;
    const up = this.state.upCard!;
    this.setTrump(up.suit, player, alone);

    // The dealer picks up the up-card and must discard one.
    this.state.hands[this.state.dealer]!.push(up);
    this.state.upCard = null;

    if (this.state.dealer === 0) {
      this.state.phase = "DISCARD";
      this.state.currentTurn = 0;
      this.sortHand(this.state.hands[0]!);
      this.state.message = "You picked it up — discard a card.";
    } else {
      const discard = botDiscard(
        this.state.hands[this.state.dealer]!,
        this.state.trump!,
      );
      removeCardFromHand(this.state.hands[this.state.dealer]!, discard);
      this.startPlay();
    }
    return true;
  }

  nameTrump(player: PlayerIndex, suit: Suit, alone: boolean): boolean {
    if (this.state.phase !== "BID2" || player !== this.state.bidTurn)
      return false;
    if (suit === this.state.turnedDownSuit) return false;
    this.setTrump(suit, player, alone);
    this.startPlay();
    return true;
  }

  pass(player: PlayerIndex): boolean {
    if (!this.canPass(player) || player !== this.state.bidTurn) return false;

    // The dealer acts last in each bidding round.
    if (player === this.state.dealer) {
      if (this.state.phase === "BID1") {
        // All four passed round 1: turn the card down, start round 2.
        this.state.turnedDownSuit = this.state.upCard!.suit;
        this.state.phase = "BID2";
        this.state.bidTurn = nextPlayer(this.state.dealer);
        this.state.message = `${this.label(this.state.bidTurn)} to bid — name a suit.`;
      }
      // BID2 dealer can't pass (canPass guards it).
      return true;
    }

    this.state.bidTurn = nextPlayer(player);
    this.state.message =
      this.state.phase === "BID1"
        ? `${this.label(this.state.bidTurn)} to bid — order it up?`
        : `${this.label(this.state.bidTurn)} to bid — name a suit.`;
    return true;
  }

  private setTrump(suit: Suit, maker: PlayerIndex, alone: boolean): void {
    this.state.trump = suit;
    this.state.maker = maker;
    this.state.alone = alone;
  }

  discard(player: PlayerIndex, card: PlayingCard): boolean {
    if (this.state.phase !== "DISCARD" || player !== this.state.dealer)
      return false;
    const hand = this.state.hands[player]!;
    if (!hand.some((c) => cardKey(c) === cardKey(card))) return false;
    removeCardFromHand(hand, card);
    this.startPlay();
    return true;
  }

  private startPlay(): void {
    const maker = this.state.maker!;
    this.state.aloneSitter = this.state.alone ? partnerOf(maker) : null;
    this.state.hands.forEach((h) => this.sortHand(h));

    let leader = nextPlayer(this.state.dealer);
    if (leader === this.state.aloneSitter) leader = nextPlayer(leader);

    this.state.currentTrick = { leader, plays: [], winner: null };
    this.state.currentTurn = leader;
    this.state.phase = "PLAYING";
    this.state.message = this.makerLine();
  }

  // ── Play ─────────────────────────────────────────────────────────────────

  legalPlaysFor(player: PlayerIndex): PlayingCard[] {
    return legalPlays(
      this.state.hands[player]!,
      this.state.currentTrick,
      this.state.trump!,
    );
  }

  private activeCount(): number {
    return this.state.alone ? 3 : 4;
  }

  playCard(player: PlayerIndex, card: PlayingCard): boolean {
    if (this.state.phase !== "PLAYING") return false;
    if (this.state.currentTurn !== player) return false;
    if (player === this.state.aloneSitter) return false;
    const trick = this.state.currentTrick;
    if (!trick) return false;

    const legals = this.legalPlaysFor(player);
    if (!legals.some((c) => cardKey(c) === cardKey(card))) return false;

    const played = removeCardFromHand(this.state.hands[player]!, card);
    trick.plays.push({ player, card: played });

    if (trick.plays.length === this.activeCount()) {
      this.completeTrick(trick);
    } else {
      this.state.currentTurn = nextActive(player, this.state.aloneSitter);
    }
    return true;
  }

  private completeTrick(trick: Trick): void {
    const winner = trickWinner(trick, this.state.trump!);
    trick.winner = winner;
    this.state.trickWins[teamOf(winner)]++;
    this.state.completedTricks.push(trick);

    if (this.state.completedTricks.length === 5) {
      this.completeHand();
      return;
    }

    this.state.currentTrick = { leader: winner, plays: [], winner: null };
    this.state.currentTurn = winner;
    this.state.message = `${this.label(winner)} won the trick. ${this.makerLine()}`;
  }

  private completeHand(): void {
    const makerTeam = teamOf(this.state.maker!);
    const result = scoreHand(
      this.state.trickWins,
      makerTeam,
      this.state.maker!,
      this.state.alone,
    );
    this.state.handResult = result;
    this.state.scores[result.scoringTeam] += result.points;

    const winner = gameWinner(this.state.scores, GAME_POINTS);
    if (winner !== null) {
      this.state.winner = winner;
      this.state.phase = "GAME_OVER";
      this.state.message =
        winner === 0
          ? "Your team wins the game!"
          : "The opponents win the game.";
    } else {
      this.state.phase = "HAND_OVER";
      this.state.message = this.resultLine(result);
    }
  }

  nextHand(): void {
    if (this.state.winner !== null) return;
    this.state.dealer = nextPlayer(this.state.dealer);
    this.deal();
  }

  // ── Bot driving ────────────────────────────────────────────────────────────

  isBotBidTurn(): boolean {
    return (
      (this.state.phase === "BID1" || this.state.phase === "BID2") &&
      this.state.bidTurn !== 0
    );
  }

  /** Apply the current bot bidder's decision. Returns what it did. */
  botBid(): BidDecision & { player: PlayerIndex } {
    const player = this.state.bidTurn;
    const hand = this.state.hands[player]!;
    let decision: BidDecision;

    if (this.state.phase === "BID1") {
      decision = botBidRound1(
        hand,
        this.state.upCard!,
        player,
        this.state.dealer,
      );
      if (decision.action === "orderup") this.orderUp(player, decision.alone);
      else this.pass(player);
    } else {
      const mustName = player === this.state.dealer; // stick the dealer
      decision = botBidRound2(
        hand,
        this.state.turnedDownSuit!,
        player,
        this.state.dealer,
        mustName,
      );
      if (decision.action === "name" && decision.suit !== undefined)
        this.nameTrump(player, decision.suit, decision.alone);
      else this.pass(player);
    }
    return { ...decision, player };
  }

  isBotPlayTurn(): boolean {
    return this.state.phase === "PLAYING" && this.state.currentTurn !== 0;
  }

  /** Play for the current bot. Returns the card played, or null if not applicable. */
  botPlay(): PlayingCard | null {
    if (this.state.phase !== "PLAYING") return null;
    if (this.state.currentTurn === 0) return null;
    const player = this.state.currentTurn;
    const card = botPlay(
      this.state.hands[player]!,
      this.state.currentTrick!,
      this.state.trump!,
    );
    this.playCard(player, card);
    return card;
  }

  // ── Display helpers ──────────────────────────────────────────────────────

  label(player: PlayerIndex): string {
    return ["You", "Left", "Partner", "Right"][player]!;
  }

  private makerLine(): string {
    const maker = this.state.maker!;
    const who = maker === 0 ? "You" : this.label(maker);
    const aloneTxt = this.state.alone ? " alone" : "";
    return `${who} called ${suitName(this.state.trump!)}${aloneTxt}.`;
  }

  private resultLine(result: {
    scoringTeam: Team;
    points: number;
    kind: string;
  }): string {
    const yourTeam = result.scoringTeam === 0;
    const verb =
      result.kind === "euchre"
        ? yourTeam
          ? "Euchred them"
          : "Euchred!"
        : yourTeam
          ? "Your team scores"
          : "Opponents score";
    return `${verb} +${result.points}.`;
  }

  /** Sort a hand for display: trump grouped first (high→low), then by suit. */
  private sortHand(hand: PlayingCard[]): void {
    const trump = this.state.trump;
    const suitOrder = (c: PlayingCard): number => {
      if (trump && isTrump(c, trump)) return 0;
      const eff = trump ? effectiveSuit(c, trump) : c.suit;
      return (
        1 + [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds].indexOf(eff)
      );
    };
    const value = (c: PlayingCard): number =>
      trump ? cardStrength(c, trump, effectiveSuit(c, trump)) : rankNoTrump(c);
    hand.sort((a, b) => suitOrder(a) - suitOrder(b) || value(b) - value(a));
  }
}

function rankNoTrump(card: PlayingCard): number {
  // A K Q J 10 9 high→low for pre-trump display
  const order = [14, 13, 12, 11, 10, 9];
  const names = [0, 12, 11, 10, 9, 8]; // Ace,King,Queen,Jack,Ten,Nine cardName values
  const idx = names.indexOf(card.cardName);
  return idx >= 0 ? order[idx]! : card.cardName;
}
