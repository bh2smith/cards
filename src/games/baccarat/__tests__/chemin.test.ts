import { test, expect, beforeEach, describe } from "bun:test";
import { CardName, Suit, type PlayingCard } from "typedeck";
import { BaccaratGame } from "../game";
import { balance } from "../../../shared/engine/betting";
import { resetBankrollForTests } from "../../../shared/engine/bankroll";

function c(name: CardName, suit = Suit.Spades): PlayingCard {
  return { cardName: name, suit } as PlayingCard;
}

beforeEach(() => resetBankrollForTests());

// Shoe fixture order: P1, B1, P2, B2, then punter third, then banker third.
const BANKER_NATURAL_9 = [
  c(CardName.Two),
  c(CardName.Four),
  c(CardName.Three),
  c(CardName.Five, Suit.Hearts),
]; // Punter 5, Banker 9 (natural)
const PUNTER_NATURAL_9 = [
  c(CardName.Four),
  c(CardName.Two),
  c(CardName.Five, Suit.Hearts),
  c(CardName.Three),
]; // Punter 9 (natural), Banker 5
const NATURAL_TIE_8 = [
  c(CardName.Three),
  c(CardName.King),
  c(CardName.Five, Suit.Hearts),
  c(CardName.Eight),
]; // Both 8 — égalité

describe("the human banker", () => {
  test("stakes from the bankroll, wins, and may garde", () => {
    const game = new BaccaratGame("chemin-de-fer", 1);
    let s = game.getState();
    expect(s.bankerSeat).toBe(0);
    expect(s.punterSeat).toBe(1);
    expect(game.stakeBank(10)).toBe(true);
    expect(balance()).toBe(190);

    game.setShoeForTests(BANKER_NATURAL_9);
    game.deal();
    s = game.getState();
    expect(s.phase).toBe("BANKER_DECISION");
    expect(s.coupAmount).toBe(10);
    expect(balance()).toBe(210); // stake back + punter's 10
    expect(s.botPurses[0]).toBe(90);
    expect(s.bankerCoups).toBe(1);
    expect(s.lastNet).toBe(10);

    game.bankerKeep();
    expect(game.getState().bankWillPass).toBe(false);
    game.nextCoup();
    s = game.getState();
    expect(s.bankerSeat).toBe(0);
    expect(s.punterSeat).toBe(2);
    expect(s.phase).toBe("BETTING");
  });

  test("may pass the bank after a win", () => {
    const game = new BaccaratGame("chemin-de-fer", 1);
    game.stakeBank(10);
    game.setShoeForTests(BANKER_NATURAL_9);
    game.deal();
    game.bankerPass();
    expect(game.getState().bankWillPass).toBe(true);
    game.nextCoup();
    const s = game.getState();
    expect(s.bankerSeat).toBe(1);
    expect(s.punterSeat).toBe(2);
    expect(s.bankerCoups).toBe(0);
  });

  test("loses the coup and the bank passes", () => {
    const game = new BaccaratGame("chemin-de-fer", 1);
    game.stakeBank(10);
    game.setShoeForTests(PUNTER_NATURAL_9);
    game.deal();
    const s = game.getState();
    expect(s.phase).toBe("COUP_OVER");
    expect(balance()).toBe(190); // stake lost to the punter
    expect(s.botPurses[0]).toBe(110);
    expect(s.bankWillPass).toBe(true);
    expect(s.lastNet).toBe(-10);
    expect(s.winner).toBe("computer");
    game.nextCoup();
    expect(game.getState().bankerSeat).toBe(1);
  });

  test("a tie annuls the coup and returns both stakes", () => {
    const game = new BaccaratGame("chemin-de-fer", 1);
    game.stakeBank(10);
    game.setShoeForTests(NATURAL_TIE_8);
    game.deal();
    const s = game.getState();
    expect(s.phase).toBe("COUP_OVER");
    expect(balance()).toBe(200);
    expect(s.botPurses[0]).toBe(100);
    expect(s.bankWillPass).toBe(false);
    expect(s.bankerCoups).toBe(0);
    game.nextCoup();
    expect(game.getState().bankerSeat).toBe(0);
    expect(game.getState().bankStake).toBe(0); // must re-stake
  });
});

describe("the human punter's five", () => {
  test("gets the choice and may draw", () => {
    const game = new BaccaratGame("chemin-de-fer", 1);
    game.setSeatsForTests(1, 0);
    expect(game.getState().bankStake).toBe(25); // bot stakes from its purse
    // Punter 2+3=5, Banker 2+2=4; third cards 4 then K.
    game.setShoeForTests([
      c(CardName.Two),
      c(CardName.Two, Suit.Hearts),
      c(CardName.Three),
      c(CardName.Two, Suit.Diamonds),
      c(CardName.Four),
      c(CardName.King, Suit.Diamonds),
    ]);
    game.deal();
    let s = game.getState();
    expect(s.phase).toBe("PUNTER_DECISION");
    expect(balance()).toBe(175); // covering the 25 coup
    expect(s.playerCards.length).toBe(2);

    game.punterDraw();
    s = game.getState();
    expect(s.playerCards.length).toBe(3);
    expect(s.result!.playerTotal).toBe(9);
    expect(s.result!.bankerTotal).toBe(4); // banker 4 drew a K vs third 4
    expect(balance()).toBe(225);
    expect(s.botPurses[0]).toBe(75);
    expect(s.bankWillPass).toBe(true);
  });

  test("may stand, after which the banker plays the tableau", () => {
    const game = new BaccaratGame("chemin-de-fer", 1);
    game.setSeatsForTests(1, 0);
    game.setShoeForTests([
      c(CardName.Two),
      c(CardName.Two, Suit.Hearts),
      c(CardName.Three),
      c(CardName.Two, Suit.Diamonds),
      c(CardName.Nine),
    ]);
    game.deal();
    expect(game.getState().phase).toBe("PUNTER_DECISION");
    game.punterStand();
    const s = game.getState();
    expect(s.playerCards.length).toBe(2);
    expect(s.bankerCards.length).toBe(3); // banker 4 draws when punter stood
    expect(s.result!.playerTotal).toBe(5);
    expect(s.result!.bankerTotal).toBe(3);
    expect(s.result!.outcome).toBe("player");
    expect(balance()).toBe(225);
  });

  test("bot punters resolve the five deterministically per seed", () => {
    const run = (): number => {
      resetBankrollForTests();
      const game = new BaccaratGame("chemin-de-fer", 42);
      game.stakeBank(10);
      game.setShoeForTests([
        c(CardName.Two),
        c(CardName.Two, Suit.Hearts),
        c(CardName.Three),
        c(CardName.Two, Suit.Diamonds),
        c(CardName.Nine),
        c(CardName.Nine, Suit.Hearts),
      ]);
      game.deal();
      expect(game.getState().phase).not.toBe("PUNTER_DECISION");
      return game.getState().playerCards.length;
    };
    const first = run();
    expect([2, 3]).toContain(first);
    expect(run()).toBe(first);
  });
});

test("a winning bot banker gardes up to three coups, then passes", () => {
  const game = new BaccaratGame("chemin-de-fer", 1);
  game.setSeatsForTests(1, 2);

  // Coup 1: bot vs bot, banker natural 9 wins.
  game.setShoeForTests(BANKER_NATURAL_9);
  game.deal();
  let s = game.getState();
  expect(s.botPurses).toEqual([125, 75]);
  expect(s.bankerCoups).toBe(1);
  expect(s.bankWillPass).toBe(false);
  game.nextCoup();
  s = game.getState();
  expect(s.bankerSeat).toBe(1);
  expect(s.punterSeat).toBe(0); // rotation reaches the human

  // Coup 2: human punter covers the bank's 25 and loses.
  game.setShoeForTests(BANKER_NATURAL_9);
  game.deal();
  s = game.getState();
  expect(s.coupAmount).toBe(25);
  expect(balance()).toBe(175);
  expect(s.botPurses[0]).toBe(150);
  expect(s.bankerCoups).toBe(2);
  expect(s.bankWillPass).toBe(false);
  game.nextCoup();
  expect(game.getState().punterSeat).toBe(2);

  // Coup 3: third straight win — the bot passes the bank.
  game.setShoeForTests(BANKER_NATURAL_9);
  game.deal();
  s = game.getState();
  expect(s.botPurses).toEqual([175, 50]);
  expect(s.bankerCoups).toBe(3);
  expect(s.bankWillPass).toBe(true);
  game.nextCoup();
  s = game.getState();
  expect(s.bankerSeat).toBe(2);
  expect(s.bankerCoups).toBe(0);
});
