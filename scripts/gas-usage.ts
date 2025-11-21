import { network } from "hardhat";
import { parseEther } from "viem";

/*
  Gas usage probe for MemToken and inherited functionality.
  - Deploys MemToken
  - Runs representative calls across Base, ERC20, Voting, Market
  - Prints gas used for each transaction

  Run:
    npx hardhat run scripts/gas-usage.ts
*/

async function main() {
  const { viem } = await (network as any).connect();
  const publicClient = await viem.getPublicClient();
  const [owner, user] = await viem.getWalletClients();

  const log = (label: string, gas: bigint) => {
    console.log(`${label}: ${gas.toString()} gas`);
  };

  const NAME = "Mem";
  const SYMBOL = "MEM";
  const DECIMALS = 18n;
  const INITIAL_SUPPLY = 1_000_000n * 10n ** DECIMALS; // 1m tokens
  const TIME_TO_VOTE = 60n; // 60 seconds
  const FEE_BPS = 300n; // 3%

  const mem = await viem.deployContract("MemToken", [
    NAME,
    SYMBOL,
    Number(DECIMALS),
    INITIAL_SUPPLY,
    Number(TIME_TO_VOTE),
    Number(FEE_BPS),
  ]);

  async function measure(label: string, txPromise: Promise<`0x${string}`>) {
    const hash = await txPromise;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    log(label, receipt.gasUsed);
  }

  await measure("setFeeBps(200)", mem.write.setFeeBps([200n], { account: owner.account }));

  await measure(
    "transfer(user, 1000e18)",
    mem.write.transfer([user.account.address, 1_000n * 10n ** DECIMALS], { account: owner.account }),
  );

  await measure(
    "approve(user, 500e18)",
    mem.write.approve([user.account.address, 500n * 10n ** DECIMALS], { account: owner.account }),
  );

  await measure(
    "transferFrom(owner->user, 200e18)",
    mem.write.transferFrom([owner.account.address, user.account.address, 200n * 10n ** DECIMALS], {
      account: user.account,
    }),
  );

  await measure("startVoting()", mem.write.startVoting({ account: owner.account }));

  const VOTE_PRICE = 100_000_000_000_000n; 
  await measure("vote(0.0001 ETH)", mem.write.vote([VOTE_PRICE], { account: owner.account }));

  await publicClient.request({
    method: "evm_increaseTime",
    params: [Number(TIME_TO_VOTE + 1n)],
  });
  await publicClient.request({ method: "evm_mine", params: [] });
  await measure("endVoting()", mem.write.endVoting({ account: owner.account }));


  await measure(
    "buyToken{value:1 ETH}",
    mem.write.buyToken({ account: user.account, value: parseEther("1") }),
  );

  const userBalance = await mem.read.balanceOf([user.account.address]);
  const sellAmount = userBalance / 2n;
  await measure("sellToken(half)", mem.write.sellToken([sellAmount], { account: user.account }));

  console.log("\nDone. If gas-reporter is enabled, run some tests for a table.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
