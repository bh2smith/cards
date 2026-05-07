// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/CardRoomLeaderboard.sol";

contract CardRoomLeaderboardTest is Test {
    CardRoomLeaderboard public board;
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

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

    // ─── Leaderboard reads ───

    function test_getLeaderboard_empty() public view {
        (address[] memory players, CardRoomLeaderboard.PlayerStats[] memory playerStats) =
            board.getLeaderboard(GOLF);
        assertEq(players.length, 0);
        assertEq(playerStats.length, 0);
    }

    function test_getLeaderboard_multiplePlayers() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);

        vm.prank(bob);
        board.recordSoloResult(GOLF, false, 5);

        (address[] memory players, CardRoomLeaderboard.PlayerStats[] memory playerStats) =
            board.getLeaderboard(GOLF);

        assertEq(players.length, 2);
        assertEq(playerStats.length, 2);
        assertEq(players[0], alice);
        assertEq(players[1], bob);
        assertEq(playerStats[0].totalCardsRemaining, 10);
        assertEq(playerStats[1].totalCardsRemaining, 5);
    }

    function test_getPlayerCount() public {
        assertEq(board.getPlayerCount(GOLF), 0);

        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);
        assertEq(board.getPlayerCount(GOLF), 1);

        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 8);
        assertEq(board.getPlayerCount(GOLF), 1);

        vm.prank(bob);
        board.recordSoloResult(GOLF, false, 3);
        assertEq(board.getPlayerCount(GOLF), 2);
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
