// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/CardRoomLeaderboardV2.sol";
import "../src/CardRoomLeaderboardV3.sol";

contract UpgradeV3 is Script {
    address constant PROXY = 0x5b46017EF62efa405579D5397B35FC70E0eD8A87;

    function run() external {
        vm.startBroadcast();

        CardRoomLeaderboardV3 impl = new CardRoomLeaderboardV3();
        bytes memory upgradeData = abi.encodeCall(CardRoomLeaderboardV3.initializeV3, ());

        CardRoomLeaderboardV2(PROXY).upgradeToAndCall(address(impl), upgradeData);

        console.log("V3 Implementation:", address(impl));
        console.log("Proxy (unchanged):", PROXY);

        // Verify
        CardRoomLeaderboardV3 board = CardRoomLeaderboardV3(PROXY);
        console.log("gameCount:", uint256(board.gameCount()));
        console.log("isSolo(KLONDIKE):", board.isSolo(6));
        console.log("maxCards(KLONDIKE):", uint256(board.maxCards(6)));

        vm.stopBroadcast();
    }
}
