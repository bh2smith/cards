// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/CardRoomLeaderboard.sol";

contract DeployLeaderboard is Script {
    function run() external {
        vm.startBroadcast();
        CardRoomLeaderboard board = new CardRoomLeaderboard();
        vm.stopBroadcast();

        console.log("CardRoomLeaderboard deployed at:", address(board));
    }
}
