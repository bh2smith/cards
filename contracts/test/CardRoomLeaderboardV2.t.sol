// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/CardRoomLeaderboardV2.sol";

contract CardRoomLeaderboardV2Test is Test {
    CardRoomLeaderboardV2 public board;
    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint8 constant GOLF = 0;
    uint8 constant PYRAMID = 1;
    uint8 constant CRIBBAGE = 2;
    uint8 constant BLACKJACK = 3;
    uint8 constant GIN_RUMMY = 4;
    uint8 constant HEARTS = 5;

    function setUp() public {
        CardRoomLeaderboardV2 impl = new CardRoomLeaderboardV2();
        bytes memory initData = abi.encodeCall(CardRoomLeaderboardV2.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        board = CardRoomLeaderboardV2(address(proxy));
        vm.warp(1000);
    }

    // ─── Initialization ───

    function test_initialState() public view {
        assertEq(board.gameCount(), 6);
        assertEq(board.soloGameMax(), 1);
        assertEq(board.owner(), owner);
        assertEq(board.minDuration(GOLF), 30);
        assertEq(board.minDuration(HEARTS), 300);
    }

    function test_cannotReinitialize() public {
        vm.expectRevert();
        board.initialize(alice);
    }

    // ─── Solo games (same behavior as V1) ───

    function test_recordGolfResult() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 12);

        CardRoomLeaderboardV2.PlayerStats memory s = board.getPlayerStats(GOLF, alice);
        assertEq(s.losses, 1);
        assertEq(s.totalCardsRemaining, 12);
        assertEq(s.gamesPlayed, 1);
    }

    function test_recordSolo_revert_invalidGameId() public {
        vm.prank(alice);
        vm.expectRevert("Not a solo game");
        board.recordSoloResult(2, false, 5);
    }

    // ─── vs-AI games ───

    function test_recordVsAi_win() public {
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);

        CardRoomLeaderboardV2.PlayerStats memory s = board.getPlayerStats(CRIBBAGE, alice);
        assertEq(s.wins, 1);
        assertEq(s.gamesPlayed, 1);
    }

    function test_recordVsAi_revert_soloGameId() public {
        vm.prank(alice);
        vm.expectRevert("Not a vs-AI game");
        board.recordVsAiResult(GOLF, true);
    }

    function test_recordVsAi_revert_outOfRange() public {
        vm.prank(alice);
        vm.expectRevert("Not a vs-AI game");
        board.recordVsAiResult(6, true);
    }

    // ─── Rate limiting ───

    function test_rateLimiting() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);

        vm.prank(alice);
        vm.expectRevert("Too fast");
        board.recordSoloResult(GOLF, false, 8);

        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 8);
    }

    // ─── Leaderboard ───

    function test_leaderboardSorting() public {
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);
        vm.warp(block.timestamp + 180);
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);

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
        assertEq(players[0], bob);
        assertEq(players[1], alice);
    }

    // ─── Add game ───

    function test_addVsAiGame() public {
        vm.prank(owner);
        uint8 warId = board.addVsAiGame(30);
        assertEq(warId, 6);
        assertEq(board.gameCount(), 7);

        vm.prank(alice);
        board.recordVsAiResult(warId, true);

        CardRoomLeaderboardV2.PlayerStats memory s = board.getPlayerStats(warId, alice);
        assertEq(s.wins, 1);
    }

    function test_addSoloGame() public {
        vm.prank(owner);
        uint8 freeId = board.addSoloGame(30, 52);
        assertEq(freeId, 6);
        assertEq(board.soloGameMax(), 6);

        vm.prank(alice);
        board.recordSoloResult(freeId, false, 20);

        CardRoomLeaderboardV2.PlayerStats memory s = board.getPlayerStats(freeId, alice);
        assertEq(s.totalCardsRemaining, 20);
    }

    function test_addGame_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        board.addVsAiGame(30);
    }

    // ─── Migration ───

    function test_migrateStats() public {
        address[] memory players = new address[](2);
        players[0] = alice;
        players[1] = bob;

        CardRoomLeaderboardV2.PlayerStats[] memory playerStats = new CardRoomLeaderboardV2.PlayerStats[](2);
        playerStats[0] = CardRoomLeaderboardV2.PlayerStats(5, 3, 0, 8, 0);
        playerStats[1] = CardRoomLeaderboardV2.PlayerStats(10, 1, 0, 11, 0);

        vm.prank(owner);
        board.migrateStats(CRIBBAGE, players, playerStats);

        CardRoomLeaderboardV2.PlayerStats memory aliceStats = board.getPlayerStats(CRIBBAGE, alice);
        assertEq(aliceStats.wins, 5);
        assertEq(aliceStats.losses, 3);
        assertEq(aliceStats.gamesPlayed, 8);

        CardRoomLeaderboardV2.PlayerStats memory bobStats = board.getPlayerStats(CRIBBAGE, bob);
        assertEq(bobStats.wins, 10);

        // Bob (net +9) should rank above Alice (net +2)
        (address[] memory top,) = board.getTop(CRIBBAGE);
        assertEq(top[0], bob);
        assertEq(top[1], alice);
    }

    function test_migrateStats_solo() public {
        address[] memory players = new address[](2);
        players[0] = alice;
        players[1] = bob;

        CardRoomLeaderboardV2.PlayerStats[] memory playerStats = new CardRoomLeaderboardV2.PlayerStats[](2);
        playerStats[0] = CardRoomLeaderboardV2.PlayerStats(1, 4, 50, 5, 0);
        playerStats[1] = CardRoomLeaderboardV2.PlayerStats(2, 2, 20, 4, 0);

        vm.prank(owner);
        board.migrateStats(GOLF, players, playerStats);

        // Bob (20 remaining) should rank above Alice (50 remaining) — lower is better
        (address[] memory top,) = board.getTop(GOLF);
        assertEq(top[0], bob);
        assertEq(top[1], alice);
    }

    function test_migrateStats_onlyOwner() public {
        address[] memory players = new address[](0);
        CardRoomLeaderboardV2.PlayerStats[] memory playerStats = new CardRoomLeaderboardV2.PlayerStats[](0);

        vm.prank(alice);
        vm.expectRevert();
        board.migrateStats(GOLF, players, playerStats);
    }

    function test_migrateStats_rateResetAllowsImmediatePlay() public {
        address[] memory players = new address[](1);
        players[0] = alice;
        CardRoomLeaderboardV2.PlayerStats[] memory playerStats = new CardRoomLeaderboardV2.PlayerStats[](1);
        playerStats[0] = CardRoomLeaderboardV2.PlayerStats(5, 3, 0, 8, 0);

        vm.prank(owner);
        board.migrateStats(CRIBBAGE, players, playerStats);

        // Alice should be able to play immediately since lastPlayedAt = 0
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);

        CardRoomLeaderboardV2.PlayerStats memory s = board.getPlayerStats(CRIBBAGE, alice);
        assertEq(s.wins, 6);
        assertEq(s.gamesPlayed, 9);
    }

    // ─── setMinDuration ───

    function test_setMinDuration() public {
        vm.prank(owner);
        board.setMinDuration(GOLF, 60);
        assertEq(board.minDuration(GOLF), 60);
    }

    function test_setMinDuration_onlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        board.setMinDuration(GOLF, 60);
    }

    // ─── Upgrade ───

    function test_upgradeOnlyOwner() public {
        CardRoomLeaderboardV2 newImpl = new CardRoomLeaderboardV2();

        vm.prank(alice);
        vm.expectRevert();
        board.upgradeToAndCall(address(newImpl), "");

        vm.prank(owner);
        board.upgradeToAndCall(address(newImpl), "");
    }

    function test_statePreservedAfterUpgrade() public {
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);

        CardRoomLeaderboardV2 newImpl = new CardRoomLeaderboardV2();
        vm.prank(owner);
        board.upgradeToAndCall(address(newImpl), "");

        CardRoomLeaderboardV2.PlayerStats memory s = board.getPlayerStats(CRIBBAGE, alice);
        assertEq(s.wins, 1);
        assertEq(s.gamesPlayed, 1);
    }
}
