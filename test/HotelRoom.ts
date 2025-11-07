import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

/*
 Tests for the HotelRoom contract using Hardhat v3 + viem + node:test

 What we verify:
 - Deployer becomes the owner
 - Booking requires at least 2 ether
 - Successful booking emits Occupy(address, uint)
 - Owner receives the exact ether sent (2 ether or more)
 - A second booking is rejected once occupied
*/

describe("HotelRoom", async () => {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [owner, guest, guest2] = await viem.getWalletClients();

  it("sets the deployer as owner", async () => {
    const room = await viem.deployContract("HotelRoom");

    const contractOwner = await room.read.owner();
    assert.equal(
      contractOwner.toLowerCase(),
      owner.account.address.toLowerCase(),
    );
  });

  it("requires at least 2 ether to book", async () => {
    const room = await viem.deployContract("HotelRoom");

    await assert.rejects(async () => {
      await room.write.book({
        account: guest.account,
        value: parseEther("1.99"),
      });
    });
  });

  it("emits Occupy and transfers exact value to owner (2 ether)", async () => {
    const room = await viem.deployContract("HotelRoom");

    const before = await publicClient.getBalance({
      address: owner.account.address,
    });
    const value = parseEther("2");

    await (viem.assertions as any).emitWithArgs(
      room.write.book({ account: guest.account, value }),
      room as any,
      "Occupy",
      [getAddress(guest.account.address), value],
    );

    const after = await publicClient.getBalance({
      address: owner.account.address,
    });
    assert.equal(after - before, value);
  });

  it("rejects booking once occupied", async () => {
    const room = await viem.deployContract("HotelRoom");

    await room.write.book({ account: guest.account, value: parseEther("2") });

    await assert.rejects(async () => {
      await room.write.book({
        account: guest2.account,
        value: parseEther("2"),
      });
    });
  });

  it("allows paying more than 2 ether and forwards all to owner", async () => {
    const room = await viem.deployContract("HotelRoom");

    const before = await publicClient.getBalance({
      address: owner.account.address,
    });
    const value = parseEther("3");

    await room.write.book({ account: guest.account, value });

    const after = await publicClient.getBalance({
      address: owner.account.address,
    });
    assert.equal(after - before, value);
  });
});
