import { CardName, PlayingCard, Suit } from "typedeck";
import { createDeck, shuffle, cardKey } from "../../shared/deck";
import { resolvePreset } from "../../shared/engine/variant";
import { EUCHRE_FAMILY, type EuchreConfig } from "./config";
import {
  type EuchreState,
  type PlayerIndex,
  type SideScores,
  type Trick,
  EUCHRE_RANKS,
  cardStrength,
  effectiveSuit,
  isJoker,
  isTrump,
  partnerOf,
  suitName,
  teamOf,
} from "./types";
import { legalPlays, removeCardFromHand, trickWinner } from "./trick";
import { scoreHand, scoreCutthroatHand, gameWinner } from "./score";
import {
  type BidDecision,
  bestPartnerGive,
  botBidRound1,
  botBidRound2,
  botDiscard,
  botPlay,
} from "./bot";

const TEAM_LABELS = ["You", "Left", "Partner", "Right"];
const CUTTHROAT_LABELS = ["You", "Left", "Right"];

export class EuchreGame {
  private state: EuchreState;
  private readonly config: EuchreConfig;

  constructor(presetId?: string) {
    this.config = resolvePreset(EUCHRE_FAMILY, presetId);
    this.state = this.initialState();
    this.deal();
  }

  getConfig(): Readonly<EuchreConfig> {
    return this.config;
  }

  // ── Seats & sides ────────────────────────────────────────────────────────
  //
  // PlayerIndex stays 0-3; in cutthroat seat 3 is absent (empty hand, skipped
  // in every rotation). A "side" is the scoring unit: a team in partnership
  // play, the individual player in cutthroat.

  seats(): PlayerIndex[] {
    return this.config.players === 3 ? [0, 1, 2] : [0, 1, 2, 3];
  }

  private nextSeat(player: PlayerIndex): PlayerIndex {
    const seats = this.seats();
    return seats[(seats.indexOf(player) + 1) % seats.length]!;
  }

  private nextActiveSeat(player: PlayerIndex): PlayerIndex {
    let n = this.nextSeat(player);
    if (n === this.state.aloneSitter) n = this.nextSeat(n);
    return n;
  }

  sideOf(player: PlayerIndex): number {
    return this.config.players === 3 ? player : teamOf(player);
  }

  private zeroScores(): SideScores {
    return this.config.players === 3 ? [0, 0, 0] : [0, 0];
  }

  private initialState(): EuchreState {
    return {
      phase: "BID1",
      message: "",
      hands: [[], [], [], []],
      // First dealer is the seat to the human's right, so You are eldest hand.
      dealer: this.config.players === 3 ? 2 : 3,
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
      trickWins: this.zeroScores(),
      scores: this.zeroScores(),
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

  private buildDeck(): PlayingCard[] {
    const deck = createDeck().filter((c) => EUCHRE_RANKS.has(c.cardName));
    if (this.config.joker)
      deck.push(new PlayingCard(CardName.Joker, Suit.Spades));
    return deck;
  }

  private deal(): void {
    const deck = shuffle(this.buildDeck());
    const seats = this.seats();
    const hands: PlayingCard[][] = [[], [], [], []];
    let i = 0;
    for (const seat of seats) {
      hands[seat] = deck.slice(i, i + 5);
      i += 5;
    }
    // The joker cannot be the turn-up (it has no suit to order); bury it.
    if (isJoker(deck[i]!)) {
      const last = deck.length - 1;
      const tmp = deck[i]!;
      deck[i] = deck[last]!;
      deck[last] = tmp;
    }
    this.state.hands = hands;
    this.state.upCard = deck[i]!;
    this.state.kitty = deck.slice(i + 1);
    this.state.turnedDownSuit = null;
    this.state.trump = null;
    this.state.maker = null;
    this.state.alone = false;
    this.state.aloneSitter = null;
    this.state.currentTrick = null;
    this.state.completedTricks = [];
    this.state.trickWins = this.zeroScores();
    this.state.handResult = null;
    this.state.phase = "BID1";
    this.state.bidTurn = this.nextSeat(this.state.dealer);
    hands.forEach((h) => this.sortHand(h));
    this.state.message = `${this.label(this.state.bidTurn)} to bid — order it up?`;
  }

  // ── Bidding ──────────────────────────────────────────────────────────────

  canPass(player: PlayerIndex): boolean {
    // Stick-the-dealer: in round 2 the dealer cannot pass.
    if (
      this.config.stickTheDealer &&
      this.state.phase === "BID2" &&
      player === this.state.dealer
    )
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
        // All passed round 1: turn the card down, start round 2.
        this.state.turnedDownSuit = this.state.upCard!.suit;
        this.state.phase = "BID2";
        this.state.bidTurn = this.nextSeat(this.state.dealer);
        this.state.message = `${this.label(this.state.bidTurn)} to bid — name a suit.`;
      } else {
        // No stick-the-dealer: the hand is thrown in, next dealer redeals.
        this.state.dealer = this.nextSeat(this.state.dealer);
        this.deal();
        this.state.message = `Passed out — thrown in. ${this.state.message}`;
      }
      return true;
    }

    this.state.bidTurn = this.nextSeat(player);
    this.state.message =
      this.state.phase === "BID1"
        ? `${this.label(this.state.bidTurn)} to bid — order it up?`
        : `${this.label(this.state.bidTurn)} to bid — name a suit.`;
    return true;
  }

  private setTrump(suit: Suit, maker: PlayerIndex, alone: boolean): void {
    this.state.trump = suit;
    this.state.maker = maker;
    // Cutthroat has no partner: the maker is alone against both by definition.
    this.state.alone = this.config.players === 3 ? false : alone;
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
    this.state.aloneSitter =
      this.config.players === 4 && this.state.alone ? partnerOf(maker) : null;

    // Railroad alone exchange: the sitting partner passes their best card to
    // the loner, who then discards back down to five.
    if (this.state.aloneSitter !== null && this.config.joker) {
      const sitterHand = this.state.hands[this.state.aloneSitter]!;
      const gift = bestPartnerGive(sitterHand, this.state.trump!);
      removeCardFromHand(sitterHand, gift);
      this.state.hands[maker]!.push(gift);

      if (maker === 0) {
        this.state.phase = "ALONE_DISCARD";
        this.state.currentTurn = 0;
        this.sortHand(this.state.hands[0]!);
        this.state.message = "Partner passed you a card — discard one.";
        return;
      }
      const discard = botDiscard(this.state.hands[maker]!, this.state.trump!);
      removeCardFromHand(this.state.hands[maker]!, discard);
    }

    this.beginTricks();
  }

  /** Railroad: the human loner sheds the sixth card after the exchange. */
  aloneDiscard(card: PlayingCard): boolean {
    if (this.state.phase !== "ALONE_DISCARD") return false;
    const hand = this.state.hands[0]!;
    if (!hand.some((c) => cardKey(c) === cardKey(card))) return false;
    removeCardFromHand(hand, card);
    this.beginTricks();
    return true;
  }

  private beginTricks(): void {
    this.state.hands.forEach((h) => this.sortHand(h));

    let leader = this.nextSeat(this.state.dealer);
    if (leader === this.state.aloneSitter) leader = this.nextSeat(leader);

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
    if (this.config.players === 3) return 3;
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
      this.state.currentTurn = this.nextActiveSeat(player);
    }
    return true;
  }

  private completeTrick(trick: Trick): void {
    const winner = trickWinner(trick, this.state.trump!);
    trick.winner = winner;
    this.state.trickWins[this.sideOf(winner)]!++;
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
    const maker = this.state.maker!;
    const result =
      this.config.players === 3
        ? scoreCutthroatHand(this.state.trickWins, maker)
        : scoreHand(
            this.state.trickWins,
            this.sideOf(maker),
            maker,
            this.state.alone,
          );
    this.state.handResult = result;
    for (const award of result.awards) {
      this.state.scores[award.side]! += award.points;
    }

    const winner = gameWinner(this.state.scores, this.config.targetScore);
    if (winner !== null) {
      this.state.winner = winner;
      this.state.phase = "GAME_OVER";
      this.state.message = this.winnerLine(winner);
    } else {
      this.state.phase = "HAND_OVER";
      this.state.message = this.resultLine(result);
    }
  }

  nextHand(): void {
    if (this.state.winner !== null) return;
    this.state.dealer = this.nextSeat(this.state.dealer);
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
    const cutthroat = this.config.players === 3;
    let decision: BidDecision;

    if (this.state.phase === "BID1") {
      decision = botBidRound1(
        hand,
        this.state.upCard!,
        player,
        this.state.dealer,
        cutthroat,
      );
      if (decision.action === "orderup") this.orderUp(player, decision.alone);
      else this.pass(player);
    } else {
      const mustName =
        this.config.stickTheDealer && player === this.state.dealer;
      decision = botBidRound2(
        hand,
        this.state.turnedDownSuit!,
        player,
        this.state.dealer,
        mustName,
        cutthroat,
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
    const maker = this.state.maker!;
    const isAlly =
      this.config.players === 3
        ? (p: PlayerIndex) => player !== maker && p !== maker && p !== player
        : (p: PlayerIndex) => p === partnerOf(player);
    const card = botPlay(
      this.state.hands[player]!,
      this.state.currentTrick!,
      this.state.trump!,
      { me: player, isAlly },
    );
    this.playCard(player, card);
    return card;
  }

  // ── Display helpers ──────────────────────────────────────────────────────

  label(player: PlayerIndex): string {
    return (this.config.players === 3 ? CUTTHROAT_LABELS : TEAM_LABELS)[
      player
    ]!;
  }

  private makerLine(): string {
    const maker = this.state.maker!;
    const who = maker === 0 ? "You" : this.label(maker);
    const aloneTxt = this.state.alone ? " alone" : "";
    return `${who} called ${suitName(this.state.trump!)}${aloneTxt}.`;
  }

  private winnerLine(winner: number): string {
    if (this.config.players === 3) {
      return winner === 0
        ? "You win the game!"
        : `${this.label(winner as PlayerIndex)} wins the game.`;
    }
    return winner === 0
      ? "Your team wins the game!"
      : "The opponents win the game.";
  }

  private resultLine(result: {
    maker: PlayerIndex;
    scoringTeam: number;
    points: number;
    kind: string;
  }): string {
    if (this.config.players === 3) {
      if (result.kind === "euchre") {
        const maker =
          result.maker === 0 ? "You were" : `${this.label(result.maker)} was`;
        return `${maker} euchred — defenders +2 each.`;
      }
      const who =
        result.scoringTeam === 0
          ? "You score"
          : `${this.label(result.scoringTeam as PlayerIndex)} scores`;
      return `${who} +${result.points}.`;
    }
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
      if (isJoker(c)) return 0; // pre-trump: show the joker up front
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
  if (isJoker(card)) return 15; // above every rank pre-trump
  // A K Q J 10 9 high→low for pre-trump display
  const order = [14, 13, 12, 11, 10, 9];
  const names = [0, 12, 11, 10, 9, 8]; // Ace,King,Queen,Jack,Ten,Nine cardName values
  const idx = names.indexOf(card.cardName);
  return idx >= 0 ? order[idx]! : card.cardName;
}
