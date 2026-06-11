// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/CardRoomLeaderboardV3.sol";
import "../src/CardRoomLeaderboardV4.sol";

contract CardRoomLeaderboardV4Test is Test {
    CardRoomLeaderboardV4 public board;
    address public owner = makeAddr("owner");
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    uint8 constant GOLF = 0;
    uint8 constant PYRAMID = 1;
    uint8 constant CRIBBAGE = 2;
    uint8 constant BLACKJACK = 3;
    uint8 constant KLONDIKE = 6;

    function setUp() public {
        CardRoomLeaderboardV4 impl = new CardRoomLeaderboardV4();
        bytes memory initData = abi.encodeCall(CardRoomLeaderboardV4.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        board = CardRoomLeaderboardV4(address(proxy));
        vm.warp(1000);
    }

    // ─── startGame ───

    function test_startGame_emitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit CardRoomLeaderboardV4.GameStarted(GOLF, alice, block.timestamp);
        board.startGame(GOLF);

        assertEq(board.gameStartedAt(GOLF, alice), uint64(block.timestamp));
    }

    function test_startGame_revert_alreadyActive() public {
        vm.prank(alice);
        board.startGame(GOLF);

        vm.prank(alice);
        vm.expectRevert("Game already active");
        board.startGame(GOLF);
    }

    function test_startGame_revert_invalidGame() public {
        vm.prank(alice);
        vm.expectRevert("Invalid game");
        board.startGame(99);
    }

    function test_startGame_differentGamesAllowed() public {
        vm.prank(alice);
        board.startGame(GOLF);

        vm.prank(alice);
        board.startGame(CRIBBAGE);

        assertGt(board.gameStartedAt(GOLF, alice), 0);
        assertGt(board.gameStartedAt(CRIBBAGE, alice), 0);
    }

    // ─── recordResult clears active game ───

    function test_recordSolo_clearsActiveGame() public {
        vm.prank(alice);
        board.startGame(GOLF);
        assertGt(board.gameStartedAt(GOLF, alice), 0);

        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);
        assertEq(board.gameStartedAt(GOLF, alice), 0);
    }

    function test_recordVsAi_clearsActiveGame() public {
        vm.prank(alice);
        board.startGame(CRIBBAGE);
        assertGt(board.gameStartedAt(CRIBBAGE, alice), 0);

        vm.prank(alice);
        board.recordVsAiResult(CRIBBAGE, true);
        assertEq(board.gameStartedAt(CRIBBAGE, alice), 0);
    }

    function test_recordResult_worksWithoutStartGame() public {
        vm.prank(alice);
        board.recordSoloResult(GOLF, false, 10);

        CardRoomLeaderboardV4.PlayerStats memory s = board.getPlayerStats(GOLF, alice);
        assertEq(s.losses, 1);
    }

    // ─── resolveAbandoned ───

    function test_resolveAbandoned_solo() public {
        vm.prank(alice);
        board.startGame(KLONDIKE);

        vm.warp(block.timestamp + 86400);

        address[] memory players = new address[](1);
        players[0] = alice;

        vm.prank(bob);
        board.resolveAbandoned(KLONDIKE, players);

        assertEq(board.gameStartedAt(KLONDIKE, alice), 0);

        CardRoomLeaderboardV4.PlayerStats memory s = board.getPlayerStats(KLONDIKE, alice);
        assertEq(s.losses, 1);
        assertEq(s.totalCardsRemaining, 52);
        assertEq(s.gamesPlayed, 1);
    }

    function test_resolveAbandoned_vsAi() public {
        vm.prank(alice);
        board.startGame(CRIBBAGE);

        vm.warp(block.timestamp + 86400);

        address[] memory players = new address[](1);
        players[0] = alice;

        vm.prank(bob);
        board.resolveAbandoned(CRIBBAGE, players);

        assertEq(board.gameStartedAt(CRIBBAGE, alice), 0);

        CardRoomLeaderboardV4.PlayerStats memory s = board.getPlayerStats(CRIBBAGE, alice);
        assertEq(s.losses, 1);
        assertEq(s.gamesPlayed, 1);
        assertEq(s.totalCardsRemaining, 0);
    }

    function test_resolveAbandoned_batch() public {
        vm.prank(alice);
        board.startGame(GOLF);
        vm.prank(bob);
        board.startGame(GOLF);

        vm.warp(block.timestamp + 86400);

        address[] memory players = new address[](2);
        players[0] = alice;
        players[1] = bob;

        board.resolveAbandoned(GOLF, players);

        assertEq(board.gameStartedAt(GOLF, alice), 0);
        assertEq(board.gameStartedAt(GOLF, bob), 0);

        CardRoomLeaderboardV4.PlayerStats memory sA = board.getPlayerStats(GOLF, alice);
        assertEq(sA.losses, 1);
        CardRoomLeaderboardV4.PlayerStats memory sB = board.getPlayerStats(GOLF, bob);
        assertEq(sB.losses, 1);
    }

    function test_resolveAbandoned_revert_noActiveGame() public {
        address[] memory players = new address[](1);
        players[0] = alice;

        vm.expectRevert("No active game");
        board.resolveAbandoned(GOLF, players);
    }

    function test_resolveAbandoned_revert_notYetAbandoned() public {
        vm.prank(alice);
        board.startGame(GOLF);

        vm.warp(block.timestamp + 1800);

        address[] memory players = new address[](1);
        players[0] = alice;

        vm.expectRevert("Not yet abandoned");
        board.resolveAbandoned(GOLF, players);
    }

    function test_resolveAbandoned_emitsEvents() public {
        vm.prank(alice);
        board.startGame(KLONDIKE);

        vm.warp(block.timestamp + 86400);

        address[] memory players = new address[](1);
        players[0] = alice;

        vm.expectEmit(true, true, false, true);
        emit CardRoomLeaderboardV4.GameAbandoned(KLONDIKE, alice, block.timestamp);
        board.resolveAbandoned(KLONDIKE, players);
    }

    function test_resolveAbandoned_updatesLeaderboard() public {
        vm.prank(alice);
        board.startGame(KLONDIKE);

        vm.warp(block.timestamp + 86400);

        address[] memory players = new address[](1);
        players[0] = alice;

        board.resolveAbandoned(KLONDIKE, players);

        (address[] memory top,) = board.getTop(KLONDIKE);
        assertEq(top.length, 1);
        assertEq(top[0], alice);
    }

    // ─── Can play again after abandoned is resolved ───

    function test_canPlayAfterAbandoned() public {
        vm.prank(alice);
        board.startGame(GOLF);

        vm.warp(block.timestamp + 86400);

        address[] memory players = new address[](1);
        players[0] = alice;
        board.resolveAbandoned(GOLF, players);

        vm.warp(block.timestamp + 30);

        vm.prank(alice);
        board.startGame(GOLF);
        vm.prank(alice);
        board.recordSoloResult(GOLF, true, 0);

        CardRoomLeaderboardV4.PlayerStats memory s = board.getPlayerStats(GOLF, alice);
        assertEq(s.wins, 1);
        assertEq(s.losses, 1);
        assertEq(s.gamesPlayed, 2);
    }

    // ─── setAbandonmentTimeout ───

    function test_setAbandonmentTimeout() public {
        assertEq(board.abandonmentTimeout(), 24 hours);

        vm.prank(owner);
        board.setAbandonmentTimeout(2 hours);
        assertEq(board.abandonmentTimeout(), 2 hours);
    }

    function test_setAbandonmentTimeout_revert_notOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        board.setAbandonmentTimeout(2 hours);
    }

    // ─── Upgrade from V3 ───

    function test_upgradeFromV3() public {
        CardRoomLeaderboardV3 v3Impl = new CardRoomLeaderboardV3();
        bytes memory initData = abi.encodeCall(CardRoomLeaderboardV3.initialize, (owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(v3Impl), initData);
        CardRoomLeaderboardV3 v3 = CardRoomLeaderboardV3(address(proxy));

        // Play on V3
        vm.prank(alice);
        v3.recordSoloResult(GOLF, false, 10);

        // Upgrade to V4
        CardRoomLeaderboardV4 v4Impl = new CardRoomLeaderboardV4();
        bytes memory upgradeData = abi.encodeCall(CardRoomLeaderboardV4.initializeV4, ());
        vm.prank(owner);
        v3.upgradeToAndCall(address(v4Impl), upgradeData);

        CardRoomLeaderboardV4 v4 = CardRoomLeaderboardV4(address(proxy));

        // V3 data preserved
        CardRoomLeaderboardV4.PlayerStats memory s = v4.getPlayerStats(GOLF, alice);
        assertEq(s.losses, 1);
        assertEq(s.totalCardsRemaining, 10);

        // V4 features work
        vm.warp(block.timestamp + 30);
        vm.prank(alice);
        v4.startGame(GOLF);
        assertGt(v4.gameStartedAt(GOLF, alice), 0);

        vm.prank(alice);
        v4.recordSoloResult(GOLF, true, 0);
        assertEq(v4.gameStartedAt(GOLF, alice), 0);

        s = v4.getPlayerStats(GOLF, alice);
        assertEq(s.wins, 1);
        assertEq(s.losses, 1);
    }
}
