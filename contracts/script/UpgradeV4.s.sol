// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/CardRoomLeaderboardV3.sol";
import "../src/CardRoomLeaderboardV4.sol";

contract UpgradeV4 is Script {
    address constant PROXY = 0x5b46017EF62efa405579D5397B35FC70E0eD8A87;

    function run() external {
        vm.startBroadcast();

        CardRoomLeaderboardV4 impl = new CardRoomLeaderboardV4();
        bytes memory upgradeData = abi.encodeCall(CardRoomLeaderboardV4.initializeV4, ());

        CardRoomLeaderboardV3(PROXY).upgradeToAndCall(address(impl), upgradeData);

        console.log("V4 Implementation:", address(impl));
        console.log("Proxy (unchanged):", PROXY);

        CardRoomLeaderboardV4 board = CardRoomLeaderboardV4(PROXY);
        console.log("gameCount:", uint256(board.gameCount()));

        vm.stopBroadcast();
    }
}
