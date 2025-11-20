// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MemTokenERC20} from "./MemTokenERC20.sol";
import {MemTokenBase} from "./MemTokenBase.sol";

abstract contract MemTokenVoting is MemTokenBase, MemTokenERC20 {
    function startVoting() external {
        require(
            _balances[msg.sender] >= _votingThreshold(),
            "Voting: requires >= 0.1% supply"
        );
        require(!_votingActive(), "Voting: already active");

        currentSessionId++;
        votingStartedTime = block.timestamp;
        leadingPrice = 0;

        emit VotingStarted(currentSessionId, block.timestamp);
    }

    function vote(uint256 price) external {
        uint256 voterBalance = _balances[msg.sender];
        require(
            voterBalance >= _minTokenAmount(),
            "Voting: requires >= 0.05% supply"
        );
        require(_votingActive(), "Voting: no active voting");
        require(
            !votes[currentSessionId][msg.sender].voted,
            "Voting: already voted"
        );

        uint256 amount = voterBalance; // voting power equals current holder balance

        votes[currentSessionId][msg.sender] = Vote(amount, price, true);
        priceTotals[currentSessionId][price] += amount;

        if (
            leadingPrice == 0 ||
            priceTotals[currentSessionId][price] >
            priceTotals[currentSessionId][leadingPrice]
        ) {
            leadingPrice = price;
        }

        emit Voted(msg.sender, price, amount);
    }

    function endVoting() external returns (uint256, uint256) {
        require(_votingActive(), "Voting: not active");
        require(
            block.timestamp >= votingStartedTime + timeToVote,
            "Voting: period not over"
        );

        tokenPrice = leadingPrice;
        uint256 leadingAmount_ = priceTotals[currentSessionId][leadingPrice];

        emit VotingEnded(leadingPrice);

        _resetVoting();

        return (leadingPrice, leadingAmount_);
    }

    function _minTokenAmount() internal view returns (uint256) {
        return _totalSupply / 2000;
    } // 0.05%

    function _votingThreshold() internal view returns (uint256) {
        return _totalSupply / 1000;
    } // 0.1%

    function _votingActive() internal view returns (bool) {
        return
            currentSessionId != 0 &&
            votingStartedTime != 0 &&
            block.timestamp < votingStartedTime + timeToVote;
    }

    function _hasActiveVote(address user) internal view returns (bool) {
        return _votingActive() && votes[currentSessionId][user].voted;
    }

    function _resetVoting() internal {
        currentSessionId = 0;
        leadingPrice = 0;
        votingStartedTime = 0;
    }
}
