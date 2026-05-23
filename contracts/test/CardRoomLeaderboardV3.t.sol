// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/CardRoomLeaderboardV2.sol";
import "../src/CardRoomLeaderboardV3.sol";

contract CardRoomLeaderboardV3Test is Test {
    CardRoomLeaderboardV3 public board;
    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint8 constant GOLF = 0;
    uint8 constant PYRAMID = 1;
    uint8 constant CRIBBAGE = 2;
    uint8 constant BLACKJACK = 3;
    uint8 constant GIN_RUMMY = 4;
    uint8 constant HEARTS = 5;
    uint8 constant KLONDIKE = 6;

    function setUp() public {
        CardRoomLeaderboardV3 impl = new CardRoomLeaderboardV3();
        bytes memory initData = abi.encodeCall(CardRoomLeaderboardV3.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        board = CardRoomLeaderboardV3(address(proxy));
        vm.warp(1000);
    }

    // ─── Initialization ───

    function test_initialState() public view {
        assertEq(board.gameCount(), 7);
        assertEq(board.owner(), owner);
        assertTrue(board.isSolo(GOLF));
        assertTrue(board.isSolo(PYRAMID));
        assertTrue(board.isSolo(KLONDIKE));
        assertFalse(board.isSolo(CRIBBAGE));
        assertFalse(board.isSolo(BLACKJACK));
        assertFalse(board.isSolo(GIN_RUMMY));
        assertFalse(board.isSolo(HEARTS));
        assertEq(board.minDuration(KLONDIKE), 30);
        assertEq(board.maxCards(KLONDIKE), 52);
    }

    function test_cannotReinitialize() public {
        vm.expectRevert();
        board.initialize(alice);
    }

    // ─── Solo games ───

    function test_recordKlondikeResult() public {
        vm.prank(alice);
        board.recordSoloResult(KLONDIKE, false, 30);

        CardRoomLeaderboardV3.PlayerStats memory s = board.getPlayerStats(KLONDIKE, alice);
        assertEq(s.losses, 1);
        assertEq(s.totalCardsRemaining, 30);
        assertEq(s.gamesPlayed, 1);
    }

    function test_recordKlondikeWin() public {
        vm.prank(alice);
        board.recordSoloResult(KLONDIKE, true, 0);

        CardRoomLeaderboardV3.PlayerStats memory s = board.getPlayerStats(KLONDIKE, alice);
        assertEq(s.wins, 1);
        assertEq(s.totalCardsRemaining, 0);
    }

    function test_recordGolfResult() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 12);

        CardRoomLeaderboardV3.PlayerStats memory s = board.getPlayerStats(GOLF, alice);
        assertEq(s.losses, 1);
        assertEq(s.totalCardsRemaining, 12);
    }

    function test_recordSolo_revert_vsAiGameId() public {
        vm.prank(alice);
        vm.expectRevert("Not a solo game");
        board.recordSoloResult(CRIBBAGE, false, 5);
    }

    // ─── vs-AI games ───

    function test_recordVsAi_win() public {
        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);

        CardRoomLeaderboardV3.PlayerStats memory s = board.getPlayerStats(CRIBBAGE, alice);
        assertEq(s.wins, 1);
        assertEq(s.gamesPlayed, 1);
    }

    function test_recordVsAi_revert_soloGameId() public {
        vm.prank(alice);
        vm.expectRevert("Not a vs-AI game");
        board.recordVsAiResult(GOLF, true);
    }

    function test_recordVsAi_revert_klondike() public {
        vm.prank(alice);
        vm.expectRevert("Not a vs-AI game");
        board.recordVsAiResult(KLONDIKE, true);
    }

    function test_recordVsAi_revert_outOfRange() public {
        vm.prank(alice);
        vm.expectRevert("Not a vs-AI game");
        board.recordVsAiResult(7, true);
    }

    // ─── Mixed ordering: solo and vs-AI games can be added in any order ───

    function test_addSoloThenVsAi() public {
        vm.startPrank(owner);
        uint8 soloId = board.addSoloGame(30, 40);
        uint8 vsId = board.addVsAiGame(60);
        uint8 soloId2 = board.addSoloGame(30, 20);
        vm.stopPrank();

        assertEq(soloId, 7);
        assertEq(vsId, 8);
        assertEq(soloId2, 9);
        assertTrue(board.isSolo(soloId));
        assertFalse(board.isSolo(vsId));
        assertTrue(board.isSolo(soloId2));

        vm.prank(alice);
        board.recordSoloResult(soloId, false, 10);

        vm.prank(alice);
        board.recordVsAiResult(vsId, true);

        vm.prank(alice);
        board.recordSoloResult(soloId2, false, 5);
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
        uint8 newId = board.addVsAiGame(30);
        assertEq(newId, 7);
        assertEq(board.gameCount(), 8);
        assertFalse(board.isSolo(newId));

        vm.prank(alice);
        board.recordVsAiResult(newId, true);

        CardRoomLeaderboardV3.PlayerStats memory s = board.getPlayerStats(newId, alice);
        assertEq(s.wins, 1);
    }

    function test_addSoloGame() public {
        vm.prank(owner);
        uint8 newId = board.addSoloGame(30, 52);
        assertEq(newId, 7);
        assertTrue(board.isSolo(newId));

        vm.prank(alice);
        board.recordSoloResult(newId, false, 20);

        CardRoomLeaderboardV3.PlayerStats memory s = board.getPlayerStats(newId, alice);
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

        CardRoomLeaderboardV3.PlayerStats[] memory playerStats = new CardRoomLeaderboardV3.PlayerStats[](2);
        playerStats[0] = CardRoomLeaderboardV3.PlayerStats(5, 3, 0, 8, 0);
        playerStats[1] = CardRoomLeaderboardV3.PlayerStats(10, 1, 0, 11, 0);

        vm.prank(owner);
        board.migrateStats(CRIBBAGE, players, playerStats);

        CardRoomLeaderboardV3.PlayerStats memory aliceStats = board.getPlayerStats(CRIBBAGE, alice);
        assertEq(aliceStats.wins, 5);
        assertEq(aliceStats.losses, 3);
        assertEq(aliceStats.gamesPlayed, 8);

        (address[] memory top,) = board.getTop(CRIBBAGE);
        assertEq(top[0], bob);
        assertEq(top[1], alice);
    }

    function test_migrateStats_solo() public {
        address[] memory players = new address[](2);
        players[0] = alice;
        players[1] = bob;

        CardRoomLeaderboardV3.PlayerStats[] memory playerStats = new CardRoomLeaderboardV3.PlayerStats[](2);
        playerStats[0] = CardRoomLeaderboardV3.PlayerStats(1, 4, 50, 5, 0);
        playerStats[1] = CardRoomLeaderboardV3.PlayerStats(2, 2, 20, 4, 0);

        vm.prank(owner);
        board.migrateStats(GOLF, players, playerStats);

        (address[] memory top,) = board.getTop(GOLF);
        assertEq(top[0], bob);
        assertEq(top[1], alice);
    }

    // ─── Upgrade from V2 ───

    function test_upgradeFromV2() public {
        // Deploy V2 via proxy
        CardRoomLeaderboardV2 v2Impl = new CardRoomLeaderboardV2();
        bytes memory initData = abi.encodeCall(CardRoomLeaderboardV2.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(v2Impl), initData);
        CardRoomLeaderboardV2 v2 = CardRoomLeaderboardV2(address(proxy));

        // Record some V2 data
        vm.prank(alice);
        v2.recordSoloResult(GOLF, false, 10);
        vm.warp(block.timestamp + 180);
        vm.prank(alice);
        v2.recordVsAiResult(CRIBBAGE, true);

        // Upgrade to V3
        CardRoomLeaderboardV3 v3Impl = new CardRoomLeaderboardV3();
        bytes memory upgradeData = abi.encodeCall(CardRoomLeaderboardV3.initializeV3, ());
        vm.prank(owner);
        v2.upgradeToAndCall(address(v3Impl), upgradeData);

        CardRoomLeaderboardV3 v3 = CardRoomLeaderboardV3(address(proxy));

        // V2 data preserved
        CardRoomLeaderboardV3.PlayerStats memory golfStats = v3.getPlayerStats(GOLF, alice);
        assertEq(golfStats.losses, 1);
        assertEq(golfStats.totalCardsRemaining, 10);

        CardRoomLeaderboardV3.PlayerStats memory cribStats = v3.getPlayerStats(CRIBBAGE, alice);
        assertEq(cribStats.wins, 1);

        // V3 isSolo mapping set correctly
        assertTrue(v3.isSolo(GOLF));
        assertTrue(v3.isSolo(PYRAMID));
        assertTrue(v3.isSolo(KLONDIKE));
        assertFalse(v3.isSolo(CRIBBAGE));
        assertFalse(v3.isSolo(BLACKJACK));

        // Klondike registered
        assertEq(v3.gameCount(), 7);
        assertEq(v3.minDuration(KLONDIKE), 30);
        assertEq(v3.maxCards(KLONDIKE), 52);

        // Can record Klondike results
        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        v3.recordSoloResult(KLONDIKE, false, 20);

        CardRoomLeaderboardV3.PlayerStats memory kStats = v3.getPlayerStats(KLONDIKE, alice);
        assertEq(kStats.losses, 1);
        assertEq(kStats.totalCardsRemaining, 20);

        // Can still add solo games after vs-AI games
        vm.prank(owner);
        uint8 newSolo = v3.addSoloGame(30, 28);
        vm.prank(owner);
        uint8 newVs = v3.addVsAiGame(60);

        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        v3.recordSoloResult(newSolo, false, 5);

        vm.prank(bob);
        v3.recordVsAiResult(newVs, true);
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
}
