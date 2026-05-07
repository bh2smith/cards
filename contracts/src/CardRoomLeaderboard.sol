// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract CardRoomLeaderboard {
    struct PlayerStats {
        uint32 wins;
        uint32 losses;
        uint32 totalCardsRemaining;
        uint32 gamesPlayed;
        uint64 lastPlayedAt;
    }

    uint8 public constant GAME_COUNT = 6;
    uint8 public constant GOLF = 0;
    uint8 public constant PYRAMID = 1;
    uint8 public constant CRIBBAGE = 2;
    uint8 public constant BLACKJACK = 3;
    uint8 public constant GIN_RUMMY = 4;
    uint8 public constant HEARTS = 5;

    uint8 public constant MAX_GOLF_CARDS = 35;
    uint8 public constant MAX_PYRAMID_CARDS = 28;

    mapping(uint8 => uint32) public minDuration;
    mapping(uint8 => mapping(address => PlayerStats)) public stats;
    mapping(uint8 => address[]) internal _players;
    mapping(uint8 => mapping(address => bool)) internal _hasPlayed;

    event GameResult(
        uint8 indexed gameId,
        address indexed player,
        bool won,
        uint8 cardsRemaining,
        uint256 timestamp
    );

    constructor() {
        minDuration[GOLF] = 30;
        minDuration[PYRAMID] = 30;
        minDuration[CRIBBAGE] = 180;
        minDuration[BLACKJACK] = 60;
        minDuration[GIN_RUMMY] = 120;
        minDuration[HEARTS] = 300;
    }

    function recordSoloResult(uint8 gameId, bool won, uint8 cardsRemaining) external {
        require(gameId <= PYRAMID, "Not a solo game");
        uint8 maxCards = gameId == GOLF ? MAX_GOLF_CARDS : MAX_PYRAMID_CARDS;
        require(cardsRemaining <= maxCards, "Invalid cards remaining");
        if (won) {
            require(cardsRemaining == 0, "Won but cards remaining");
        }

        PlayerStats storage s = stats[gameId][msg.sender];
        require(
            s.lastPlayedAt == 0 || block.timestamp - s.lastPlayedAt >= minDuration[gameId],
            "Too fast"
        );

        _ensurePlayer(gameId, msg.sender);

        if (won) {
            s.wins++;
        } else {
            s.losses++;
        }
        s.totalCardsRemaining += uint32(cardsRemaining);
        s.gamesPlayed++;
        s.lastPlayedAt = uint64(block.timestamp);

        emit GameResult(gameId, msg.sender, won, cardsRemaining, block.timestamp);
    }

    function recordVsAiResult(uint8 gameId, bool won) external {
        require(gameId >= CRIBBAGE && gameId <= HEARTS, "Not a vs-AI game");

        PlayerStats storage s = stats[gameId][msg.sender];
        require(
            s.lastPlayedAt == 0 || block.timestamp - s.lastPlayedAt >= minDuration[gameId],
            "Too fast"
        );

        _ensurePlayer(gameId, msg.sender);

        if (won) {
            s.wins++;
        } else {
            s.losses++;
        }
        s.gamesPlayed++;
        s.lastPlayedAt = uint64(block.timestamp);

        emit GameResult(gameId, msg.sender, won, 0, block.timestamp);
    }

    function getPlayerStats(uint8 gameId, address player)
        external
        view
        returns (PlayerStats memory)
    {
        return stats[gameId][player];
    }

    function getLeaderboard(uint8 gameId)
        external
        view
        returns (address[] memory players, PlayerStats[] memory playerStats)
    {
        players = _players[gameId];
        playerStats = new PlayerStats[](players.length);
        for (uint256 i = 0; i < players.length; i++) {
            playerStats[i] = stats[gameId][players[i]];
        }
    }

    function getPlayerCount(uint8 gameId) external view returns (uint256) {
        return _players[gameId].length;
    }

    function _ensurePlayer(uint8 gameId, address player) internal {
        if (!_hasPlayed[gameId][player]) {
            _hasPlayed[gameId][player] = true;
            _players[gameId].push(player);
        }
    }
}
