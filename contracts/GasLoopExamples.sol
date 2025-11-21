// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// This contract demonstrates why unbounded loops over storage can be dangerous
// for gas, and shows safer looping patterns that keep gas predictable.
contract GasLoopExamples {
    uint256[] public items; // dynamic storage array (dangerous to iterate unbounded)
    uint256 public lastResult; // sink variable for examples

    // Utility: add N items with the same value (O(N) storage writes)
    function addItems(uint256 count, uint256 value) external {
        for (uint256 i = 0; i < count; i++) {
            items.push(value);
        }
    }

    // DANGEROUS: iterates over all storage elements and writes each one.
    // Gas scales linearly with items.length and can easily exceed block gas.
    function dangerousIncrementAll() external {
        for (uint256 i = 0; i < items.length; i++) {
            unchecked {
                items[i] = items[i] + 1;
            }
        }
    }

    // SAFE (bounded): loops up to a small, enforced upper bound and only
    // performs simple arithmetic, with a single storage write at the end.
    function safeBoundedLoop(uint256 n) external {
        require(n <= 50, "n too large");
        uint256 acc;
        for (uint256 i = 0; i < n; i++) {
            unchecked {
                acc += i;
            }
        }
        lastResult = acc; // single storage write regardless of n
    }

    // SAFE (bounded over calldata): processes a small calldata array and writes once.
    function safeCalldataSum(uint256[] calldata arr) external {
        require(arr.length <= 50, "arr too large");
        uint256 acc;
        for (uint256 i = 0; i < arr.length; i++) {
            unchecked {
                acc += arr[i];
            }
        }
        lastResult = acc;
    }
}
