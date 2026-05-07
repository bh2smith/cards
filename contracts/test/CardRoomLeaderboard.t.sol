// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/CardRoomLeaderboard.sol";

contract CardRoomLeaderboardTest is Test {
    CardRoomLeaderboard public board;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public carol = makeAddr("carol");

    uint8 constant GOLF = 0;
    uint8 constant PYRAMID = 1;
    uint8 constant CRIBBAGE = 2;
    uint8 constant BLACKJACK = 3;
    uint8 constant GIN_RUMMY = 4;
    uint8 constant HEARTS = 5;

    function setUp() public {
        board = new CardRoomLeaderboard();
        vm.warp(1000);
    }

    // ─── Solo game recording ───

    function test_recordGolfResult_loss() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 12);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(GOLF, alice);
        assertEq(s.wins, 0);
        assertEq(s.losses, 1);
        assertEq(s.totalCardsRemaining, 12);
        assertEq(s.gamesPlayed, 1);
    }

    function test_recordGolfResult_win() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, true, 0);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(GOLF, alice);
        assertEq(s.wins, 1);
        assertEq(s.losses, 0);
        assertEq(s.totalCardsRemaining, 0);
        assertEq(s.gamesPlayed, 1);
    }

    function test_recordPyramidResult_loss() public {
        vm.prank(alice);
        board.recordSoloResult(PYRAMID, false, 15);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(PYRAMID, alice);
        assertEq(s.losses, 1);
        assertEq(s.totalCardsRemaining, 15);
    }

    function test_recordSolo_revert_invalidGameId() public {
        vm.prank(alice);
        vm.expectRevert("Not a solo game");
        board.recordSoloResult(2, false, 5);
    }

    function test_recordSolo_revert_tooManyCardsGolf() public {
        vm.prank(alice);
        vm.expectRevert("Invalid cards remaining");
        board.recordSoloResult(GOLF, false, 36);
    }

    function test_recordSolo_revert_tooManyCardsPyramid() public {
        vm.prank(alice);
        vm.expectRevert("Invalid cards remaining");
        board.recordSoloResult(PYRAMID, false, 29);
    }

    function test_recordSolo_revert_winWithCardsRemaining() public {
        vm.prank(alice);
        vm.expectRevert("Won but cards remaining");
        board.recordSoloResult(GOLF, true, 5);
    }

    // ─── vs-AI game recording ───

    function test_recordVsAi_win() public {
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(CRIBBAGE, alice);
        assertEq(s.wins, 1);
        assertEq(s.losses, 0);
        assertEq(s.gamesPlayed, 1);
    }

    function test_recordVsAi_loss() public {
        vm.prank(alice);
        board.recordVsAiResult(BLACKJACK, false);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(BLACKJACK, alice);
        assertEq(s.wins, 0);
        assertEq(s.losses, 1);
    }

    function test_recordVsAi_allGameIds() public {
        uint8[4] memory games = [CRIBBAGE, BLACKJACK, GIN_RUMMY, HEARTS];
        for (uint256 i = 0; i < games.length; i++) {
            vm.prank(alice);
            board.recordVsAiResult(games[i], true);
        }
    }

    function test_recordVsAi_revert_invalidGameId_low() public {
        vm.prank(alice);
        vm.expectRevert("Not a vs-AI game");
        board.recordVsAiResult(1, true);
    }

    function test_recordVsAi_revert_invalidGameId_high() public {
        vm.prank(alice);
        vm.expectRevert("Not a vs-AI game");
        board.recordVsAiResult(6, true);
    }

    // ─── Rate limiting ───

    function test_rateLimiting_golf() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);

        vm.prank(alice);
        vm.expectRevert("Too fast");
        board.recordSoloResult(GOLF, false, 8);

        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 8);
    }

    function test_rateLimiting_hearts() public {
        vm.prank(alice);
        board.recordVsAiResult(HEARTS, true);

        vm.warp(block.timestamp + 299);
        vm.prank(alice);
        vm.expectRevert("Too fast");
        board.recordVsAiResult(HEARTS, false);

        vm.warp(block.timestamp + 2);
        vm.prank(alice);
        board.recordVsAiResult(HEARTS, false);
    }

    function test_rateLimiting_perPlayer() public {
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);

        vm.prank(bob);
        board.recordVsAiResult(CRIBBAGE, true);
    }

    function test_rateLimiting_perGame() public {
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);

        vm.prank(alice);
        board.recordVsAiResult(BLACKJACK, true);
    }

    // ─── Cumulative stats ───

    function test_cumulativeStats_solo() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);

        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 5);

        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        board.recordSoloResult(GOLF, true, 0);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(GOLF, alice);
        assertEq(s.wins, 1);
        assertEq(s.losses, 2);
        assertEq(s.totalCardsRemaining, 15);
        assertEq(s.gamesPlayed, 3);
    }

    function test_cumulativeStats_vsAi() public {
        vm.prank(alice);
        board.recordVsAiResult(GIN_RUMMY, true);

        vm.warp(block.timestamp + 120);
        vm.prank(alice);
        board.recordVsAiResult(GIN_RUMMY, true);

        vm.warp(block.timestamp + 120);
        vm.prank(alice);
        board.recordVsAiResult(GIN_RUMMY, false);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(GIN_RUMMY, alice);
        assertEq(s.wins, 2);
        assertEq(s.losses, 1);
        assertEq(s.gamesPlayed, 3);
    }

    // ─── Top leaderboard reads ───

    function test_getTop_empty() public view {
        (address[] memory players, CardRoomLeaderboard.PlayerStats[] memory playerStats) = board.getTop(GOLF);
        assertEq(players.length, 0);
        assertEq(playerStats.length, 0);
    }

    function test_getTop_multiplePlayers_vsAi() public {
        // Alice: 2 wins, 1 loss = net +1
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);
        vm.warp(block.timestamp + 180);
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);
        vm.warp(block.timestamp + 180);
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, false);

        // Bob: 3 wins, 0 losses = net +3
        vm.warp(block.timestamp + 180);
        vm.prank(bob);
        board.recordVsAiResult(CRIBBAGE, true);
        vm.warp(block.timestamp + 180);
        vm.prank(bob);
        board.recordVsAiResult(CRIBBAGE, true);
        vm.warp(block.timestamp + 180);
        vm.prank(bob);
        board.recordVsAiResult(CRIBBAGE, true);

        (address[] memory players,) = board.getTop(CRIBBAGE);

        assertEq(players.length, 2);
        // Bob should be first (higher net wins)
        assertEq(players[0], bob);
        assertEq(players[1], alice);
    }

    function test_getTop_multiplePlayers_solo() public {
        // Alice: 10 cards remaining (cumulative)
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);

        // Bob: 5 cards remaining (cumulative) — better
        vm.prank(bob);
        board.recordSoloResult(GOLF, false, 5);

        (address[] memory players,) = board.getTop(GOLF);

        assertEq(players.length, 2);
        // Bob should be first (fewer cards remaining)
        assertEq(players[0], bob);
        assertEq(players[1], alice);
    }

    function test_getTop_soloRankingUpdatesOnNewGames() public {
        // Alice starts worse
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 20);

        vm.prank(bob);
        board.recordSoloResult(GOLF, false, 5);

        (address[] memory players1,) = board.getTop(GOLF);
        assertEq(players1[0], bob);
        assertEq(players1[1], alice);

        // Alice plays more and accumulates more cards — stays behind
        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 3);

        // Alice now has 23 cumulative, Bob has 5
        (address[] memory players2,) = board.getTop(GOLF);
        assertEq(players2[0], bob);
        assertEq(players2[1], alice);
    }

    function test_getTopCount() public {
        assertEq(board.getTopCount(GOLF), 0);

        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);
        assertEq(board.getTopCount(GOLF), 1);

        vm.prank(bob);
        board.recordSoloResult(GOLF, false, 3);
        assertEq(board.getTopCount(GOLF), 2);
    }

    function test_getTop_vsAiRankUpdatesOnLoss() public {
        // Alice: 2 wins
        vm.prank(alice);
        board.recordVsAiResult(BLACKJACK, true);
        vm.warp(block.timestamp + 60);
        vm.prank(alice);
        board.recordVsAiResult(BLACKJACK, true);

        // Bob: 1 win
        vm.prank(bob);
        board.recordVsAiResult(BLACKJACK, true);

        (address[] memory players1,) = board.getTop(BLACKJACK);
        assertEq(players1[0], alice);
        assertEq(players1[1], bob);

        // Alice loses twice — now net 0, Bob still net +1
        vm.warp(block.timestamp + 60);
        vm.prank(alice);
        board.recordVsAiResult(BLACKJACK, false);
        vm.warp(block.timestamp + 60);
        vm.prank(alice);
        board.recordVsAiResult(BLACKJACK, false);

        (address[] memory players2,) = board.getTop(BLACKJACK);
        assertEq(players2[0], bob);
        assertEq(players2[1], alice);
    }

    // ─── Top-100 eviction ───

    function test_getTop_evictsWorstWhenFull() public {
        // Fill with 100 players
        for (uint256 i = 0; i < 100; i++) {
            address player = address(uint160(1000 + i));
            vm.prank(player);
            board.recordVsAiResult(CRIBBAGE, true);
        }
        assertEq(board.getTopCount(CRIBBAGE), 100);

        // New player with 2 wins should evict someone with 1 win
        address newPlayer = address(uint160(9999));
        vm.prank(newPlayer);
        board.recordVsAiResult(CRIBBAGE, true);
        vm.warp(block.timestamp + 180);
        vm.prank(newPlayer);
        board.recordVsAiResult(CRIBBAGE, true);

        assertEq(board.getTopCount(CRIBBAGE), 100);

        // New player should be in the top
        (address[] memory players,) = board.getTop(CRIBBAGE);
        assertEq(players[0], newPlayer);
    }

    function test_getTop_doesNotEvictWhenScoreNotBetter() public {
        // Fill with 100 players, each with 2 wins
        for (uint256 i = 0; i < 100; i++) {
            address player = address(uint160(1000 + i));
            vm.prank(player);
            board.recordVsAiResult(CRIBBAGE, true);
            vm.warp(block.timestamp + 180);
            vm.prank(player);
            board.recordVsAiResult(CRIBBAGE, true);
            vm.warp(block.timestamp + 180);
        }

        // New player with only 1 win should NOT get in
        address newPlayer = address(uint160(9999));
        vm.prank(newPlayer);
        board.recordVsAiResult(CRIBBAGE, true);

        assertEq(board.getTopCount(CRIBBAGE), 100);

        // Verify new player is not in top
        (address[] memory players,) = board.getTop(CRIBBAGE);
        for (uint256 i = 0; i < players.length; i++) {
            assertTrue(players[i] != newPlayer);
        }
    }

    // ─── Cross-game isolation ───

    function test_statsIsolatedPerGame() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);

        vm.prank(alice);
        board.recordVsAiResult(BLACKJACK, true);

        CardRoomLeaderboard.PlayerStats memory golf = board.getPlayerStats(GOLF, alice);
        CardRoomLeaderboard.PlayerStats memory bj = board.getPlayerStats(BLACKJACK, alice);

        assertEq(golf.losses, 1);
        assertEq(golf.wins, 0);
        assertEq(bj.wins, 1);
        assertEq(bj.losses, 0);
    }

    // ─── Events ───

    function test_emitsGameResult_solo() public {
        vm.expectEmit(true, true, false, true);
        emit CardRoomLeaderboard.GameResult(GOLF, alice, false, 12, block.timestamp);
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 12);
    }

    function test_emitsGameResult_vsAi() public {
        vm.expectEmit(true, true, false, true);
        emit CardRoomLeaderboard.GameResult(HEARTS, alice, true, 0, block.timestamp);
        vm.prank(alice);
        board.recordVsAiResult(HEARTS, true);
    }

    // ─── Read validation ───

    function test_getPlayerStats_revert_invalidGameId() public {
        vm.expectRevert("Invalid game");
        board.getPlayerStats(6, alice);
    }

    function test_getTop_revert_invalidGameId() public {
        vm.expectRevert("Invalid game");
        board.getTop(6);
    }

    function test_getTopCount_revert_invalidGameId() public {
        vm.expectRevert("Invalid game");
        board.getTopCount(6);
    }

    // ─── Edge cases ───

    function test_maxCardsRemaining_golf() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 35);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(GOLF, alice);
        assertEq(s.totalCardsRemaining, 35);
    }

    function test_maxCardsRemaining_pyramid() public {
        vm.prank(alice);
        board.recordSoloResult(PYRAMID, false, 28);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(PYRAMID, alice);
        assertEq(s.totalCardsRemaining, 28);
    }

    function test_firstGameBypassesRateLimit() public {
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);

        CardRoomLeaderboard.PlayerStats memory s = board.getPlayerStats(CRIBBAGE, alice);
        assertEq(s.gamesPlayed, 1);
    }
}
