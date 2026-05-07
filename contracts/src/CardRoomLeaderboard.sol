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

    struct TopEntry {
        address player;
        int64 score;
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
    uint8 public constant MAX_TOP = 100;

    mapping(uint8 => uint32) public minDuration;
    mapping(uint8 => mapping(address => PlayerStats)) public stats;

    mapping(uint8 => TopEntry[]) internal _top;
    mapping(uint8 => mapping(address => uint256)) internal _topIndex;
    mapping(uint8 => mapping(address => bool)) internal _inTop;

    event GameResult(uint8 indexed gameId, address indexed player, bool won, uint8 cardsRemaining, uint256 timestamp);

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
        require(s.lastPlayedAt == 0 || block.timestamp - s.lastPlayedAt >= minDuration[gameId], "Too fast");

        if (won) {
            s.wins++;
        } else {
            s.losses++;
        }
        s.totalCardsRemaining += uint32(cardsRemaining);
        s.gamesPlayed++;
        s.lastPlayedAt = uint64(block.timestamp);

        // Solo: lower totalCardsRemaining is better → negate so highest score = best
        _updateTop(gameId, msg.sender, -int64(int32(s.totalCardsRemaining)));

        emit GameResult(gameId, msg.sender, won, cardsRemaining, block.timestamp);
    }

    function recordVsAiResult(uint8 gameId, bool won) external {
        require(gameId >= CRIBBAGE && gameId <= HEARTS, "Not a vs-AI game");

        PlayerStats storage s = stats[gameId][msg.sender];
        require(s.lastPlayedAt == 0 || block.timestamp - s.lastPlayedAt >= minDuration[gameId], "Too fast");

        if (won) {
            s.wins++;
        } else {
            s.losses++;
        }
        s.gamesPlayed++;
        s.lastPlayedAt = uint64(block.timestamp);

        // vs-AI: higher (wins - losses) is better
        _updateTop(gameId, msg.sender, int64(int32(s.wins)) - int64(int32(s.losses)));

        emit GameResult(gameId, msg.sender, won, 0, block.timestamp);
    }

    function getPlayerStats(uint8 gameId, address player) external view returns (PlayerStats memory) {
        require(gameId < GAME_COUNT, "Invalid game");
        return stats[gameId][player];
    }

    function getTop(uint8 gameId) external view returns (address[] memory players, PlayerStats[] memory playerStats) {
        require(gameId < GAME_COUNT, "Invalid game");
        TopEntry[] storage top = _top[gameId];
        uint256 len = top.length;
        players = new address[](len);
        playerStats = new PlayerStats[](len);
        for (uint256 i = 0; i < len; i++) {
            players[i] = top[i].player;
            playerStats[i] = stats[gameId][top[i].player];
        }
    }

    function getTopCount(uint8 gameId) external view returns (uint256) {
        require(gameId < GAME_COUNT, "Invalid game");
        return _top[gameId].length;
    }

    // Maintains a sorted top-MAX_TOP list (index 0 = best).
    // Score convention: higher is always better (solo games negate their metric).
    function _updateTop(uint8 gameId, address player, int64 score) internal {
        TopEntry[] storage top = _top[gameId];

        if (_inTop[gameId][player]) {
            uint256 idx = _topIndex[gameId][player];
            top[idx].score = score;
            // Score improved → bubble up; score worsened → bubble down
            _bubbleUp(top, gameId, idx);
            _bubbleDown(top, gameId, idx);
            return;
        }

        if (top.length < MAX_TOP) {
            uint256 newIdx = top.length;
            top.push(TopEntry(player, score));
            _inTop[gameId][player] = true;
            _topIndex[gameId][player] = newIdx;
            _bubbleUp(top, gameId, newIdx);
            return;
        }

        // Full — check if better than the worst (last) entry
        uint256 lastIdx = top.length - 1;
        if (score <= top[lastIdx].score) return;

        // Evict the worst
        address evicted = top[lastIdx].player;
        _inTop[gameId][evicted] = false;
        delete _topIndex[gameId][evicted];

        top[lastIdx] = TopEntry(player, score);
        _inTop[gameId][player] = true;
        _topIndex[gameId][player] = lastIdx;
        _bubbleUp(top, gameId, lastIdx);
    }

    function _bubbleUp(TopEntry[] storage top, uint8 gameId, uint256 idx) internal {
        while (idx > 0) {
            uint256 parent = idx - 1;
            if (top[idx].score <= top[parent].score) break;
            _swap(top, gameId, idx, parent);
            idx = parent;
        }
    }

    function _bubbleDown(TopEntry[] storage top, uint8 gameId, uint256 idx) internal {
        uint256 len = top.length;
        while (idx < len - 1) {
            uint256 next = idx + 1;
            if (top[idx].score >= top[next].score) break;
            _swap(top, gameId, idx, next);
            idx = next;
        }
    }

    function _swap(TopEntry[] storage top, uint8 gameId, uint256 a, uint256 b) internal {
        TopEntry memory tmp = top[a];
        top[a] = top[b];
        top[b] = tmp;
        _topIndex[gameId][top[a].player] = a;
        _topIndex[gameId][top[b].player] = b;
    }
}
