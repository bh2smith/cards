import { type PlayingCard, Suit } from "typedeck";
import {
  cardKey,
  createDeck,
  randomSeed,
  seededRng,
  shuffle,
} from "../../shared/deck";
import {
  type Bid,
  type PlayerIndex,
  type SpadesState,
  type Trick,
  HAND_SIZE,
  MAX_BID,
  NIL,
  isSpade,
  nextPlayer,
  spadesRank,
  teamContract,
  teamOf,
} from "./types";
import { legalPlays, removeCardFromHand, trickWinner } from "./trick";
import { gameWinner, scoreHand } from "./score";
import { botBid, botPlay } from "./bot";

const FIRST_DEALER: PlayerIndex = 3; // so You (0) bid and lead first
const LABELS = ["You", "Left", "Partner", "Right"] as const;
const SUIT_ORDER = [Suit.Spades, Suit.Hearts, Suit.Clubs, Suit.Diamonds];

export class SpadesGame {
  private state: SpadesState;
  private rng: () => number;

  /** When true, botBid/botPlay also act for seat 0 (soak tests). */
  autoPilot = false;

  constructor(seed?: number) {
    this.rng = seededRng(seed ?? randomSeed());
    this.state = this.initialState();
    this.deal();
  }

  private initialState(): SpadesState {
    return {
      phase: "BIDDING",
      message: "",
      hands: [[], [], [], []],
      dealer: FIRST_DEALER,
      bidTurn: 0,
      bids: [null, null, null, null],
      currentTurn: 0,
      currentTrick: null,
      completedTricks: [],
      spadesBroken: false,
      tricksByPlayer: [0, 0, 0, 0],
      tricksWon: [0, 0],
      bags: [0, 0],
      scores: [0, 0],
      handResult: null,
      winner: null,
    };
  }

  getState(): Readonly<SpadesState> {
    return this.state;
  }

  newGame(): void {
    this.state = this.initialState();
    this.deal();
  }

  private deal(): void {
    const deck = shuffle(createDeck(), this.rng);
    this.state.hands = [
      deck.slice(0, 13),
      deck.slice(13, 26),
      deck.slice(26, 39),
      deck.slice(39, 52),
    ];
    this.state.hands.forEach((h) => sortHand(h));
    this.state.bids = [null, null, null, null];
    this.state.currentTrick = null;
    this.state.completedTricks = [];
    this.state.spadesBroken = false;
    this.state.tricksByPlayer = [0, 0, 0, 0];
    this.state.tricksWon = [0, 0];
    this.state.handResult = null;
    this.state.phase = "BIDDING";
    this.state.bidTurn = nextPlayer(this.state.dealer);
    this.state.message = `${this.label(this.state.bidTurn)} to bid.`;
  }

  // ── Bidding ──────────────────────────────────────────────────────────────

  placeBid(player: PlayerIndex, bid: Bid): boolean {
    if (this.state.phase !== "BIDDING" || player !== this.state.bidTurn)
      return false;
    if (!Number.isInteger(bid) || bid < NIL || bid > MAX_BID) return false;

    this.state.bids[player] = bid;
    if (this.state.bids.every((b) => b !== null)) {
      this.startPlay();
    } else {
      this.state.bidTurn = nextPlayer(player);
      this.state.message = `${this.label(this.state.bidTurn)} to bid.`;
    }
    return true;
  }

  private startPlay(): void {
    const leader = nextPlayer(this.state.dealer); // eldest hand leads
    this.state.currentTrick = { leader, plays: [], winner: null };
    this.state.currentTurn = leader;
    this.state.phase = "PLAYING";
    const ours = teamContract(this.state.bids, 0);
    const theirs = teamContract(this.state.bids, 1);
    this.state.message = `Contracts — you: ${ours}, opponents: ${theirs}. ${this.label(leader)} lead${leader === 0 ? "" : "s"}.`;
  }

  // ── Play ─────────────────────────────────────────────────────────────────

  legalPlaysFor(player: PlayerIndex): PlayingCard[] {
    return legalPlays(
      this.state.hands[player]!,
      this.state.currentTrick,
      this.state.spadesBroken,
    );
  }

  playCard(player: PlayerIndex, card: PlayingCard): boolean {
    if (this.state.phase !== "PLAYING") return false;
    if (this.state.currentTurn !== player) return false;
    const trick = this.state.currentTrick;
    if (!trick) return false;

    const legals = this.legalPlaysFor(player);
    if (!legals.some((c) => cardKey(c) === cardKey(card))) return false;

    const played = removeCardFromHand(this.state.hands[player]!, card);
    trick.plays.push({ player, card: played });
    if (isSpade(played)) this.state.spadesBroken = true;

    if (trick.plays.length === 4) {
      this.completeTrick(trick);
    } else {
      this.state.currentTurn = nextPlayer(player);
    }
    return true;
  }

  private completeTrick(trick: Trick): void {
    const winner = trickWinner(trick);
    trick.winner = winner;
    this.state.tricksByPlayer[winner]++;
    this.state.tricksWon[teamOf(winner)]++;
    this.state.completedTricks.push(trick);

    if (this.state.completedTricks.length === HAND_SIZE) {
      this.completeHand();
      return;
    }

    this.state.currentTrick = { leader: winner, plays: [], winner: null };
    this.state.currentTurn = winner;
    this.state.message = `${this.label(winner)} won the trick.`;
  }

  private completeHand(): void {
    const { result, bags } = scoreHand(
      this.state.bids as [Bid, Bid, Bid, Bid],
      this.state.tricksByPlayer,
      this.state.bags,
    );
    this.state.handResult = result;
    this.state.bags = bags;
    this.state.scores[0] += result.teams[0].total;
    this.state.scores[1] += result.teams[1].total;

    const winner = gameWinner(this.state.scores);
    if (winner !== null) {
      this.state.winner = winner;
      this.state.phase = "GAME_OVER";
      this.state.message =
        winner === 0
          ? "Your team wins the game!"
          : "The opponents win the game.";
    } else {
      this.state.phase = "HAND_OVER";
      const delta = result.teams[0].total;
      this.state.message = `Hand over — your team ${delta >= 0 ? "+" : ""}${delta}, opponents ${result.teams[1].total >= 0 ? "+" : ""}${result.teams[1].total}.`;
    }
  }

  nextHand(): void {
    if (this.state.phase !== "HAND_OVER") return;
    this.state.dealer = nextPlayer(this.state.dealer);
    this.deal();
  }

  // ── Bot driving ──────────────────────────────────────────────────────────

  isBotBidTurn(): boolean {
    return (
      this.state.phase === "BIDDING" &&
      (this.state.bidTurn !== 0 || this.autoPilot)
    );
  }

  /** Bid for the current bot (or seat 0 on autopilot). Returns the bid made. */
  botBid(): Bid | null {
    if (!this.isBotBidTurn()) return null;
    const player = this.state.bidTurn;
    const bid = botBid(this.state.hands[player]!);
    this.placeBid(player, bid);
    return bid;
  }

  isBotPlayTurn(): boolean {
    return (
      this.state.phase === "PLAYING" &&
      (this.state.currentTurn !== 0 || this.autoPilot)
    );
  }

  /** Play for the current bot (or seat 0 on autopilot). Returns the card. */
  botPlay(): PlayingCard | null {
    if (!this.isBotPlayTurn()) return null;
    const player = this.state.currentTurn;
    const card = botPlay({
      player,
      hand: this.state.hands[player]!,
      trick: this.state.currentTrick!,
      spadesBroken: this.state.spadesBroken,
      bids: this.state.bids,
      tricksByPlayer: this.state.tricksByPlayer,
    });
    this.playCard(player, card);
    return card;
  }

  // ── Display helpers ──────────────────────────────────────────────────────

  label(player: PlayerIndex): string {
    return LABELS[player];
  }
}

/** Sort for display: spades first, then hearts/clubs/diamonds, high→low. */
function sortHand(hand: PlayingCard[]): void {
  hand.sort(
    (a, b) =>
      SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) ||
      spadesRank(b) - spadesRank(a),
  );
}
