// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {IERC20} from "./IERC20.sol";

contract MemToken is IERC20 {
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    string public name;
    string public symbol;
    uint8 public immutable decimals;
    uint256 private tokenPrice; // wei per whole token unit

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


    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 initialSupply,
        uint256 _timeToVote,
        uint256 _feeBps
    ) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
        _mint(msg.sender, initialSupply);
        timeToVote = _timeToVote;
        admin = msg.sender;
        feeBps = _feeBps;
        lastFeeBurnTime = block.timestamp;
    }

    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(
        address account
    ) external view override returns (uint256) {
        return _balances[account];
    }

    function transfer(
        address to,
        uint256 value
    ) external override returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function allowance(
        address owner,
        address spender
    ) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(
        address spender,
        uint256 value
    ) external override returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external override returns (bool) {
        _spendAllowance(from, msg.sender, value);
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "ERC20: transfer from the zero address");
        require(to != address(0), "ERC20: transfer to the zero address");

        uint256 fromBalance = _balances[from];
        require(fromBalance >= value, "ERC20: transfer amount exceeds balance");
        unchecked {
            _balances[from] = fromBalance - value;
            _balances[to] += value;
        }

        emit Transfer(from, to, value);
    }

    function _approve(address owner, address spender, uint256 value) internal {
        require(owner != address(0), "ERC20: approve from the zero address");
        require(spender != address(0), "ERC20: approve to the zero address");

        _allowances[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _spendAllowance(
        address owner,
        address spender,
        uint256 value
    ) internal {
        uint256 currentAllowance = _allowances[owner][spender];
        if (currentAllowance != type(uint256).max) {
            require(currentAllowance >= value, "ERC20: insufficient allowance");
            unchecked {
                uint256 newAllowance = currentAllowance - value;
                _allowances[owner][spender] = newAllowance;
            }
            emit Approval(owner, spender, _allowances[owner][spender]);
        }
    }

    function _mint(address account, uint256 value) internal {
        require(account != address(0), "ERC20: mint to the zero address");

        _totalSupply += value;
        _balances[account] += value;
        emit Transfer(address(0), account, value);
    }

    function _burn(address account, uint256 value) internal {
        require(account != address(0), "ERC20: burn from the zero address");
        uint256 accountBalance = _balances[account];
        require(accountBalance >= value, "ERC20: burn amount exceeds balance");
        unchecked {
            _balances[account] = accountBalance - value;
            _totalSupply -= value;
        }
        emit Transfer(account, address(0), value);
    }

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
        require(!votes[currentSessionId][msg.sender].voted, "Voting: already voted");

        uint256 amount = voterBalance; // voting power equals current holder balance

        votes[currentSessionId][msg.sender] = Vote(amount, price, true);
        priceTotals[currentSessionId][price] += amount;

        if (
            leadingPrice == 0 ||
            priceTotals[currentSessionId][price] > priceTotals[currentSessionId][leadingPrice]
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

    function _minTokenAmount() internal view returns (uint256) {
        return _totalSupply / 2000;
    }

    function _votingThreshold() internal view returns (uint256) {
        return _totalSupply / 1000;
    }

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

    // Admin functions
    modifier onlyAdmin() {
        require(msg.sender == admin, "Admin: not authorized");
        _;
    }

    // Admin can call
    function setFeeBps(uint256 _feeBps) external onlyAdmin {
        require(_feeBps <= MAX_FEE_BPS, "Fee: too high");
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }
}
