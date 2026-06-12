import { test, expect } from "bun:test";
import { encodeChallenge, decodeChallenge, type Challenge } from "../challenge";
import { shuffle, seededRng, createDeck, cardKey } from "../deck";

test("challenge survives an encode/decode roundtrip", () => {
  const challenge: Challenge = {
    game: "klondike",
    seed: 123456789,
    cardsRemaining: 7,
    by: "0x335D5a9adA218A2b334c5E17242D15158e7380f9",
  };
  expect(decodeChallenge(encodeChallenge(challenge))).toEqual(challenge);
});

test("roundtrip without challenger address", () => {
  const challenge: Challenge = { game: "golf", seed: 42, cardsRemaining: 0 };
  expect(decodeChallenge(encodeChallenge(challenge))).toEqual(challenge);
});

test("encoded payload is URL-safe", () => {
  const encoded = encodeChallenge({
    game: "freecell",
    seed: 0xfffffffe,
    cardsRemaining: 52,
    by: "0x335D5a9adA218A2b334c5E17242D15158e7380f9",
  });
  expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
});

test("rejects garbage and invalid payloads", () => {
  expect(decodeChallenge("not-base64!!!")).toBeNull();
  expect(decodeChallenge(btoa("[1,2,3]"))).toBeNull();
  expect(decodeChallenge(btoa(JSON.stringify({ g: "poker", s: 1, c: 1 })))) //
    .toBeNull();
  expect(decodeChallenge(btoa(JSON.stringify({ g: "golf", s: -1, c: 1 })))) //
    .toBeNull();
  expect(decodeChallenge(btoa(JSON.stringify({ g: "golf", s: 1.5, c: 1 })))) //
    .toBeNull();
  expect(decodeChallenge(btoa(JSON.stringify({ g: "golf", s: 1, c: 53 })))) //
    .toBeNull();
});

test("malformed challenger address is dropped, not fatal", () => {
  const decoded = decodeChallenge(
    btoa(JSON.stringify({ g: "golf", s: 1, c: 1, b: "vitalik.eth" })),
  );
  expect(decoded).toEqual({ game: "golf", seed: 1, cardsRemaining: 1 });
});

test("same seed deals the same deck, different seeds differ", () => {
  const a = shuffle(createDeck(), seededRng(777)).map(cardKey);
  const b = shuffle(createDeck(), seededRng(777)).map(cardKey);
  const c = shuffle(createDeck(), seededRng(778)).map(cardKey);
  expect(a).toEqual(b);
  expect(a).not.toEqual(c);
  expect([...new Set(a)].length).toBe(52);
});

test("unseeded shuffle still produces a full deck", () => {
  const deck = shuffle(createDeck()).map(cardKey);
  expect([...new Set(deck)].length).toBe(52);
});
