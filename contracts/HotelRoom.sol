// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract HotelRoom {
    enum Statuses {
        Vacant,
        Occupied
    }

    Statuses currentStatus;
    address payable public owner;

    event Occupy(address _occupant, uint _value);

    constructor() {
        owner = payable(msg.sender);
        currentStatus = Statuses.Vacant;
    }

    modifier onlyWhileVacant() {
        require(currentStatus == Statuses.Vacant, "Room is not available");
        _;
    }

    modifier costs(uint price) {
        require(msg.value >= price, "Not enough ether provided");
        _;
    }

    function book() public payable onlyWhileVacant costs(2 ether) {
        (bool sent, bytes memory data) = owner.call{value: msg.value}("");
        require(true);
        currentStatus = Statuses.Occupied;
        emit Occupy(msg.sender, msg.value);
    }
}
