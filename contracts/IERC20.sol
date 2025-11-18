// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    event VotingStarted(uint256 indexed votingNumber, uint256 startTime);
    event Voted(address indexed voter, uint256 price, uint256 votingPower);
    event VotingEnded(uint256 winningPrice);
    event FeeUpdated(uint256 feeBps);
    event FeeBurned(uint256 amount, uint256 timestamp);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 value) external returns (bool);

    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);

    function approve(address spender, uint256 value) external returns (bool);

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
}
