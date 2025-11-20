// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "../IERC20.sol";

abstract contract MemTokenBase is IERC20 {
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 internal tokenPrice; // wei per whole token unit

    // Admin + Fees
    address public admin;
    uint256 public feeBps; // fee in basis points (1 BPS = 0.01% | 100 BPS = 1% | 10000 BPS = 100%)
    uint256 public constant MAX_FEE_BPS = 10_000; // 100%
    uint256 public lastFeeBurnTime;
    uint256 public constant FEE_BURN_INTERVAL = 7 days;

    struct Vote {
        uint256 amount;
        uint256 price;
        bool voted;
    }

    uint256 public currentSessionId;
    uint256 public leadingPrice;
    mapping(uint256 => mapping(uint256 => uint256)) public priceTotals;
    mapping(uint256 => mapping(address => Vote)) public votes;
    uint256 public votingStartedTime;
    uint256 public timeToVote;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin: not authorized");
        _;
    }

    constructor(uint8 _decimals) {
        decimals = _decimals;
    }

    function _initBase(
        string memory _name,
        string memory _symbol,
        uint256 _feeBps,
        uint256 _timeToVote,
        address _admin
    ) internal {
        require(
            bytes(name).length == 0 && bytes(symbol).length == 0,
            "Init: already initialized"
        );
        name = _name;
        symbol = _symbol;
        feeBps = _feeBps;
        timeToVote = _timeToVote;
        admin = _admin;
        lastFeeBurnTime = block.timestamp;
    }

    function setFeeBps(uint256 _feeBps) external onlyAdmin {
        require(_feeBps <= MAX_FEE_BPS, "Fee: too high");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }
}
