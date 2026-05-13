// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "../src/CardRoomLeaderboardV2.sol";
import "../src/CardRoomLeaderboard.sol";

contract DeployV2 is Script {
    address constant OLD_LEADERBOARD = 0xC719436DF864D7A3708dbC4a659b6e13DEEBb051;

    function run(address owner_) external {
        vm.startBroadcast();

        // 1. Deploy implementation
        CardRoomLeaderboardV2 impl = new CardRoomLeaderboardV2();

        // 2. Deploy proxy with initialize call
        bytes memory initData = abi.encodeCall(CardRoomLeaderboardV2.initialize, (owner_));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        console.log("Implementation:", address(impl));
        console.log("Proxy:", address(proxy));

        vm.stopBroadcast();
    }
}

contract MigrateV2 is Script {
    address constant OLD_LEADERBOARD = 0xC719436DF864D7A3708dbC4a659b6e13DEEBb051;

    function run(address proxyAddress) external {
        CardRoomLeaderboard old = CardRoomLeaderboard(OLD_LEADERBOARD);
        CardRoomLeaderboardV2 board = CardRoomLeaderboardV2(proxyAddress);

        vm.startBroadcast();

        for (uint8 gameId = 0; gameId < 6; gameId++) {
            (address[] memory players, CardRoomLeaderboard.PlayerStats[] memory oldStats) = old.getTop(gameId);
            if (players.length == 0) continue;

            CardRoomLeaderboardV2.PlayerStats[] memory newStats = new CardRoomLeaderboardV2.PlayerStats[](players.length);
            for (uint256 i = 0; i < players.length; i++) {
                newStats[i] = CardRoomLeaderboardV2.PlayerStats({
                    wins: oldStats[i].wins,
                    losses: oldStats[i].losses,
                    totalCardsRemaining: oldStats[i].totalCardsRemaining,
                    gamesPlayed: oldStats[i].gamesPlayed,
                    lastPlayedAt: 0 // reset rate limit so migrated players can play immediately
                });
            }

            board.migrateStats(gameId, players, newStats);
            console.log("Migrated game %d: %d players", uint256(gameId), players.length);
        }

        vm.stopBroadcast();
    }
}
