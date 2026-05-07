export const leaderboardAbi = [
  {
    type: "function",
    name: "recordSoloResult",
    inputs: [
      { name: "gameId", type: "uint8" },
      { name: "won", type: "bool" },
      { name: "cardsRemaining", type: "uint8" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "recordVsAiResult",
    inputs: [
      { name: "gameId", type: "uint8" },
      { name: "won", type: "bool" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getPlayerStats",
    inputs: [
      { name: "gameId", type: "uint8" },
      { name: "player", type: "address" },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "wins", type: "uint32" },
          { name: "losses", type: "uint32" },
          { name: "totalCardsRemaining", type: "uint32" },
          { name: "gamesPlayed", type: "uint32" },
          { name: "lastPlayedAt", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTop",
    inputs: [{ name: "gameId", type: "uint8" }],
    outputs: [
      { name: "players", type: "address[]" },
      {
        name: "playerStats",
        type: "tuple[]",
        components: [
          { name: "wins", type: "uint32" },
          { name: "losses", type: "uint32" },
          { name: "totalCardsRemaining", type: "uint32" },
          { name: "gamesPlayed", type: "uint32" },
          { name: "lastPlayedAt", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getTopCount",
    inputs: [{ name: "gameId", type: "uint8" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "GameResult",
    inputs: [
      { name: "gameId", type: "uint8", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "won", type: "bool", indexed: false },
      { name: "cardsRemaining", type: "uint8", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;
