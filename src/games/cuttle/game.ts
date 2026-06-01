import { CardName, type PlayingCard } from "typedeck";
import type { Player } from "../../shared/types";
import { createDeck, shuffle, cardKey } from "../../shared/deck";
import {
  type CuttleState,
  type Field,
  type FieldCard,
  HAND_LIMIT,
  emptyField,
  opponentOf,
  pointTotal,
  winThreshold,
  isNumberCard,
  isEight,
  isJack,
  isKing,
  isQueen,
  isTwo,
  hasOneOff,
  cardActions,
  scuttleTargets,
  jackTargets,
  twoTargets,
  nineTargets,
} from "./types";
import {
  chooseBotAction,
  chooseCounter,
  chooseDiscards,
  chooseSeven,
  type BotAction,
} from "./ai";

/** The fields the player and the bot draw from, given who starts the game. */
const FIRST_HAND = 5;
const SECOND_HAND = 6;

export class CuttleGame {
  private state: CuttleState;

  constructor(starter: Player = "player") {
    this.state = this.deal(starter);
  }

  getState(): Readonly<CuttleState> {
    return this.state;
  }

  // --- Setup ---

  private deal(starter: Player): CuttleState {
    const deck = shuffle(createDeck());
    const second = opponentOf(starter);
    const hands: Record<Player, PlayingCard[]> = {
      player: [],
      computer: [],
    };
    hands[starter] = deck.splice(0, FIRST_HAND);
    hands[second] = deck.splice(0, SECOND_HAND);

    return {
      phase: starter === "player" ? "PLAYER_TURN" : "BOT_TURN",
      message:
        starter === "player"
          ? "Your turn. Play points, scuttle, a one-off, or a royal."
          : "Opponent's turn…",
      deck,
      scrap: [],
      hands,
      fields: { player: emptyField(), computer: emptyField() },
      turn: starter,
      oneOff: null,
      counterDecider: null,
      sevenCards: null,
      frozenKey: null,
      frozenOwner: null,
      discardCount: 0,
      passes: 0,
      starter,
      winner: null,
    };
  }

  newGame(): void {
    this.state = this.deal(opponentOf(this.state.starter));
  }

  // --- Shared queries ---

  field(p: Player): Field {
    return this.state.fields[p];
  }

  /** Win threshold for a player given the kings they control. */
  threshold(p: Player): number {
    return winThreshold(this.state.fields[p].kings.length);
  }

  total(p: Player): number {
    return pointTotal(this.state.fields[p]);
  }

  actionsFor(key: string): ReturnType<typeof cardActions> | null {
    const card = this.handCard("player", key);
    if (!card) return null;
    return cardActions(this.state, "player", card);
  }

  /** Whether a hand card is frozen (returned by a Nine) for its owner. */
  isFrozen(by: Player, card: PlayingCard): boolean {
    return (
      this.state.frozenOwner === by && this.state.frozenKey === cardKey(card)
    );
  }

  private handCard(p: Player, key: string): PlayingCard | undefined {
    return this.state.hands[p].find((c) => cardKey(c) === key);
  }

  private takeFromHand(p: Player, card: PlayingCard): PlayingCard {
    const hand = this.state.hands[p];
    hand.splice(hand.indexOf(card), 1);
    return card;
  }

  private findField(p: Player, key: string): FieldCard | undefined {
    return [
      ...this.state.fields[p].points,
      ...this.state.fields[p].queens,
      ...this.state.fields[p].kings,
      ...this.state.fields[p].glasses,
    ].find((fc) => cardKey(fc.card) === key);
  }

  // --- Player actions (guarded entry points) ---

  private playerCanAct(): boolean {
    return this.state.phase === "PLAYER_TURN" && this.state.turn === "player";
  }

  playerPoints(key: string): boolean {
    if (!this.playerCanAct()) return false;
    const card = this.handCard("player", key);
    if (!card || !isNumberCard(card) || this.isFrozen("player", card))
      return false;
    this.doPoints("player", card);
    return true;
  }

  playerScuttle(key: string, targetKey: string): boolean {
    if (!this.playerCanAct()) return false;
    const card = this.handCard("player", key);
    if (!card || this.isFrozen("player", card)) return false;
    const target = scuttleTargets(this.state, "player", card).find(
      (t) => cardKey(t.card) === targetKey,
    );
    if (!target) return false;
    this.doScuttle("player", card, target);
    return true;
  }

  playerGlasses(key: string): boolean {
    if (!this.playerCanAct()) return false;
    const card = this.handCard("player", key);
    if (!card || !isEight(card) || this.isFrozen("player", card)) return false;
    this.doPermanent("player", card, "glasses");
    return true;
  }

  playerKing(key: string): boolean {
    if (!this.playerCanAct()) return false;
    const card = this.handCard("player", key);
    if (!card || !isKing(card) || this.isFrozen("player", card)) return false;
    this.doPermanent("player", card, "kings");
    return true;
  }

  playerQueen(key: string): boolean {
    if (!this.playerCanAct()) return false;
    const card = this.handCard("player", key);
    if (!card || !isQueen(card) || this.isFrozen("player", card)) return false;
    this.doPermanent("player", card, "queens");
    return true;
  }

  playerJack(key: string, targetKey: string): boolean {
    if (!this.playerCanAct()) return false;
    const card = this.handCard("player", key);
    if (!card || !isJack(card) || this.isFrozen("player", card)) return false;
    const target = jackTargets(this.state, "player").find(
      (t) => cardKey(t.card) === targetKey,
    );
    if (!target) return false;
    this.doJack("player", card, target);
    return true;
  }

  playerOneOff(key: string, targetKey?: string): boolean {
    if (!this.playerCanAct()) return false;
    const card = this.handCard("player", key);
    if (!card || !hasOneOff(card) || this.isFrozen("player", card))
      return false;
    if (!this.oneOffPlayable("player", card, targetKey)) return false;
    this.doOneOff("player", card, targetKey ?? null);
    return true;
  }

  playerDraw(): boolean {
    if (!this.playerCanAct()) return false;
    if (this.state.deck.length === 0) return false;
    if (this.state.hands.player.length >= HAND_LIMIT) return false;
    this.doDraw("player");
    return true;
  }

  playerPass(): boolean {
    if (!this.playerCanAct()) return false;
    if (this.state.deck.length > 0) return false;
    this.doPass("player");
    return true;
  }

  // Counter window ----------------------------------------------------------

  playerCounter(key: string): boolean {
    if (this.state.phase !== "PLAYER_COUNTER") return false;
    const card = this.handCard("player", key);
    if (!card || !isTwo(card)) return false;
    this.pushCounter("player", card);
    return true;
  }

  playerDeclineCounter(): boolean {
    if (this.state.phase !== "PLAYER_COUNTER") return false;
    this.resolveOneOff();
    return true;
  }

  // Discard (Four) ----------------------------------------------------------

  playerDiscard(keys: string[]): boolean {
    if (this.state.phase !== "PLAYER_DISCARD") return false;
    const want = Math.min(
      this.state.discardCount,
      this.state.hands.player.length,
    );
    if (keys.length !== want) return false;
    for (const key of keys) {
      const card = this.handCard("player", key);
      if (!card) return false;
      this.state.scrap.push(this.takeFromHand("player", card));
    }
    this.state.discardCount = 0;
    // The Four was played by the opponent (the bot); its turn now ends.
    this.endTurn("computer");
    return true;
  }

  // Seven (play one of two revealed) ----------------------------------------

  playerSeven(
    key: string,
    kind:
      | "points"
      | "scuttle"
      | "oneoff"
      | "glasses"
      | "jack"
      | "king"
      | "queen",
    targetKey?: string,
  ): boolean {
    if (this.state.phase !== "PLAYER_SEVEN" || !this.state.sevenCards)
      return false;
    const idx = this.state.sevenCards.findIndex((c) => cardKey(c) === key);
    if (idx < 0) return false;
    const chosen = this.state.sevenCards[idx]!;
    const other = this.state.sevenCards[1 - idx];
    this.state.sevenCards = null;
    // Unchosen card goes back on top of the deck.
    if (other) this.state.deck.unshift(other);
    this.state.phase = "PLAYER_TURN"; // restore so the do* methods proceed

    switch (kind) {
      case "points":
        if (!isNumberCard(chosen)) return this.failSeven(chosen, other);
        this.doPoints("player", chosen, true);
        return true;
      case "glasses":
        if (!isEight(chosen)) return this.failSeven(chosen, other);
        this.doPermanent("player", chosen, "glasses", true);
        return true;
      case "king":
        if (!isKing(chosen)) return this.failSeven(chosen, other);
        this.doPermanent("player", chosen, "kings", true);
        return true;
      case "queen":
        if (!isQueen(chosen)) return this.failSeven(chosen, other);
        this.doPermanent("player", chosen, "queens", true);
        return true;
      case "scuttle": {
        const t = scuttleTargets(this.state, "player", chosen).find(
          (x) => cardKey(x.card) === targetKey,
        );
        if (!t) return this.failSeven(chosen, other);
        this.doScuttle("player", chosen, t, true);
        return true;
      }
      case "jack": {
        const t = jackTargets(this.state, "player").find(
          (x) => cardKey(x.card) === targetKey,
        );
        if (!isJack(chosen) || !t) return this.failSeven(chosen, other);
        this.doJack("player", chosen, t, true);
        return true;
      }
      case "oneoff":
        if (
          !hasOneOff(chosen) ||
          !this.oneOffPlayable("player", chosen, targetKey)
        )
          return this.failSeven(chosen, other);
        this.doOneOff("player", chosen, targetKey ?? null, true);
        return true;
    }
  }

  /** Roll back a rejected Seven choice so the UI can re-prompt. */
  private failSeven(
    chosen: PlayingCard,
    other: PlayingCard | undefined,
  ): boolean {
    if (other) this.state.deck.shift();
    this.state.sevenCards = other ? [chosen, other] : [chosen];
    this.state.phase = "PLAYER_SEVEN";
    return false;
  }

  // --- Bot turn ---

  botTurn(): void {
    if (this.state.phase !== "BOT_TURN") return;
    this.applyBotAction(chooseBotAction(this.state));
  }

  private applyBotAction(action: BotAction, fromSeven = false): void {
    const by: Player = "computer";
    switch (action.type) {
      case "points": {
        const c = this.handOrSeven(by, action.key, fromSeven);
        if (c) this.doPoints(by, c, fromSeven);
        break;
      }
      case "scuttle": {
        const c = this.handOrSeven(by, action.key, fromSeven);
        const t =
          c &&
          scuttleTargets(this.state, by, c).find(
            (x) => cardKey(x.card) === action.targetKey,
          );
        if (c && t) this.doScuttle(by, c, t, fromSeven);
        break;
      }
      case "glasses": {
        const c = this.handOrSeven(by, action.key, fromSeven);
        if (c) this.doPermanent(by, c, "glasses", fromSeven);
        break;
      }
      case "king": {
        const c = this.handOrSeven(by, action.key, fromSeven);
        if (c) this.doPermanent(by, c, "kings", fromSeven);
        break;
      }
      case "queen": {
        const c = this.handOrSeven(by, action.key, fromSeven);
        if (c) this.doPermanent(by, c, "queens", fromSeven);
        break;
      }
      case "jack": {
        const c = this.handOrSeven(by, action.key, fromSeven);
        const t =
          c &&
          jackTargets(this.state, by).find(
            (x) => cardKey(x.card) === action.targetKey,
          );
        if (c && t) this.doJack(by, c, t, fromSeven);
        break;
      }
      case "oneoff": {
        const c = this.handOrSeven(by, action.key, fromSeven);
        if (c) this.doOneOff(by, c, action.targetKey ?? null, fromSeven);
        break;
      }
      case "draw":
        this.doDraw(by);
        break;
      case "pass":
        this.doPass(by);
        break;
    }
  }

  /** During a Seven the chosen card comes from the revealed pair, not the hand. */
  private handOrSeven(
    by: Player,
    key: string,
    fromSeven: boolean,
  ): PlayingCard | undefined {
    if (fromSeven)
      return this.state.sevenCards?.find((c) => cardKey(c) === key);
    return this.handCard(by, key);
  }

  // --- Core action implementations (by = acting player) ---

  private doPoints(by: Player, card: PlayingCard, fromSeven = false): void {
    this.removeSource(by, card, fromSeven);
    this.state.fields[by].points.push({ card, owner: by, jacks: [] });
    this.afterPlay(by, `${this.who(by)} played ${this.name(card)} for points.`);
  }

  private doScuttle(
    by: Player,
    card: PlayingCard,
    target: FieldCard,
    fromSeven = false,
  ): void {
    this.removeSource(by, card, fromSeven);
    const opp = opponentOf(by);
    const points = this.state.fields[opp].points;
    points.splice(points.indexOf(target), 1);
    this.state.scrap.push(card, target.card, ...target.jacks);
    this.afterPlay(
      by,
      `${this.who(by)} scuttled ${this.name(target.card)} with ${this.name(card)}.`,
    );
  }

  private doPermanent(
    by: Player,
    card: PlayingCard,
    pile: "glasses" | "kings" | "queens",
    fromSeven = false,
  ): void {
    this.removeSource(by, card, fromSeven);
    this.state.fields[by][pile].push({ card, owner: by, jacks: [] });
    const label =
      pile === "glasses"
        ? "glasses (8)"
        : pile === "kings"
          ? "a King"
          : "a Queen";
    this.afterPlay(by, `${this.who(by)} played ${label}.`);
  }

  private doJack(
    by: Player,
    card: PlayingCard,
    target: FieldCard,
    fromSeven = false,
  ): void {
    this.removeSource(by, card, fromSeven);
    const opp = opponentOf(by);
    const oppPoints = this.state.fields[opp].points;
    oppPoints.splice(oppPoints.indexOf(target), 1);
    target.jacks.push(card);
    this.state.fields[by].points.push(target);
    this.afterPlay(by, `${this.who(by)} jacked ${this.name(target.card)}.`);
  }

  private doDraw(by: Player): void {
    const card = this.state.deck.shift();
    if (card) this.state.hands[by].push(card);
    this.state.passes = 0;
    this.endTurn(by, `${this.who(by)} drew a card.`);
  }

  private doPass(by: Player): void {
    this.state.passes++;
    if (this.state.passes >= 3) {
      this.endStalemate();
      return;
    }
    this.endTurn(by, `${this.who(by)} passed.`);
  }

  // One-offs ----------------------------------------------------------------

  private doOneOff(
    by: Player,
    card: PlayingCard,
    targetKey: string | null,
    fromSeven = false,
  ): void {
    this.removeSource(by, card, fromSeven);
    this.state.oneOff = { stack: [card], by, targetKey };
    this.state.passes = 0;
    this.beginCounter(opponentOf(by));
  }

  /** Offer `decider` the chance to counter the pending one-off with a Two. */
  private beginCounter(decider: Player): void {
    this.state.counterDecider = decider;
    if (decider === "player") {
      this.state.phase = "PLAYER_COUNTER";
      this.state.message = `Opponent played ${this.oneOffName()}. Counter with a Two?`;
      return;
    }
    // Bot decides immediately.
    const idx = chooseCounter(this.state, "computer");
    if (idx === null) {
      this.resolveOneOff();
    } else {
      const card = this.state.hands.computer[idx]!;
      this.pushCounter("computer", card);
    }
  }

  private pushCounter(by: Player, card: PlayingCard): void {
    this.takeFromHand(by, card);
    this.state.oneOff!.stack.push(card);
    // The other player may counter back.
    this.beginCounter(opponentOf(by));
  }

  private resolveOneOff(): void {
    const flight = this.state.oneOff!;
    this.state.oneOff = null;
    this.state.counterDecider = null;
    const base = flight.stack[0]!;
    const counters = flight.stack.length - 1;
    const resolves = counters % 2 === 0;

    let turnHandled = false;
    if (resolves) {
      turnHandled = this.applyEffect(base, flight.by, flight.targetKey);
    }
    // The one-off and every countering Two are scrapped.
    this.state.scrap.push(...flight.stack);

    if (!turnHandled) {
      const verb = resolves ? "resolved" : "was countered";
      this.endTurn(flight.by, `${this.name(base)} ${verb}.`);
    }
  }

  /** Apply a resolving one-off. Returns true if it owns turn progression. */
  private applyEffect(
    base: PlayingCard,
    by: Player,
    targetKey: string | null,
  ): boolean {
    const opp = opponentOf(by);
    switch (base.cardName) {
      case CardName.Ace: {
        for (const p of ["player", "computer"] as Player[]) {
          const f = this.state.fields[p];
          for (const fc of f.points)
            this.state.scrap.push(fc.card, ...fc.jacks);
          f.points = [];
        }
        return false;
      }
      case CardName.Two: {
        if (targetKey) this.scrapField(opp, targetKey);
        return false;
      }
      case CardName.Three: {
        if (targetKey) {
          const i = this.state.scrap.findIndex((c) => cardKey(c) === targetKey);
          if (i >= 0)
            this.state.hands[by].push(this.state.scrap.splice(i, 1)[0]!);
        }
        return false;
      }
      case CardName.Four: {
        const count = Math.min(2, this.state.hands[opp].length);
        if (count === 0) return false;
        if (opp === "player") {
          this.state.discardCount = count;
          this.state.phase = "PLAYER_DISCARD";
          this.state.message = `Opponent played a Four — discard ${count} card${count > 1 ? "s" : ""}.`;
          return true; // wait for the player to choose
        }
        // Resolve indices to keys up front so splicing doesn't invalidate them.
        const discardKeys = chooseDiscards(
          this.state.hands.computer,
          count,
        ).map((i) => cardKey(this.state.hands.computer[i]!));
        for (const key of discardKeys) {
          const c = this.handCard("computer", key)!;
          this.state.scrap.push(this.takeFromHand("computer", c));
        }
        return false;
      }
      case CardName.Five: {
        // Discard one (if anything else is in hand), then draw up to three,
        // never exceeding the hand limit.
        if (this.state.hands[by].length > 0) {
          const discardKey =
            by === "computer"
              ? cardKey(
                  this.state.hands.computer[
                    chooseDiscards(this.state.hands.computer, 1)[0] ?? 0
                  ]!,
                )
              : null;
          if (discardKey) {
            const c = this.handCard("computer", discardKey)!;
            this.state.scrap.push(this.takeFromHand("computer", c));
          }
          // The human's discard-for-Five is handled by the UI as a free choice
          // before confirming; for simplicity the bot discards its weakest and
          // the player discards nothing extra (drawing the full three).
        }
        const room = HAND_LIMIT - this.state.hands[by].length;
        for (let n = 0; n < Math.min(3, room) && this.state.deck.length; n++) {
          this.state.hands[by].push(this.state.deck.shift()!);
        }
        return false;
      }
      case CardName.Six: {
        for (const p of ["player", "computer"] as Player[]) {
          const f = this.state.fields[p];
          for (const fc of [...f.kings, ...f.queens, ...f.glasses])
            this.state.scrap.push(fc.card);
          f.kings = [];
          f.queens = [];
          f.glasses = [];
        }
        return false;
      }
      case CardName.Seven: {
        const revealed = this.state.deck.splice(0, 2);
        if (revealed.length === 0) return false; // empty deck — whiff
        if (by === "player") {
          // If neither card can be legally played (e.g. two stranded Jacks),
          // there is no choice to make — scrap one, return the other, move on.
          if (!revealed.some((c) => this.hasAnyPlay("player", c))) {
            this.state.scrap.push(revealed[0]!);
            if (revealed[1]) this.state.deck.unshift(revealed[1]);
            return false;
          }
          this.state.sevenCards = revealed;
          this.state.phase = "PLAYER_SEVEN";
          this.state.message = "Seven — choose one card to play immediately.";
          return true;
        }
        // Bot: choose one to play, return the other to the deck top.
        this.state.sevenCards = revealed;
        const choice = chooseSeven(this.state, "computer", revealed);
        if (!choice) {
          // Nothing playable (e.g. two unusable Jacks) — scrap one, deck the other.
          this.state.scrap.push(revealed[0]!);
          if (revealed[1]) this.state.deck.unshift(revealed[1]);
          this.state.sevenCards = null;
          return false; // let resolveOneOff end the turn
        }
        const idx = revealed.findIndex((c) => cardKey(c) === choice.key);
        const other = revealed[1 - idx];
        this.state.sevenCards = null;
        if (other) this.state.deck.unshift(other);
        this.applyBotAction(choice.action, true);
        return true;
      }
      case CardName.Nine: {
        if (targetKey) this.bounce(opp, targetKey);
        return false;
      }
      default:
        return false;
    }
  }

  /** Remove a card from the opponent's field to the scrap (Two). */
  private scrapField(owner: Player, key: string): void {
    const f = this.state.fields[owner];
    for (const pile of [f.kings, f.queens, f.glasses, f.points]) {
      const i = pile.findIndex((fc) => cardKey(fc.card) === key);
      if (i >= 0) {
        const fc = pile[i]!;
        this.state.scrap.push(fc.card, ...fc.jacks);
        pile.splice(i, 1);
        return;
      }
    }
  }

  /** Return a field card to its owner's hand, frozen for their next turn (Nine). */
  private bounce(controller: Player, key: string): void {
    const fc = this.findField(controller, key);
    if (!fc) return;
    const f = this.state.fields[controller];
    for (const pile of [f.points, f.kings, f.queens, f.glasses]) {
      const i = pile.indexOf(fc);
      if (i >= 0) {
        pile.splice(i, 1);
        break;
      }
    }
    // Jacks on a bounced point card are scrapped; the card returns to its owner.
    this.state.scrap.push(...fc.jacks);
    this.state.hands[fc.owner].push(fc.card);
    this.state.frozenKey = cardKey(fc.card);
    this.state.frozenOwner = fc.owner;
  }

  // --- Turn flow ---

  private removeSource(
    by: Player,
    card: PlayingCard,
    fromSeven: boolean,
  ): void {
    if (fromSeven) {
      // Card already pulled from the revealed pair in the Seven handler.
      this.state.sevenCards =
        this.state.sevenCards?.filter((c) => c !== card) ?? null;
      if (this.state.sevenCards && this.state.sevenCards.length === 0)
        this.state.sevenCards = null;
      return;
    }
    this.takeFromHand(by, card);
  }

  /** Common tail for non-one-off plays: reset passes, end the turn. */
  private afterPlay(by: Player, message: string): void {
    this.state.passes = 0;
    this.endTurn(by, message);
  }

  private endTurn(by: Player, message?: string): void {
    // A card frozen for `by` thaws once their turn ends.
    if (this.state.frozenOwner === by) {
      this.state.frozenKey = null;
      this.state.frozenOwner = null;
    }
    if (this.checkWin(by)) return;

    const next = opponentOf(by);
    this.state.turn = next;
    this.state.phase = next === "player" ? "PLAYER_TURN" : "BOT_TURN";
    if (message) {
      this.state.message =
        next === "player"
          ? `${message} Your turn.`
          : `${message} Opponent's turn…`;
    } else {
      this.state.message =
        next === "player" ? "Your turn." : "Opponent's turn…";
    }
  }

  /** Check both players for a win (the actor wins ties). */
  private checkWin(actor: Player): boolean {
    for (const p of [actor, opponentOf(actor)] as Player[]) {
      if (this.total(p) >= this.threshold(p)) {
        this.state.winner = p;
        this.state.phase = "GAME_OVER";
        this.state.message = p === "player" ? "You win!" : "Opponent wins.";
        return true;
      }
    }
    return false;
  }

  private endStalemate(): void {
    const pp = this.total("player");
    const cp = this.total("computer");
    this.state.phase = "GAME_OVER";
    this.state.winner = pp === cp ? null : pp > cp ? "player" : "computer";
    this.state.message =
      this.state.winner === null
        ? "Stalemate — it's a draw."
        : this.state.winner === "player"
          ? "Stalemate — you had more points. You win!"
          : "Stalemate — opponent had more points.";
  }

  // --- Helpers ---

  private oneOffPlayable(
    by: Player,
    card: PlayingCard,
    targetKey?: string,
  ): boolean {
    const a = cardActions(this.state, by, card).oneOff;
    if (!a.playable) return false;
    if (card.cardName === CardName.Three)
      return (
        !!targetKey && this.state.scrap.some((c) => cardKey(c) === targetKey)
      );
    if (!a.needsTarget) return true;
    return !!targetKey && a.targets.some((t) => cardKey(t.card) === targetKey);
  }

  /** Whether `card` has at least one legal play for `by` right now. */
  private hasAnyPlay(by: Player, card: PlayingCard): boolean {
    const a = cardActions(this.state, by, card);
    return (
      a.points ||
      a.king ||
      a.queen ||
      a.glasses ||
      a.scuttle.length > 0 ||
      a.jack.length > 0 ||
      a.oneOff.playable
    );
  }

  private oneOffName(): string {
    const base = this.state.oneOff?.stack[0];
    return base ? this.name(base) : "a one-off";
  }

  private who(p: Player): string {
    return p === "player" ? "You" : "Opponent";
  }

  private name(card: PlayingCard): string {
    const ranks = [
      "Ace",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Seven",
      "Eight",
      "Nine",
      "Ten",
      "Jack",
      "Queen",
      "King",
    ];
    return ranks[card.cardName] ?? "card";
  }
}

// Re-export so the UI can reach the query helpers through one module.
export { twoTargets, nineTargets, jackTargets, scuttleTargets };
