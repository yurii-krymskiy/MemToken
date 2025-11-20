// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MemTokenMarket} from "./core/MemTokenMarket.sol";
import {MemTokenBase} from "./core/MemTokenBase.sol";


contract MemToken is MemTokenMarket {
    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 initialSupply,
        uint256 _timeToVote,
        uint256 _feeBps
    ) MemTokenBase(_decimals) {
        _initBase(_name, _symbol, _feeBps, _timeToVote, msg.sender);
        _mint(msg.sender, initialSupply);
    }
}

