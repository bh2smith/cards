import type { PlayingCard } from "typedeck";
import type { Player } from "../../shared/types";
import {
  cardKey,
  createDeck,
  randomSeed,
  seededRng,
  shuffle,
} from "../../shared/deck";
import {
  deadwoodValue,
  findBestMelds,
  type Meld,
} from "../../shared/engine/melds";
import { resolvePreset } from "../../shared/engine/variant";
import {
  botChooseDiscard,
  botChooseDraw,
  botShouldKnock,
  layOffTargets,
} from "./ai";
import { RUMMY_FAMILY, type RummyConfig } from "./config";
import {
  UNDERCUT_BONUS,
  bestMeldContaining,
  canUseCard,
  classifyMeld,
  extendMeld,
  handCardValue,
  handValue,
  meldCardValue,
} from "./rules";
import { otherPlayer, sortHand, type RummyState } from "./types";

export interface BotTurnSummary {
  drewFrom: "stock" | "discard";
  tookCount: number;
  discardedCard: PlayingCard | null;
  knocked: boolean;
  wentOut: boolean;
}

export class RummyGame {
  private state: RummyState;
  private readonly cfg: RummyConfig;
  private readonly rng: () => number;
  /** Test hook: when true, botTurn also drives the human seat. */
  autoPilot = false;

  constructor(presetId?: string, seed?: number) {
    this.cfg = resolvePreset(RUMMY_FAMILY, presetId);
    this.rng = seededRng(seed ?? randomSeed());
    this.state = this.initialState();
    this.deal();
  }

  getState(): Readonly<RummyState> {
    return this.state;
  }

  getConfig(): Readonly<RummyConfig> {
    return this.cfg;
  }

  private initialState(): RummyState {
    return {
      phase: "PLAYER_TURN",
      playerScore: 0,
      computerScore: 0,
      dealer: "computer",
      currentTurn: "player",
      playerHand: [],
      computerHand: [],
      stock: [],
      discardPile: [],
      tableMelds: [],
      meldPoints: { player: 0, computer: 0 },
      pickups: { player: [], computer: [] },
      mustMeld: null,
      reshuffles: 0,
      roundWinner: null,
      roundPoints: 0,
      roundDeltas: null,
      knockResult: null,
      message: "",
      winner: null,
    };
  }

  deal(): void {
    const h = this.cfg.handSize;
    const deck = shuffle(createDeck(), this.rng);
    const playerHand = deck.slice(0, h);
    const computerHand = deck.slice(h, 2 * h);
    const upcard = deck[2 * h]!;
    const stock = deck.slice(2 * h + 1);
    sortHand(playerHand);
    sortHand(computerHand);
    const nonDealer = otherPlayer(this.state.dealer);

    this.state = {
      ...this.state,
      phase: nonDealer === "computer" ? "BOT_TURN" : "PLAYER_TURN",
      currentTurn: nonDealer,
      playerHand,
      computerHand,
      stock,
      discardPile: [upcard],
      tableMelds: [],
      meldPoints: { player: 0, computer: 0 },
      pickups: { player: [], computer: [] },
      mustMeld: null,
      reshuffles: 0,
      roundWinner: null,
      roundPoints: 0,
      roundDeltas: null,
      knockResult: null,
      message:
        nonDealer === "player"
          ? "Your turn. Draw from the stock or the discard pile."
          : "Computer's turn…",
      winner: this.state.winner,
    };
  }

  // ── Human actions ──────────────────────────────────────────────────────

  playerDrawFromStock(): boolean {
    if (!this.isPlayerPhase("PLAYER_TURN")) return false;
    return this.drawStockFor("player");
  }

  playerDrawFromDiscard(depth?: number): boolean {
    if (!this.isPlayerPhase("PLAYER_TURN")) return false;
    return this.drawDiscardFor("player", depth);
  }

  playerMeld(indices: number[]): boolean {
    if (!this.isPlayerPhase("PLAYER_MELD")) return false;
    return this.meldFor("player", indices);
  }

  playerLayOff(handIndex: number, meldIndex: number): boolean {
    if (!this.isPlayerPhase("PLAYER_MELD")) return false;
    return this.layOffFor("player", handIndex, meldIndex);
  }

  playerDiscard(index: number): boolean {
    if (!this.isPlayerPhase("PLAYER_MELD")) return false;
    return this.discardFor("player", index);
  }

  playerKnock(discardIndex: number): boolean {
    if (!this.cfg.knock || !this.isPlayerPhase("PLAYER_MELD")) return false;
    return this.knockFor("player", discardIndex);
  }

  playerGoRummy(discardIndex: number | null): boolean {
    if (!this.cfg.mustGoRummy || !this.isPlayerPhase("PLAYER_MELD"))
      return false;
    return this.goRummyFor("player", discardIndex);
  }

  nextRound(): void {
    if (this.state.phase !== "ROUND_OVER") return;
    this.state.dealer = otherPlayer(this.state.dealer);
    this.deal();
  }

  newGame(): void {
    const dealer = this.state.dealer;
    this.state = this.initialState();
    this.state.dealer = otherPlayer(dealer);
    this.deal();
  }

  // ── UI helpers ─────────────────────────────────────────────────────────

  isValidMeldSelection(indices: number[]): boolean {
    if (!this.cfg.meldsOnTable) return false;
    const hand = this.state.playerHand;
    if (indices.some((i) => i < 0 || i >= hand.length)) return false;
    return (
      classifyMeld(
        indices.map((i) => hand[i]!),
        this.cfg.runOptions,
      ) !== null
    );
  }

  layOffTargetsFor(handIndex: number): number[] {
    const card = this.state.playerHand[handIndex];
    if (!card) return [];
    return layOffTargets(card, this.state.tableMelds, this.cfg);
  }

  /** Whether the buried pickup still must be melded before discarding. */
  discardBlocked(): boolean {
    return this.mustMeldBlocked("player");
  }

  canPlayerKnock(): boolean {
    return this.cfg.knock !== null && this.isPlayerPhase("PLAYER_MELD");
  }

  canPlayerGoRummy(): boolean {
    if (!this.cfg.mustGoRummy || !this.isPlayerPhase("PLAYER_MELD"))
      return false;
    const hand = this.state.playerHand;
    if (this.fullHandMelds(hand)) return true;
    return hand.some(
      (_, i) => this.fullHandMelds(hand.filter((__, j) => j !== i)) !== null,
    );
  }

  // ── Bot turn ───────────────────────────────────────────────────────────

  botTurn(): BotTurnSummary {
    const s = this.state;
    let seat: Player;
    if (s.phase === "BOT_TURN") seat = "computer";
    else if (this.autoPilot && s.phase === "PLAYER_TURN") seat = "player";
    else throw new Error("Not bot's turn");

    const hand = this.handOf(seat);
    const opp = otherPlayer(seat);
    const summary: BotTurnSummary = {
      drewFrom: "stock",
      tookCount: 1,
      discardedCard: null,
      knocked: false,
      wentOut: false,
    };

    const choice = botChooseDraw(hand, s.discardPile, this.cfg);
    const pileBefore = s.discardPile.length;
    if (
      choice.source === "discard" &&
      this.drawDiscardFor(seat, choice.depth)
    ) {
      summary.drewFrom = "discard";
      summary.tookCount = pileBefore - s.discardPile.length;
    } else {
      this.drawStockFor(seat);
    }
    if (this.roundEnded()) return summary;

    // A buried pickup must be melded before anything else.
    if (s.mustMeld) {
      const target = s.mustMeld;
      const meld = bestMeldContaining(hand, target, this.cfg);
      if (meld) {
        this.meldFor(seat, this.indicesOf(seat, meld.cards));
      } else {
        const idx = hand.findIndex((c) => cardKey(c) === cardKey(target));
        const targets = layOffTargets(target, s.tableMelds, this.cfg);
        if (idx >= 0 && targets.length > 0)
          this.layOffFor(seat, idx, targets[0]!);
      }
      if (this.roundEnded()) return this.finishSummary(summary, seat);
    }

    if (this.cfg.mustGoRummy) {
      if (this.goRummyFor(seat, null)) return this.finishSummary(summary, seat);
      for (let i = 0; i < hand.length; i++) {
        if (this.goRummyFor(seat, i)) return this.finishSummary(summary, seat);
      }
      const idx = botChooseDiscard(hand, this.cfg, s.pickups[opp]);
      summary.discardedCard = hand[idx] ?? null;
      this.discardFor(seat, idx);
      return this.finishSummary(summary, seat);
    }

    if (this.cfg.knock) {
      const idx = botChooseDiscard(hand, this.cfg, s.pickups[opp]);
      const value = (c: PlayingCard) => handCardValue(c, this.cfg);
      const remaining = hand.filter((_, j) => j !== idx);
      const dw = deadwoodValue(
        findBestMelds(remaining, value, this.cfg.runOptions).deadwood,
        value,
      );
      summary.discardedCard = hand[idx] ?? null;
      if (botShouldKnock(dw)) {
        this.knockFor(seat, idx);
        summary.knocked = true;
      } else {
        this.discardFor(seat, idx);
      }
      return this.finishSummary(summary, seat);
    }

    if (this.cfg.meldsOnTable) {
      const value = (c: PlayingCard) => handCardValue(c, this.cfg);
      const { melds } = findBestMelds([...hand], value, this.cfg.runOptions);
      for (const meld of melds) {
        if (this.roundEnded()) break;
        this.meldFor(seat, this.indicesOf(seat, meld.cards));
      }
      if (this.cfg.layOffAllowed) {
        let extended = true;
        while (extended && !this.roundEnded()) {
          extended = false;
          for (let i = 0; i < hand.length; i++) {
            const targets = layOffTargets(hand[i]!, s.tableMelds, this.cfg);
            if (targets.length > 0) {
              this.layOffFor(seat, i, targets[0]!);
              extended = true;
              break;
            }
          }
        }
      }
      if (this.roundEnded()) return this.finishSummary(summary, seat);
    }

    if (hand.length > 0) {
      const idx = botChooseDiscard(hand, this.cfg, s.pickups[opp]);
      summary.discardedCard = hand[idx] ?? null;
      this.discardFor(seat, idx);
    }
    return this.finishSummary(summary, seat);
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private isPlayerPhase(phase: RummyState["phase"]): boolean {
    return this.state.phase === phase && this.state.currentTurn === "player";
  }

  private handOf(seat: Player): PlayingCard[] {
    return seat === "player" ? this.state.playerHand : this.state.computerHand;
  }

  private roundEnded(): boolean {
    return (
      this.state.phase === "ROUND_OVER" || this.state.phase === "GAME_OVER"
    );
  }

  private finishSummary(summary: BotTurnSummary, seat: Player): BotTurnSummary {
    summary.wentOut = this.roundEnded() && this.handOf(seat).length === 0;
    return summary;
  }

  private indicesOf(seat: Player, cards: PlayingCard[]): number[] {
    const hand = this.handOf(seat);
    return cards.map((c) => hand.findIndex((h) => cardKey(h) === cardKey(c)));
  }

  /** Pop a stock card, rebuilding the stock from the discard pile once. */
  private popStock(): PlayingCard | null {
    const s = this.state;
    if (s.stock.length === 0) {
      if (s.reshuffles >= 1 || s.discardPile.length <= 1) return null;
      const top = s.discardPile.pop()!;
      s.stock = shuffle(s.discardPile, this.rng);
      s.discardPile = [top];
      s.reshuffles++;
    }
    return s.stock.pop() ?? null;
  }

  private drawStockFor(seat: Player): boolean {
    const card = this.popStock();
    if (!card) {
      this.settleExhausted();
      return true;
    }
    const hand = this.handOf(seat);
    hand.push(card);
    sortHand(hand);
    this.enterMeldPhase(seat);
    return true;
  }

  private drawDiscardFor(seat: Player, depth?: number): boolean {
    const s = this.state;
    const pile = s.discardPile;
    if (pile.length === 0) return false;
    const top = pile.length - 1;
    const at = depth ?? top;
    if (at < 0 || at > top) return false;
    if (at !== top && this.cfg.discardPickup !== "any") return false;

    const hand = this.handOf(seat);
    if (at !== top) {
      // Buried pickup: the chosen card must be usable in a meld right away,
      // and every card above it comes along.
      const taken = pile.slice(at);
      if (!canUseCard(taken[0]!, [...hand, ...taken], s.tableMelds, this.cfg))
        return false;
      pile.splice(at);
      hand.push(...taken);
      s.mustMeld = taken[0]!;
      s.pickups[seat].push(taken[0]!);
    } else {
      const card = pile.pop()!;
      hand.push(card);
      s.pickups[seat].push(card);
      if (this.cfg.boathouseDoubleDraw) {
        const second = this.popStock();
        if (!second) {
          this.settleExhausted();
          return true;
        }
        hand.push(second);
      }
    }
    sortHand(hand);
    this.enterMeldPhase(seat);
    return true;
  }

  private enterMeldPhase(seat: Player): void {
    if (seat !== "player") return; // the bot's whole turn stays BOT_TURN
    this.state.phase = "PLAYER_MELD";
    if (this.cfg.mustGoRummy) {
      this.state.message = "Discard — or go rummy if your whole hand melds.";
    } else if (this.cfg.knock) {
      this.state.message = "Discard a card, or knock.";
    } else {
      this.state.message = "Meld, lay off, or discard.";
    }
  }

  private meldFor(seat: Player, indices: number[]): boolean {
    if (!this.cfg.meldsOnTable) return false;
    const hand = this.handOf(seat);
    const unique = [...new Set(indices)];
    if (unique.length !== indices.length) return false;
    if (unique.some((i) => i < 0 || i >= hand.length)) return false;
    const meld = classifyMeld(
      unique.map((i) => hand[i]!),
      this.cfg.runOptions,
    );
    if (!meld) return false;

    const keys = new Set(meld.cards.map(cardKey));
    for (let i = hand.length - 1; i >= 0; i--) {
      if (keys.has(cardKey(hand[i]!))) hand.splice(i, 1);
    }
    this.state.tableMelds.push({
      owner: seat,
      type: meld.type,
      cards: meld.cards,
    });
    if (this.cfg.scoring === "points-500") {
      this.state.meldPoints[seat] += meld.cards.reduce(
        (sum, c) => sum + meldCardValue(c, meld, this.cfg),
        0,
      );
    }
    this.clearMustMeld(keys);
    if (hand.length === 0) this.goOut(seat);
    return true;
  }

  private layOffFor(
    seat: Player,
    handIndex: number,
    meldIndex: number,
  ): boolean {
    if (!this.cfg.meldsOnTable || !this.cfg.layOffAllowed) return false;
    const hand = this.handOf(seat);
    const card = hand[handIndex];
    const meld = this.state.tableMelds[meldIndex];
    if (!card || !meld) return false;
    const extended = extendMeld(meld, card, this.cfg.runOptions);
    if (!extended) return false;

    hand.splice(handIndex, 1);
    meld.cards = extended.cards;
    if (this.cfg.scoring === "points-500") {
      this.state.meldPoints[seat] += meldCardValue(card, extended, this.cfg);
    }
    this.clearMustMeld(new Set([cardKey(card)]));
    if (hand.length === 0) this.goOut(seat);
    return true;
  }

  private discardFor(seat: Player, index: number): boolean {
    const hand = this.handOf(seat);
    if (index < 0 || index >= hand.length) return false;
    if (this.mustMeldBlocked(seat)) return false;
    const card = hand.splice(index, 1)[0]!;
    this.state.discardPile.push(card);
    if (hand.length === 0) {
      this.goOut(seat);
      return true;
    }
    this.endTurn(seat);
    return true;
  }

  private knockFor(seat: Player, discardIndex: number): boolean {
    const knockCfg = this.cfg.knock;
    if (!knockCfg) return false;
    const hand = this.handOf(seat);
    if (discardIndex < 0 || discardIndex >= hand.length) return false;
    const value = (c: PlayingCard) => handCardValue(c, this.cfg);
    const remaining = hand.filter((_, j) => j !== discardIndex);
    const { deadwood } = findBestMelds(remaining, value, this.cfg.runOptions);
    if (deadwoodValue(deadwood, value) > knockCfg.threshold) return false;

    this.state.discardPile.push(hand.splice(discardIndex, 1)[0]!);
    this.resolveKnock(seat);
    return true;
  }

  private goRummyFor(seat: Player, discardIndex: number | null): boolean {
    const hand = this.handOf(seat);
    let candidate = hand;
    if (discardIndex !== null) {
      if (discardIndex < 0 || discardIndex >= hand.length) return false;
      candidate = hand.filter((_, j) => j !== discardIndex);
    }
    const melds = this.fullHandMelds(candidate);
    if (!melds) return false;

    if (discardIndex !== null) {
      this.state.discardPile.push(hand[discardIndex]!);
    }
    for (const m of melds) {
      this.state.tableMelds.push({ owner: seat, type: m.type, cards: m.cards });
    }
    hand.length = 0;
    this.goOut(seat);
    return true;
  }

  private fullHandMelds(cards: PlayingCard[]): Meld[] | null {
    if (cards.length === 0) return null;
    const value = (c: PlayingCard) => handCardValue(c, this.cfg);
    const res = findBestMelds([...cards], value, this.cfg.runOptions);
    return res.deadwood.length === 0 ? res.melds : null;
  }

  private mustMeldBlocked(seat: Player): boolean {
    const s = this.state;
    if (!s.mustMeld) return false;
    const hand = this.handOf(seat);
    const key = cardKey(s.mustMeld);
    if (!hand.some((c) => cardKey(c) === key)) {
      s.mustMeld = null;
      return false;
    }
    // Enforce only while the card is actually still usable — never soft-lock.
    return canUseCard(s.mustMeld, hand, s.tableMelds, this.cfg);
  }

  private clearMustMeld(usedKeys: Set<string>): void {
    const s = this.state;
    if (s.mustMeld && usedKeys.has(cardKey(s.mustMeld))) s.mustMeld = null;
  }

  private endTurn(seat: Player): void {
    const next = otherPlayer(seat);
    this.state.currentTurn = next;
    this.state.phase = next === "computer" ? "BOT_TURN" : "PLAYER_TURN";
    this.state.message =
      next === "player"
        ? "Your turn. Draw from the stock or the discard pile."
        : "Computer's turn…";
  }

  // ── Settlement ─────────────────────────────────────────────────────────

  private goOut(seat: Player): void {
    if (this.cfg.scoring === "points-500") {
      this.settle500(seat);
      return;
    }
    // "shed": the winner collects the pip value of the opponent's hand.
    const opp = otherPlayer(seat);
    const points = handValue(this.handOf(opp), this.cfg);
    const deltas: Record<Player, number> = { player: 0, computer: 0 };
    deltas[seat] = points;
    this.applyRound(
      seat,
      deltas,
      `${seat === "player" ? "You go" : "Computer goes"} out! +${points} points.`,
    );
  }

  private resolveKnock(knocker: Player): void {
    const value = (c: PlayingCard) => handCardValue(c, this.cfg);
    const defender = otherPlayer(knocker);
    const kRes = findBestMelds(
      this.handOf(knocker),
      value,
      this.cfg.runOptions,
    );
    const dRes = findBestMelds(
      this.handOf(defender),
      value,
      this.cfg.runOptions,
    );
    const kDw = deadwoodValue(kRes.deadwood, value);
    const dDw = deadwoodValue(dRes.deadwood, value);
    const isUndercut = kDw > 0 && dDw <= kDw;
    const pointsTo = isUndercut ? defender : knocker;
    const roundPoints = isUndercut ? kDw - dDw + UNDERCUT_BONUS : dDw - kDw;

    this.state.knockResult = {
      knocker,
      knockerMelds: kRes.melds,
      knockerDeadwoodValue: kDw,
      defenderMelds: dRes.melds,
      defenderDeadwoodValue: dDw,
      isUndercut,
      roundPoints,
      pointsTo,
    };
    const deltas: Record<Player, number> = { player: 0, computer: 0 };
    deltas[pointsTo] = roundPoints;
    const message = isUndercut
      ? `Undercut! ${pointsTo === "player" ? "You take" : "Computer takes"} ${roundPoints} points.`
      : `${knocker === "player" ? "You knock" : "Computer knocks"} with ${kDw} against ${dDw}. +${roundPoints}.`;
    this.applyRound(pointsTo, deltas, message);
  }

  private settle500(wentOut: Player | null): void {
    const s = this.state;
    const deltas: Record<Player, number> = {
      player: s.meldPoints.player - handValue(s.playerHand, this.cfg),
      computer: s.meldPoints.computer - handValue(s.computerHand, this.cfg),
    };
    let winner: Player | null = wentOut;
    if (deltas.player > deltas.computer) winner = "player";
    else if (deltas.computer > deltas.player) winner = "computer";

    const lead = wentOut
      ? `${wentOut === "player" ? "You go" : "Computer goes"} out.`
      : "Stock exhausted.";
    const fmt = (n: number) => (n >= 0 ? `+${n}` : String(n));
    this.applyRound(
      winner,
      deltas,
      `${lead} You ${fmt(deltas.player)}, computer ${fmt(deltas.computer)}.`,
    );
  }

  private settleExhausted(): void {
    const s = this.state;
    if (this.cfg.scoring === "points-500") {
      this.settle500(null);
      return;
    }
    const value = (c: PlayingCard) => handCardValue(c, this.cfg);
    let pv: number;
    let cv: number;
    if (this.cfg.scoring === "deadwood-diff") {
      pv = deadwoodValue(
        findBestMelds([...s.playerHand], value, this.cfg.runOptions).deadwood,
        value,
      );
      cv = deadwoodValue(
        findBestMelds([...s.computerHand], value, this.cfg.runOptions).deadwood,
        value,
      );
    } else {
      pv = handValue(s.playerHand, this.cfg);
      cv = handValue(s.computerHand, this.cfg);
    }
    const deltas: Record<Player, number> = { player: 0, computer: 0 };
    let winner: Player | null = null;
    if (pv < cv) {
      winner = "player";
      deltas.player = cv - pv;
    } else if (cv < pv) {
      winner = "computer";
      deltas.computer = pv - cv;
    }
    this.applyRound(
      winner,
      deltas,
      winner === null
        ? "Stock exhausted — dead heat, no points."
        : `Stock exhausted — ${winner === "player" ? "your" : "computer's"} count is lower. +${deltas[winner]}.`,
    );
  }

  private applyRound(
    winner: Player | null,
    deltas: Record<Player, number>,
    message: string,
  ): void {
    const s = this.state;
    s.roundWinner = winner;
    s.roundDeltas = deltas;
    s.roundPoints = winner ? deltas[winner] : 0;
    s.playerScore += deltas.player;
    s.computerScore += deltas.computer;
    s.mustMeld = null;

    const target = this.cfg.targetScore;
    if (s.playerScore >= target || s.computerScore >= target) {
      s.phase = "GAME_OVER";
      s.winner = s.playerScore >= s.computerScore ? "player" : "computer";
      s.message = `${message} ${s.winner === "player" ? "You win" : "Computer wins"} the game!`;
    } else {
      s.phase = "ROUND_OVER";
      s.message = message;
    }
  }
}
