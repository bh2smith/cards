// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract CardRoomLeaderboardV4 is Initializable, UUPSUpgradeable, OwnableUpgradeable {
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

    uint8 public constant GOLF = 0;
    uint8 public constant PYRAMID = 1;
    uint8 public constant CRIBBAGE = 2;
    uint8 public constant BLACKJACK = 3;
    uint8 public constant GIN_RUMMY = 4;
    uint8 public constant HEARTS = 5;
    uint8 public constant KLONDIKE = 6;

    uint8 public constant MAX_GOLF_CARDS = 35;
    uint8 public constant MAX_PYRAMID_CARDS = 28;
    uint8 public constant MAX_KLONDIKE_CARDS = 52;
    uint8 public constant MAX_TOP = 100;

    // --- V1/V2 storage (preserved layout) ---
    uint8 public gameCount;
    uint8 public soloGameMax; // deprecated

    mapping(uint8 => uint32) public minDuration;
    mapping(uint8 => mapping(address => PlayerStats)) public stats;

    mapping(uint8 => TopEntry[]) internal _top;
    mapping(uint8 => mapping(address => uint256)) internal _topIndex;
    mapping(uint8 => mapping(address => bool)) internal _inTop;

    mapping(uint8 => uint8) public maxCards;

    // --- V3 storage ---
    mapping(uint8 => bool) public isSolo;

    // --- V4 storage ---
    mapping(uint8 => mapping(address => uint64)) public gameStartedAt;
    uint32 public abandonmentTimeout;

    event GameResult(uint8 indexed gameId, address indexed player, bool won, uint8 cardsRemaining, uint256 timestamp);
    event GameAdded(uint8 indexed gameId, bool solo, uint32 minDurationSec);
    event GameStarted(uint8 indexed gameId, address indexed player, uint256 timestamp);
    event GameAbandoned(uint8 indexed gameId, address indexed player, uint256 timestamp);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) external initializer {
        __Ownable_init(owner_);

        gameCount = 7;

        isSolo[GOLF] = true;
        isSolo[PYRAMID] = true;
        isSolo[KLONDIKE] = true;

        minDuration[GOLF] = 30;
        minDuration[PYRAMID] = 30;
        minDuration[CRIBBAGE] = 180;
        minDuration[BLACKJACK] = 60;
        minDuration[GIN_RUMMY] = 120;
        minDuration[HEARTS] = 300;
        minDuration[KLONDIKE] = 30;

        maxCards[GOLF] = MAX_GOLF_CARDS;
        maxCards[PYRAMID] = MAX_PYRAMID_CARDS;
        maxCards[KLONDIKE] = MAX_KLONDIKE_CARDS;

        abandonmentTimeout = 1 hours;
    }

    function initializeV3() external reinitializer(2) {
        isSolo[GOLF] = true;
        isSolo[PYRAMID] = true;
        isSolo[KLONDIKE] = true;

        gameCount = 7;
        minDuration[KLONDIKE] = 30;
        maxCards[KLONDIKE] = MAX_KLONDIKE_CARDS;
    }

    function initializeV4() external reinitializer(3) {
        abandonmentTimeout = 1 hours;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ─── Admin ───

    function addSoloGame(uint32 minDurationSec, uint8 maxCardsRemaining) external onlyOwner returns (uint8 gameId) {
        gameId = gameCount;
        gameCount++;
        isSolo[gameId] = true;
        minDuration[gameId] = minDurationSec;
        maxCards[gameId] = maxCardsRemaining;
        emit GameAdded(gameId, true, minDurationSec);
    }

    function addVsAiGame(uint32 minDurationSec) external onlyOwner returns (uint8 gameId) {
        gameId = gameCount;
        gameCount++;
        minDuration[gameId] = minDurationSec;
        emit GameAdded(gameId, false, minDurationSec);
    }

    function setMinDuration(uint8 gameId, uint32 dur) external onlyOwner {
        require(gameId < gameCount, "Invalid game");
        minDuration[gameId] = dur;
    }

    function migrateStats(uint8 gameId, address[] calldata players, PlayerStats[] calldata playerStats)
        external
        onlyOwner
    {
        require(gameId < gameCount, "Invalid game");
        require(players.length == playerStats.length, "Length mismatch");
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            PlayerStats memory ps = playerStats[i];
            stats[gameId][player] = ps;

            int64 score;
            if (isSolo[gameId]) {
                score = -int64(int32(ps.totalCardsRemaining));
            } else {
                score = int64(int32(ps.wins)) - int64(int32(ps.losses));
            }
            _updateTop(gameId, player, score);
        }
    }

    function setAbandonmentTimeout(uint32 timeout) external onlyOwner {
        abandonmentTimeout = timeout;
    }

    function resolveAbandoned(uint8 gameId, address[] calldata players) external {
        require(gameId < gameCount, "Invalid game");
        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint64 startedAt = gameStartedAt[gameId][player];
            require(startedAt != 0, "No active game");
            require(block.timestamp - startedAt >= abandonmentTimeout, "Not yet abandoned");

            PlayerStats storage s = stats[gameId][player];
            s.losses++;
            if (isSolo[gameId]) {
                s.totalCardsRemaining += uint32(maxCards[gameId]);
            }
            s.gamesPlayed++;
            s.lastPlayedAt = uint64(block.timestamp);

            if (isSolo[gameId]) {
                _updateTop(gameId, player, -int64(int32(s.totalCardsRemaining)));
            } else {
                _updateTop(gameId, player, int64(int32(s.wins)) - int64(int32(s.losses)));
            }

            delete gameStartedAt[gameId][player];

            emit GameAbandoned(gameId, player, block.timestamp);
            emit GameResult(gameId, player, false, isSolo[gameId] ? maxCards[gameId] : 0, block.timestamp);
        }
    }

    // ─── Gameplay ───

    function startGame(uint8 gameId) external {
        require(gameId < gameCount, "Invalid game");
        require(gameStartedAt[gameId][msg.sender] == 0, "Game already active");

        gameStartedAt[gameId][msg.sender] = uint64(block.timestamp);
        emit GameStarted(gameId, msg.sender, block.timestamp);
    }

    function recordSoloResult(uint8 gameId, bool won, uint8 cardsRemaining) external {
        require(isSolo[gameId], "Not a solo game");
        require(cardsRemaining <= maxCards[gameId], "Invalid cards remaining");
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

        _updateTop(gameId, msg.sender, -int64(int32(s.totalCardsRemaining)));

        delete gameStartedAt[gameId][msg.sender];

        emit GameResult(gameId, msg.sender, won, cardsRemaining, block.timestamp);
    }

    function recordVsAiResult(uint8 gameId, bool won) external {
        require(!isSolo[gameId] && gameId < gameCount, "Not a vs-AI game");

        PlayerStats storage s = stats[gameId][msg.sender];
        require(s.lastPlayedAt == 0 || block.timestamp - s.lastPlayedAt >= minDuration[gameId], "Too fast");

        if (won) {
            s.wins++;
        } else {
            s.losses++;
        }
        s.gamesPlayed++;
        s.lastPlayedAt = uint64(block.timestamp);

        _updateTop(gameId, msg.sender, int64(int32(s.wins)) - int64(int32(s.losses)));

        delete gameStartedAt[gameId][msg.sender];

        emit GameResult(gameId, msg.sender, won, 0, block.timestamp);
    }

    // ─── Reads ───

    function getPlayerStats(uint8 gameId, address player) external view returns (PlayerStats memory) {
        require(gameId < gameCount, "Invalid game");
        return stats[gameId][player];
    }

    function getTop(uint8 gameId) external view returns (address[] memory players, PlayerStats[] memory playerStats) {
        require(gameId < gameCount, "Invalid game");
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
        require(gameId < gameCount, "Invalid game");
        return _top[gameId].length;
    }

    // ─── Internal ───

    function _updateTop(uint8 gameId, address player, int64 score) internal {
        TopEntry[] storage top = _top[gameId];

        if (_inTop[gameId][player]) {
            uint256 idx = _topIndex[gameId][player];
            top[idx].score = score;
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

        uint256 lastIdx = top.length - 1;
        if (score <= top[lastIdx].score) return;

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
