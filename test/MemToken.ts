import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

/*
  Comprehensive tests for MemToken and inherited modules:
  - MemTokenBase: initialization, admin controls, fee management
  - MemTokenERC20: standard ERC20 operations (transfer, approve, transferFrom)
  - MemTokenVoting: voting lifecycle (start, vote, end)
  - MemTokenMarket: buy/sell token operations with price and fees

  Run:
    npx hardhat test test/MemToken.ts
*/

describe("MemToken", async () => {
  const { viem } = await (network as any).connect();
  const publicClient = await viem.getPublicClient();
  const [owner, alice, bob, charlie] = await viem.getWalletClients();

  const NAME = "Mem";
  const SYMBOL = "MEM";
  const DECIMALS = 18;
  const INITIAL_SUPPLY = 1_000_000n * 10n ** 18n; // 1M tokens
  const TIME_TO_VOTE = 60n; // 60 seconds
  const FEE_BPS = 300n; // 3%

  async function deployMemToken() {
    return viem.deployContract("MemToken", [
      NAME,
      SYMBOL,
      DECIMALS,
      INITIAL_SUPPLY,
      Number(TIME_TO_VOTE),
      Number(FEE_BPS),
    ]);
  }

  // MemTokenBase
  describe("MemTokenBase", async () => {
    it("initializes with correct parameters", async () => {
      const mem = await deployMemToken();

      assert.equal(await mem.read.name(), NAME);
      assert.equal(await mem.read.symbol(), SYMBOL);
      assert.equal(await mem.read.decimals(), DECIMALS);
      assert.equal(await mem.read.admin(), getAddress(owner.account.address));
      assert.equal(await mem.read.feeBps(), FEE_BPS);
      assert.equal(await mem.read.timeToVote(), TIME_TO_VOTE);
    });

    it("mints initial supply to deployer", async () => {
      const mem = await deployMemToken();
      const balance = await mem.read.balanceOf([owner.account.address]);
      assert.equal(balance, INITIAL_SUPPLY);
    });

    it("allows admin to update feeBps", async () => {
      const mem = await deployMemToken();
      const newFee = 500n; // 5%

      await mem.write.setFeeBps([newFee], { account: owner.account });
      assert.equal(await mem.read.feeBps(), newFee);
    });

    it("rejects feeBps update from non-admin", async () => {
      const mem = await deployMemToken();

      await assert.rejects(async () => {
        await mem.write.setFeeBps([500n], { account: alice.account });
      });
    });

    it("rejects feeBps above MAX_FEE_BPS", async () => {
      const mem = await deployMemToken();

      await assert.rejects(async () => {
        await mem.write.setFeeBps([10_001n], { account: owner.account });
      });
    });
  });

  // MemTokenERC20
  describe("MemTokenERC20", async () => {
    it("returns correct totalSupply", async () => {
      const mem = await deployMemToken();
      assert.equal(await mem.read.totalSupply(), INITIAL_SUPPLY);
    });

    it("transfers tokens between accounts", async () => {
      const mem = await deployMemToken();
      const amount = 1000n * 10n ** 18n;

      await mem.write.transfer([alice.account.address, amount], {
        account: owner.account,
      });

      assert.equal(await mem.read.balanceOf([alice.account.address]), amount);
    });

    it("emits Transfer event on transfer", async () => {
      const mem = await deployMemToken();
      const amount = 1000n * 10n ** 18n;

      await viem.assertions.emitWithArgs(
        mem.write.transfer([alice.account.address, amount], {
          account: owner.account,
        }),
        mem,
        "Transfer",
        [getAddress(owner.account.address), getAddress(alice.account.address), amount],
      );
    });

    it("rejects transfer with insufficient balance", async () => {
      const mem = await deployMemToken();
      const amount = 1000n * 10n ** 18n;

      await assert.rejects(async () => {
        await mem.write.transfer([owner.account.address, amount], {
          account: alice.account,
        });
      });
    });

    it("approves spender allowance", async () => {
      const mem = await deployMemToken();
      const amount = 500n * 10n ** 18n;

      await mem.write.approve([alice.account.address, amount], {
        account: owner.account,
      });

      assert.equal(
        await mem.read.allowance([owner.account.address, alice.account.address]),
        amount,
      );
    });

    it("emits Approval event on approve", async () => {
      const mem = await deployMemToken();
      const amount = 500n * 10n ** 18n;

      await viem.assertions.emitWithArgs(
        mem.write.approve([alice.account.address, amount], {
          account: owner.account,
        }),
        mem,
        "Approval",
        [getAddress(owner.account.address), getAddress(alice.account.address), amount],
      );
    });

    it("allows transferFrom with sufficient allowance", async () => {
      const mem = await deployMemToken();
      const amount = 500n * 10n ** 18n;

      await mem.write.approve([alice.account.address, amount], {
        account: owner.account,
      });

      await mem.write.transferFrom(
        [owner.account.address, bob.account.address, amount],
        { account: alice.account },
      );

      assert.equal(await mem.read.balanceOf([bob.account.address]), amount);
    });

    it("rejects transferFrom with insufficient allowance", async () => {
      const mem = await deployMemToken();
      const amount = 500n * 10n ** 18n;

      await assert.rejects(async () => {
        await mem.write.transferFrom(
          [owner.account.address, bob.account.address, amount],
          { account: alice.account },
        );
      });
    });

    it("decreases allowance after transferFrom", async () => {
      const mem = await deployMemToken();
      const allowanceAmt = 1000n * 10n ** 18n;
      const transferAmt = 300n * 10n ** 18n;

      await mem.write.approve([alice.account.address, allowanceAmt], {
        account: owner.account,
      });

      await mem.write.transferFrom(
        [owner.account.address, bob.account.address, transferAmt],
        { account: alice.account },
      );

      assert.equal(
        await mem.read.allowance([owner.account.address, alice.account.address]),
        allowanceAmt - transferAmt,
      );
    });
  });

  // MemTokenVoting
  describe("MemTokenVoting", async () => {
    it("allows holder with >= 0.1% supply to start voting", async () => {
      const mem = await deployMemToken();

      await mem.write.startVoting({ account: owner.account });

      const sessionId = await mem.read.currentSessionId();
      assert.equal(sessionId > 0n, true);
    });

    it("emits VotingStarted event", async () => {
      const mem = await deployMemToken();

      const tx = mem.write.startVoting({ account: owner.account });
      await viem.assertions.emit(tx, mem, "VotingStarted");
    });

    it("rejects startVoting from holder with < 0.1% supply", async () => {
      const mem = await deployMemToken();

      await assert.rejects(async () => {
        await mem.write.startVoting({ account: alice.account });
      });
    });

    it("rejects startVoting when voting is already active", async () => {
      const mem = await deployMemToken();

      await mem.write.startVoting({ account: owner.account });

      await assert.rejects(async () => {
        await mem.write.startVoting({ account: owner.account });
      });
    });

    it("allows holder with >= 0.05% supply to vote", async () => {
      const mem = await deployMemToken();
      const votePrice = 100_000_000_000_000n; // 0.0001 ETH per token

      await mem.write.startVoting({ account: owner.account });
      await mem.write.vote([votePrice], { account: owner.account });

      const sessionId = await mem.read.currentSessionId();
      const vote = await mem.read.votes([sessionId, owner.account.address]);
      assert.equal(vote[2], true); 
    });

    it("emits Voted event", async () => {
      const mem = await deployMemToken();
      const votePrice = 100_000_000_000_000n;

      await mem.write.startVoting({ account: owner.account });

      const tx = mem.write.vote([votePrice], { account: owner.account });
      await viem.assertions.emit(tx, mem, "Voted");
    });

    it("rejects vote from holder with < 0.05% supply", async () => {
      const mem = await deployMemToken();
      const votePrice = 100_000_000_000_000n;

      await mem.write.startVoting({ account: owner.account });

      await assert.rejects(async () => {
        await mem.write.vote([votePrice], { account: alice.account });
      });
    });

    it("rejects vote when no voting is active", async () => {
      const mem = await deployMemToken();
      const votePrice = 100_000_000_000_000n;

      await assert.rejects(async () => {
        await mem.write.vote([votePrice], { account: owner.account });
      });
    });

    it("rejects duplicate vote in same session", async () => {
      const mem = await deployMemToken();
      const votePrice = 100_000_000_000_000n;

      await mem.write.startVoting({ account: owner.account });
      await mem.write.vote([votePrice], { account: owner.account });

      await assert.rejects(async () => {
        await mem.write.vote([votePrice * 2n], { account: owner.account });
      });
    });

    it("emits VotingEnded event", async () => {
      const mem = await deployMemToken();
      const votePrice = 100_000_000_000_000n;

      await mem.write.startVoting({ account: owner.account });
      await mem.write.vote([votePrice], { account: owner.account });

      await publicClient.request({
        method: "evm_increaseTime",
        params: [Number(TIME_TO_VOTE + 1n)],
      });
      await publicClient.request({ method: "evm_mine", params: [] });

      const tx = mem.write.endVoting({ account: owner.account });
      await viem.assertions.emit(tx, mem, "VotingEnded");
    });

    it("rejects endVoting before time period", async () => {
      const mem = await deployMemToken();
      const votePrice = 100_000_000_000_000n;

      await mem.write.startVoting({ account: owner.account });
      await mem.write.vote([votePrice], { account: owner.account });

      await assert.rejects(async () => {
        await mem.write.endVoting({ account: owner.account });
      });
    });

    it("rejects endVoting when no session exists", async () => {
      const mem = await deployMemToken();

      await assert.rejects(async () => {
        await mem.write.endVoting({ account: owner.account });
      });
    });
  });

  // MemTokenMarket
  describe("MemTokenMarket", async () => {
    async function deployWithPrice() {
      const mem = await deployMemToken();
      const votePrice = 100_000_000_000_000n;

      await mem.write.startVoting({ account: owner.account });
      await mem.write.vote([votePrice], { account: owner.account });

      await publicClient.request({
        method: "evm_increaseTime",
        params: [Number(TIME_TO_VOTE + 1n)],
      });
      await publicClient.request({ method: "evm_mine", params: [] });

      await mem.write.endVoting({ account: owner.account });

      return mem;
    }

    it("allows user to buy tokens with ETH", async () => {
      const mem = await deployWithPrice();
      const ethAmount = parseEther("1");

      const balanceBefore = await mem.read.balanceOf([alice.account.address]);

      await mem.write.buyToken({
        account: alice.account,
        value: ethAmount,
      });

      const balanceAfter = await mem.read.balanceOf([alice.account.address]);
      assert.equal(balanceAfter > balanceBefore, true);
    });

    it("applies fee on buy", async () => {
      const mem = await deployWithPrice();
      const ethAmount = parseEther("1");
      const votePrice = 100_000_000_000_000n;

      // Calculate expected tokens: (1 ETH * 1e18) / votePrice
      const tokensGross = (ethAmount * 10n ** 18n) / votePrice;
      const fee = (tokensGross * FEE_BPS) / 10_000n;
      const tokensNet = tokensGross - fee;

      await mem.write.buyToken({
        account: alice.account,
        value: ethAmount,
      });

      const balance = await mem.read.balanceOf([alice.account.address]);
      assert.equal(balance, tokensNet);
    });

    it("mints fee tokens to contract on buy", async () => {
      const mem = await deployWithPrice();
      const ethAmount = parseEther("1");
      const votePrice = 100_000_000_000_000n;

      const tokensGross = (ethAmount * 10n ** 18n) / votePrice;
      const fee = (tokensGross * FEE_BPS) / 10_000n;

      await mem.write.buyToken({
        account: alice.account,
        value: ethAmount,
      });

      const contractBalance = await mem.read.balanceOf([mem.address]);
      assert.equal(contractBalance, fee);
    });

    it("rejects buy when price not set", async () => {
      const mem = await deployMemToken();

      await assert.rejects(async () => {
        await mem.write.buyToken({
          account: alice.account,
          value: parseEther("1"),
        });
      });
    });

    it("rejects buy with zero ETH", async () => {
      const mem = await deployWithPrice();

      await assert.rejects(async () => {
        await mem.write.buyToken({
          account: alice.account,
          value: 0n,
        });
      });
    });

    it("rejects buy during active vote", async () => {
      // Deploy fresh contract for this test to start new voting
      const mem = await deployMemToken();
      
      // Start voting and vote to establish active session
      await mem.write.startVoting({ account: owner.account });
      await mem.write.vote([200_000_000_000_000n], { account: owner.account });

      await assert.rejects(async () => {
        await mem.write.buyToken({
          account: owner.account,
          value: parseEther("1"),
        });
      });
    });

    it("allows user to sell tokens for ETH", async () => {
      const mem = await deployWithPrice();

      // Alice buys tokens
      await mem.write.buyToken({
        account: alice.account,
        value: parseEther("1"),
      });

      const tokenBalance = await mem.read.balanceOf([alice.account.address]);
      const sellAmount = tokenBalance / 2n;

      const ethBefore = await publicClient.getBalance({
        address: alice.account.address,
      });

      await mem.write.sellToken([sellAmount], { account: alice.account });

      const ethAfter = await publicClient.getBalance({
        address: alice.account.address,
      });

      // ETH should increase (minus gas)
      assert.equal(ethAfter > ethBefore - parseEther("0.01"), true);
    });

    it("applies fee on sell", async () => {
      const mem = await deployWithPrice();

      await mem.write.buyToken({
        account: alice.account,
        value: parseEther("1"),
      });

      const tokenBalance = await mem.read.balanceOf([alice.account.address]);
      const sellAmount = tokenBalance;

      const contractBalanceBefore = await mem.read.balanceOf([mem.address]);

      await mem.write.sellToken([sellAmount], { account: alice.account });

      const contractBalanceAfter = await mem.read.balanceOf([mem.address]);

      // Contract should have more tokens (fee)
      assert.equal(contractBalanceAfter > contractBalanceBefore, true);
    });

    it("rejects sell with insufficient balance", async () => {
      const mem = await deployWithPrice();
      const sellAmount = 1000n * 10n ** 18n;

      await assert.rejects(async () => {
        await mem.write.sellToken([sellAmount], { account: alice.account });
      });
    });

    it("rejects sell when price not set", async () => {
      const mem = await deployMemToken();

      // Transfer tokens without setting price
      await mem.write.transfer([alice.account.address, 1000n * 10n ** 18n], {
        account: owner.account,
      });

      await assert.rejects(async () => {
        await mem.write.sellToken([100n * 10n ** 18n], {
          account: alice.account,
        });
      });
    });

    it("rejects sell during active vote", async () => {
      const mem = await deployWithPrice();

      // Alice buys tokens first
      await mem.write.buyToken({
        account: alice.account,
        value: parseEther("1"),
      });

      // Transfer enough tokens to alice so she can start and vote
      const aliceBalance = await mem.read.balanceOf([alice.account.address]);
      const neededForVoting = (INITIAL_SUPPLY / 1000n) - aliceBalance; // 0.1% threshold
      if (neededForVoting > 0n) {
        await mem.write.transfer([alice.account.address, neededForVoting + 1n], {
          account: owner.account,
        });
      }

      // Alice starts new voting and votes
      await mem.write.startVoting({ account: alice.account });
      await mem.write.vote([200_000_000_000_000n], { account: alice.account });

      // Alice cannot sell during their active vote
      const aliceBalanceNow = await mem.read.balanceOf([alice.account.address]);
      await assert.rejects(async () => {
        await mem.write.sellToken([aliceBalanceNow / 10n], {
          account: alice.account,
        });
      });
    });
  });
});
