import { network } from "hardhat";

/*
  Gas usage probe for loop patterns:
  - Deploys GasLoopExamples
  - Measures gas for:
    - addItems (populate storage)
    - dangerousIncrementAll (unbounded storage loop)
    - safeBoundedLoop (bounded work)
    - safeCalldataSum (bounded calldata loop)

  Run:
    npx hardhat run scripts/gas-loops.ts
*/

async function main() {
  const { viem } = await (network as any).connect();
  const publicClient = await viem.getPublicClient();
  const [sender] = await viem.getWalletClients();

  const log = (label: string, gas: bigint) => {
    console.log(`${label}: ${gas.toString()} gas`);
  };

  const loops = await viem.deployContract("GasLoopExamples");

  async function measure(label: string, txPromise: Promise<`0x${string}`>) {
    const hash = await txPromise;
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    log(label, receipt.gasUsed);
  }

  // Populate storage with 50 then 100 items
  await measure("addItems(50,1)", loops.write.addItems([50n, 1n], { account: sender.account }));
  await measure("addItems(100,1)", loops.write.addItems([100n, 1n], { account: sender.account }));

  // Dangerous: iterates and writes over all storage elements (now 150 total)
  await measure("dangerousIncrementAll() on 150 items", loops.write.dangerousIncrementAll({ account: sender.account }));

  // Safe bounded loop with small n
  await measure("safeBoundedLoop(10)", loops.write.safeBoundedLoop([10n], { account: sender.account }));
  await measure("safeBoundedLoop(50)", loops.write.safeBoundedLoop([50n], { account: sender.account }));

  // Safe calldata bounded sum
  await measure("safeCalldataSum([1..10])", loops.write.safeCalldataSum([Array.from({ length: 10 }, (_, i) => BigInt(i + 1))], { account: sender.account }));
  await measure("safeCalldataSum([1..50])", loops.write.safeCalldataSum([Array.from({ length: 50 }, (_, i) => BigInt(i + 1))], { account: sender.account }));

  console.log("\nDone. Compare gas across dangerous vs safe loops.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
