// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MemTokenVoting} from "./MemTokenVoting.sol";

abstract contract MemTokenMarket is MemTokenVoting {
    function buyToken() external payable {
        require(
            !_hasActiveVote(msg.sender),
            "Voting: voter cannot buy during vote"
        );
        require(tokenPrice > 0, "Price: not set");
        require(msg.value > 0, "Buy: zero ETH"); // msg.value in WEI

        uint256 tokens = (msg.value * (10 ** uint256(decimals))) / tokenPrice;
        require(tokens > 0, "Buy: amount too small");

        uint256 fee = (tokens * feeBps) / MAX_FEE_BPS;
        uint256 net = tokens - fee; // user receive

        _mint(msg.sender, net);
        if (fee > 0) {
            _mint(address(this), fee);
        }
    }

    function sellToken(uint256 amount) external {
        require(
            !_hasActiveVote(msg.sender),
            "Voting: voter cannot sell during vote"
        );
        require(tokenPrice > 0, "Price: not set");
        require(amount > 0, "Sell: zero amount");
        require(_balances[msg.sender] >= amount, "Sell: insufficient balance");

        uint256 fee = (amount * feeBps) / MAX_FEE_BPS;
        uint256 net = amount - fee;
        uint256 payout = (net * tokenPrice) / (10 ** uint256(decimals));
        require(address(this).balance >= payout, "Sell: insufficient ETH pool");

        if (fee > 0) {
            _transfer(msg.sender, address(this), fee);
        }
        _burn(msg.sender, net);

        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "Sell: ETH transfer failed");
    }
}
